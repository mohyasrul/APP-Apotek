-- ================================================================
-- Fase 4: Comprehensive Improvements Migration
-- Date: 2026-03-13
--
-- Changes:
--   1. SECURITY: process_checkout uses auth context (not client param)
--   2. FIX: Stock validation before decrement (prevent oversell)
--   3. NEW: get_top_selling RPC for Dashboard
--   4. NEW: DB audit trigger on medicines (replaces frontend fire-and-forget)
--   5. PERF: Additional indexes for common queries
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Drop old process_checkout (with p_user_id parameter)
--    Then create new version that uses auth context internally.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.process_checkout(UUID, NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.process_checkout(
  p_total_amount    NUMERIC,
  p_discount_total  NUMERIC,
  p_payment_method  TEXT,
  p_items           JSONB,   -- [{ medicine_id, quantity, price_at_transaction, discount_amount }]
  p_prescription_id UUID    DEFAULT NULL,
  p_customer_name   TEXT    DEFAULT NULL,
  p_customer_phone  TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id      UUID;
  v_trx_id       UUID;
  v_trx_number   TEXT;
  v_year_month   TEXT;
  v_seq          INTEGER;
  v_item         JSONB;
  v_med_id       UUID;
  v_qty          INTEGER;
  v_current_stock INTEGER;
  v_med_name     TEXT;
BEGIN
  -- ── SECURITY: derive user_id from auth context ────────────
  v_user_id := public.get_effective_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: tidak ada sesi pengguna aktif';
  END IF;

  v_year_month := TO_CHAR(NOW(), 'YYYY-MM');

  -- ── a. Generate nomor nota (thread-safe) ──────────────────
  INSERT INTO public.transaction_counters (user_id, year_month, seq)
  VALUES (v_user_id, v_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET seq = public.transaction_counters.seq + 1
  RETURNING seq INTO v_seq;

  v_trx_number := 'TRX/'
    || REPLACE(v_year_month, '-', '/')
    || '/'
    || LPAD(v_seq::TEXT, 4, '0');

  -- ── b. Insert transaksi ───────────────────────────────────
  INSERT INTO public.transactions (
    user_id, total_amount, discount_total, payment_method,
    transaction_number, status,
    prescription_id, customer_name, customer_phone
  ) VALUES (
    v_user_id, p_total_amount, p_discount_total, p_payment_method,
    v_trx_number, 'active',
    p_prescription_id, p_customer_name, p_customer_phone
  )
  RETURNING id INTO v_trx_id;

  -- ── c+d+e. Items + stock validation + decrement + audit ───
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id := (v_item->>'medicine_id')::UUID;
    v_qty    := (v_item->>'quantity')::INTEGER;

    -- CRITICAL: Validate stock BEFORE decrement
    SELECT stock, name INTO v_current_stock, v_med_name
      FROM public.medicines
     WHERE id = v_med_id;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Obat dengan ID % tidak ditemukan', v_med_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok "%" tidak mencukupi. Tersedia: %, diminta: %',
        v_med_name, v_current_stock, v_qty;
    END IF;

    -- Insert item transaksi
    INSERT INTO public.transaction_items (
      transaction_id, medicine_id, quantity,
      price_at_transaction, discount_amount
    ) VALUES (
      v_trx_id,
      v_med_id,
      v_qty,
      (v_item->>'price_at_transaction')::NUMERIC,
      COALESCE((v_item->>'discount_amount')::NUMERIC, 0)
    );

    -- Atomic stock decrement (safe — validated above)
    UPDATE public.medicines
       SET stock      = stock - v_qty,
           updated_at = NOW()
     WHERE id = v_med_id;

    -- Stock movement log
    INSERT INTO public.stock_movements (
      medicine_id, user_id, type, quantity, reference_id
    ) VALUES (
      v_med_id, v_user_id, 'sale', v_qty, v_trx_id
    );
  END LOOP;

  -- ── f. Update status resep ────────────────────────────────
  IF p_prescription_id IS NOT NULL THEN
    UPDATE public.prescriptions
       SET status         = 'dispensed',
           transaction_id = v_trx_id,
           updated_at     = NOW()
     WHERE id = p_prescription_id;
  END IF;

  RETURN json_build_object(
    'transaction_id',     v_trx_id,
    'transaction_number', v_trx_number
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_checkout(NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.process_checkout(NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. RPC get_top_selling — efficient top-selling aggregation
--    Replaces N+1 pattern in Dashboard.tsx
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_selling(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_limit      INTEGER     DEFAULT 5
)
RETURNS TABLE (
  medicine_id   UUID,
  medicine_name TEXT,
  category      TEXT,
  unit          TEXT,
  total_qty     BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := public.get_effective_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      m.id         AS medicine_id,
      m.name       AS medicine_name,
      m.category,
      m.unit,
      SUM(ti.quantity)::BIGINT AS total_qty
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    JOIN public.medicines m    ON m.id = ti.medicine_id
    WHERE t.user_id = v_user_id
      AND t.status  = 'active'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
    GROUP BY m.id, m.name, m.category, m.unit
    ORDER BY total_qty DESC
    LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_top_selling FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_top_selling TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. DB audit trigger for medicines
--    Replaces fire-and-forget from frontend Medicines.tsx
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_medicine_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, entity_name, after_data)
    VALUES (v_uid, 'create', 'medicine', NEW.id, NEW.name, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, entity_name, before_data, after_data)
    VALUES (v_uid, 'update', 'medicine', NEW.id, NEW.name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, entity_name, before_data)
    VALUES (v_uid, 'delete', 'medicine', OLD.id, OLD.name, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Only create trigger if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_medicines'
  ) THEN
    CREATE TRIGGER trg_audit_medicines
      AFTER INSERT OR UPDATE OR DELETE ON public.medicines
      FOR EACH ROW EXECUTE FUNCTION public.audit_medicine_changes();
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 4. Performance indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_created
  ON public.transactions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction
  ON public.transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_medicine
  ON public.transaction_items (medicine_id);

CREATE INDEX IF NOT EXISTS idx_medicines_user_name
  ON public.medicines (user_id, name);
