-- ================================================================
-- Security & Data Integrity Fixes Migration
-- Date: 2026-03-17
--
-- Fixes:
--   1. process_checkout: SELECT ... FOR UPDATE (prevent oversell race)
--   2. process_checkout: input validation (negative amounts, payment_method)
--   3. decrement_stock / increment_stock: ownership check
--   4. audit_medicine_changes: fix nil UUID FK violation
--   5. create_invite_link / create_invitation: stronger randomness
--   6. void_transaction: check if medicine still exists
--   7. get_total_laba / get_dashboard_metrics: JOIN-based (no correlated subquery)
--   8. Drop obsolete generate_transaction_number (race-prone)
--   9. Additional indexes + NOT NULL constraints
-- ================================================================


-- ─────────────────────────────────────────────────────────────
-- 1. process_checkout — CONSOLIDATED with all security fixes
--    Changes vs previous version:
--    a. SELECT ... FOR UPDATE to lock medicine rows during validation
--    b. Single loop: validate + insert item + decrement in one pass
--    c. Input validation: negative amounts, qty, payment_method
--    d. user_id filter on medicine SELECT (ownership check)
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
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  -- ── INPUT VALIDATION ──────────────────────────────────────
  IF p_total_amount < 0 THEN
    RAISE EXCEPTION 'Total amount tidak boleh negatif';
  END IF;

  IF p_discount_total < 0 THEN
    RAISE EXCEPTION 'Diskon tidak boleh negatif';
  END IF;

  IF p_payment_method NOT IN ('cash', 'qris', 'transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid: %', p_payment_method;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Item transaksi tidak boleh kosong';
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

  -- ── c. Single loop: validate (FOR UPDATE) + insert + decrement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id := (v_item->>'medicine_id')::UUID;
    v_qty    := (v_item->>'quantity')::INTEGER;

    -- Validate quantity
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah harus positif untuk obat %', v_med_id;
    END IF;

    -- Lock row + validate stock (FOR UPDATE prevents concurrent oversell)
    SELECT stock, name INTO v_current_stock, v_med_name
      FROM public.medicines
     WHERE id = v_med_id AND user_id = v_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
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

    -- Atomic stock decrement (safe — locked and validated above)
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

  -- ── d. Update status resep ────────────────────────────────
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
-- 2. decrement_stock — add ownership check
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decrement_stock(p_medicine_id UUID, p_qty INTEGER, p_transaction_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_eff_uid UUID;
BEGIN
  v_eff_uid := public.get_effective_user_id();
  IF v_eff_uid IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  UPDATE medicines
  SET stock = stock - p_qty
  WHERE id = p_medicine_id
    AND user_id = v_eff_uid
    AND stock >= p_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok tidak mencukupi atau obat bukan milik apotek Anda (medicine_id: %)', p_medicine_id;
  END IF;

  INSERT INTO stock_movements (medicine_id, user_id, type, quantity, reference_id)
  VALUES (p_medicine_id, v_eff_uid, 'sale', -p_qty, p_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────
-- 3. increment_stock — add ownership check
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_stock(p_medicine_id UUID, p_qty INTEGER, p_notes TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_eff_uid UUID;
BEGIN
  v_eff_uid := public.get_effective_user_id();
  IF v_eff_uid IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  UPDATE medicines
  SET stock = stock + p_qty
  WHERE id = p_medicine_id
    AND user_id = v_eff_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obat tidak ditemukan atau bukan milik apotek Anda (medicine_id: %)', p_medicine_id;
  END IF;

  INSERT INTO stock_movements (medicine_id, user_id, type, quantity, notes)
  VALUES (p_medicine_id, v_eff_uid, 'restock', p_qty, p_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────
-- 4. audit_medicine_changes — fix nil UUID FK violation
--    Return early when auth.uid() is NULL (system/migration ops)
--    Add entity_id to INSERT
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_medicine_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action      TEXT;
  v_entity_name TEXT;
  v_before      JSONB;
  v_after       JSONB;
  v_user_id     UUID;
BEGIN
  v_user_id := auth.uid();

  -- Skip audit for system-level operations (migrations, direct DB ops)
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
    user_id, action, entity_type, entity_id, entity_name, before_data, after_data
  ) VALUES (
    v_user_id, v_action, 'medicine',
    COALESCE(NEW.id, OLD.id),
    v_entity_name, v_before, v_after
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_medicines ON public.medicines;
CREATE TRIGGER trg_audit_medicines
  AFTER INSERT OR UPDATE OR DELETE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.audit_medicine_changes();


-- ─────────────────────────────────────────────────────────────
-- 5. create_invite_link — stronger randomness (48-bit vs 32-bit)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invite_link(
  p_email TEXT    DEFAULT NULL,
  p_role  TEXT    DEFAULT 'cashier'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID := auth.uid();
  v_code     TEXT;
  v_token    UUID;
  v_id       UUID;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Invalidate existing pending invites for same email
  IF p_email IS NOT NULL THEN
    UPDATE public.invitations
       SET expires_at = NOW() - INTERVAL '1 second'
     WHERE owner_id = v_owner_id
       AND email    = LOWER(TRIM(p_email))
       AND used_at  IS NULL;
  END IF;

  -- Generate 12-char code using cryptographic randomness (48 bits)
  LOOP
    v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invitations WHERE code = v_code);
  END LOOP;

  INSERT INTO public.invitations (owner_id, email, role, code)
  VALUES (
    v_owner_id,
    CASE WHEN p_email IS NOT NULL THEN LOWER(TRIM(p_email)) ELSE NULL END,
    p_role,
    v_code
  )
  RETURNING id, token INTO v_id, v_token;

  RETURN json_build_object(
    'id',    v_id,
    'token', v_token,
    'code',  v_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invite_link(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_invite_link(TEXT, TEXT) TO authenticated;

-- Also fix the legacy create_invitation function
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_email TEXT,
  p_role  TEXT DEFAULT 'cashier'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code     TEXT;
  v_owner_id UUID := auth.uid();
BEGIN
  -- Invalidate existing pending invites
  UPDATE public.invitations
     SET expires_at = NOW() - INTERVAL '1 second'
   WHERE owner_id = v_owner_id
     AND email    = LOWER(TRIM(p_email))
     AND used_at IS NULL;

  -- 12-char code with cryptographic randomness
  LOOP
    v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invitations WHERE code = v_code);
  END LOOP;

  INSERT INTO public.invitations (owner_id, email, role, code)
  VALUES (v_owner_id, LOWER(TRIM(p_email)), p_role, v_code);

  RETURN v_code;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 6. void_transaction — check if medicine still exists
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_transaction(
  p_transaction_id UUID,
  p_user_id        UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item     RECORD;
  v_status   TEXT;
BEGIN
  -- Verify ownership & status
  SELECT status INTO v_status
    FROM public.transactions
   WHERE id = p_transaction_id
     AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan atau bukan milik Anda';
  END IF;

  IF v_status = 'voided' THEN
    RAISE EXCEPTION 'Transaksi sudah pernah dibatalkan';
  END IF;

  -- Update transaction status
  UPDATE public.transactions
     SET status      = 'voided',
         voided_at   = NOW(),
         void_reason = p_reason
   WHERE id = p_transaction_id;

  -- Loop items: restore stock & log movement
  FOR v_item IN
    SELECT medicine_id, quantity
      FROM public.transaction_items
     WHERE transaction_id = p_transaction_id
  LOOP
    -- Restore stock (check if medicine still exists)
    UPDATE public.medicines
       SET stock      = stock + v_item.quantity,
           updated_at = NOW()
     WHERE id = v_item.medicine_id;

    IF NOT FOUND THEN
      -- Medicine deleted; log warning but don't fail the void
      INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id, notes)
      VALUES (
        v_item.medicine_id, p_user_id, 'void_return', v_item.quantity,
        p_transaction_id,
        'PERINGATAN: obat sudah dihapus, stok tidak bisa dikembalikan'
      );
      CONTINUE;
    END IF;

    -- Normal stock movement log
    INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id, notes)
    VALUES (
      v_item.medicine_id, p_user_id, 'void_return', v_item.quantity,
      p_transaction_id,
      'Pembatalan transaksi: ' || COALESCE(p_reason, '-')
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 7. get_total_laba — rewrite with JOIN (no correlated subquery)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_total_laba(
  p_user_id    UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_omset      NUMERIC := 0;
  v_laba_kotor NUMERIC := 0;
  v_trx_count  INTEGER := 0;
BEGIN
  SELECT
    COALESCE(SUM(t.total_amount), 0),
    COALESCE(SUM((ti.price_at_transaction - COALESCE(m.buy_price, 0)) * ti.quantity), 0),
    COUNT(DISTINCT t.id)
  INTO v_omset, v_laba_kotor, v_trx_count
  FROM public.transactions t
  LEFT JOIN public.transaction_items ti ON ti.transaction_id = t.id
  LEFT JOIN public.medicines m ON m.id = ti.medicine_id
  WHERE t.user_id = p_user_id
    AND t.status = 'active'
    AND (p_start_date IS NULL OR t.created_at >= p_start_date);

  RETURN json_build_object(
    'omset',      v_omset,
    'laba_kotor', v_laba_kotor,
    'trx_count',  v_trx_count
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 8. get_dashboard_metrics — rewrite with JOIN (no correlated subquery)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_user_id    UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sales     NUMERIC := 0;
  v_total_trx       INTEGER := 0;
  v_items_sold      BIGINT  := 0;
  v_critical_stock  INTEGER := 0;
  v_expiry_count    INTEGER := 0;
BEGIN
  -- Sales metrics using JOIN (no correlated subquery)
  SELECT
    COALESCE(SUM(t.total_amount), 0),
    COUNT(DISTINCT t.id),
    COALESCE(SUM(ti.quantity), 0)
  INTO v_total_sales, v_total_trx, v_items_sold
  FROM public.transactions t
  LEFT JOIN public.transaction_items ti ON ti.transaction_id = t.id
  WHERE t.user_id = p_user_id
    AND t.status = 'active'
    AND (p_start_date IS NULL OR t.created_at >= p_start_date);

  -- Critical stock count
  SELECT COUNT(*)
    INTO v_critical_stock
    FROM public.medicines
   WHERE user_id = p_user_id
     AND stock < min_stock;

  -- Expiry warning count (within 90 days, not yet expired, with stock)
  SELECT COUNT(*)
    INTO v_expiry_count
    FROM public.medicines
   WHERE user_id = p_user_id
     AND expiry_date <= (NOW() + INTERVAL '90 days')
     AND expiry_date >= NOW()
     AND stock > 0;

  RETURN json_build_object(
    'total_sales',    v_total_sales,
    'total_trx',      v_total_trx,
    'items_sold',     v_items_sold,
    'critical_stock', v_critical_stock,
    'expiry_count',   v_expiry_count
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 9. Drop obsolete generate_transaction_number
--    Superseded by thread-safe sequence in process_checkout
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.generate_transaction_number(UUID);


-- ─────────────────────────────────────────────────────────────
-- 10. Additional indexes for performance
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_medicine
  ON public.stock_movements (user_id, medicine_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medicines_user_stock_positive
  ON public.medicines (user_id, stock)
  WHERE stock > 0;

CREATE INDEX IF NOT EXISTS idx_medicines_user_expiry
  ON public.medicines (user_id, expiry_date)
  WHERE stock > 0;


-- ─────────────────────────────────────────────────────────────
-- 11. NOT NULL constraints on user_id FK columns
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Guard: only apply if no NULL rows exist
  IF NOT EXISTS (SELECT 1 FROM public.medicines WHERE user_id IS NULL) THEN
    ALTER TABLE public.medicines ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE user_id IS NULL) THEN
    ALTER TABLE public.transactions ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE user_id IS NULL) THEN
    ALTER TABLE public.stock_movements ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 12. FK constraint on transactions.prescription_id
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT fk_transactions_prescription
    FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
