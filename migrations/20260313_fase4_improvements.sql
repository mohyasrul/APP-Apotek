-- ================================================================
-- Fase 4: Critical Fixes + Performance Improvements
-- Date: 2026-03-13
-- Fixes:
--   P0-1: Stock validation in process_checkout (prevent oversell)
--   P0-2: Use auth.uid() instead of p_user_id (security)
--   P2-1: Audit log DB trigger (replace frontend fire-and-forget)
--   P2-2: get_top_selling RPC (replace N+1 Dashboard pattern)
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. DROP & RECREATE process_checkout with security fixes
--    Changes:
--    a. Use get_effective_user_id() instead of p_user_id param
--    b. Add stock validation BEFORE decrement (RAISE EXCEPTION)
--    c. Remove p_user_id parameter entirely
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_total_amount    NUMERIC,
  p_discount_total  NUMERIC,
  p_payment_method  TEXT,
  p_items           JSONB,
  p_prescription_id UUID    DEFAULT NULL,
  p_customer_name   TEXT    DEFAULT NULL,
  p_customer_phone  TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id    UUID;
  v_trx_id     UUID;
  v_trx_number TEXT;
  v_year_month TEXT;
  v_seq        INTEGER;
  v_item       JSONB;
  v_med_id     UUID;
  v_qty        INTEGER;
  v_current_stock INTEGER;
  v_med_name   TEXT;
BEGIN
  -- Resolve effective user ID server-side (kasir → owner)
  v_user_id := public.get_effective_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  v_year_month := TO_CHAR(NOW(), 'YYYY-MM');

  -- ── a. Generate nomor nota (thread-safe) ────────────────────
  INSERT INTO public.transaction_counters (user_id, year_month, seq)
  VALUES (v_user_id, v_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET seq = public.transaction_counters.seq + 1
  RETURNING seq INTO v_seq;

  v_trx_number := 'TRX/'
    || REPLACE(v_year_month, '-', '/')
    || '/'
    || LPAD(v_seq::TEXT, 4, '0');

  -- ── b. Validasi stok SEBELUM insert transaksi ──────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id := (v_item->>'medicine_id')::UUID;
    v_qty    := (v_item->>'quantity')::INTEGER;

    SELECT stock, name INTO v_current_stock, v_med_name
      FROM public.medicines
     WHERE id = v_med_id AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Obat dengan ID % tidak ditemukan', v_med_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok % tidak mencukupi. Tersedia: %, diminta: %',
        v_med_name, v_current_stock, v_qty;
    END IF;
  END LOOP;

  -- ── c. Insert transaksi ──────────────────────────────────────
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

  -- ── d+e+f. Items + stock decrement + audit ───────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id := (v_item->>'medicine_id')::UUID;
    v_qty    := (v_item->>'quantity')::INTEGER;

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

    -- Strict stock decrement (no GREATEST — already validated)
    UPDATE public.medicines
       SET stock      = stock - v_qty,
           updated_at = NOW()
     WHERE id = v_med_id AND user_id = v_user_id;

    -- Stock movement log
    INSERT INTO public.stock_movements (
      medicine_id, user_id, type, quantity, reference_id
    ) VALUES (
      v_med_id, v_user_id, 'sale', v_qty, v_trx_id
    );
  END LOOP;

  -- ── g. Update status resep ───────────────────────────────────
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
-- 2. RPC get_top_selling — replace N+1 Dashboard query
--    Joins transaction_items + medicines in one query.
--    Filters by date range and excludes voided transactions.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_selling(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_limit      INTEGER     DEFAULT 5
)
RETURNS TABLE (
  medicine_id UUID,
  name        TEXT,
  category    TEXT,
  unit        TEXT,
  total_qty   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := public.get_effective_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  RETURN QUERY
    SELECT
      m.id          AS medicine_id,
      m.name        AS name,
      m.category    AS category,
      m.unit        AS unit,
      SUM(ti.quantity)::BIGINT AS total_qty
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    JOIN public.medicines    m ON m.id = ti.medicine_id
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
-- 3. Audit log trigger for medicines table
--    Replaces frontend fire-and-forget audit logging.
--    Automatically logs INSERT/UPDATE/DELETE directly in DB.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_medicine_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action TEXT;
  v_entity_name TEXT;
  v_before JSONB;
  v_after  JSONB;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action      := 'create';
    v_entity_name := NEW.name;
    v_before      := NULL;
    v_after       := jsonb_build_object(
      'name', NEW.name, 'stock', NEW.stock,
      'buy_price', NEW.buy_price, 'sell_price', NEW.sell_price
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_action      := 'update';
    v_entity_name := NEW.name;
    v_before      := jsonb_build_object(
      'name', OLD.name, 'stock', OLD.stock,
      'buy_price', OLD.buy_price, 'sell_price', OLD.sell_price
    );
    v_after       := jsonb_build_object(
      'name', NEW.name, 'stock', NEW.stock,
      'buy_price', NEW.buy_price, 'sell_price', NEW.sell_price
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action      := 'delete';
    v_entity_name := OLD.name;
    v_before      := jsonb_build_object(
      'name', OLD.name, 'stock', OLD.stock,
      'buy_price', OLD.buy_price, 'sell_price', OLD.sell_price
    );
    v_after       := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_name, before_data, after_data
  ) VALUES (
    v_user_id, v_action, 'medicine', v_entity_name, v_before, v_after
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_audit_medicines ON public.medicines;
CREATE TRIGGER trg_audit_medicines
  AFTER INSERT OR UPDATE OR DELETE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.audit_medicine_changes();


-- ─────────────────────────────────────────────────────────────
-- 4. Additional performance indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_created
  ON public.transactions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_items_trx_medicine
  ON public.transaction_items (transaction_id, medicine_id);
