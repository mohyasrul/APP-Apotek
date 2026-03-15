-- ================================================================
-- FEFO (First Expire First Out) Automation Migration
-- Date: 2026-03-19
--
-- Changes:
--   1. Add batch_id to transaction_items (track which batch was used)
--   2. Add batch_id to stock_movements (track batch-level movements)
--   3. Rewrite process_checkout to auto-select batches by expiry (FEFO)
--   4. Add helper function to allocate quantity across batches
-- ================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Add batch_id column to transaction_items
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.medicine_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_items_batch_id
  ON public.transaction_items(batch_id) WHERE batch_id IS NOT NULL;

COMMENT ON COLUMN public.transaction_items.batch_id IS
  'Optional FK to medicine_batches for FEFO tracking. NULL if no batch system used.';


-- ─────────────────────────────────────────────────────────────
-- 2. Add batch_id column to stock_movements
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.medicine_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_batch_id
  ON public.stock_movements(batch_id) WHERE batch_id IS NOT NULL;

COMMENT ON COLUMN public.stock_movements.batch_id IS
  'Optional FK to medicine_batches for batch-level stock tracking.';


-- ─────────────────────────────────────────────────────────────
-- 3. Helper function: allocate_quantity_fefo
--    Allocates a requested quantity across batches using FEFO logic
--    Returns JSONB array of {batch_id, qty} allocations
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.allocate_quantity_fefo(
  p_medicine_id UUID,
  p_user_id     UUID,
  p_qty_needed  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch         RECORD;
  v_allocations   JSONB := '[]'::JSONB;
  v_remaining     INTEGER := p_qty_needed;
  v_to_take       INTEGER;
BEGIN
  -- Loop through batches ordered by expiry_date (FEFO)
  -- Only consider non-expired batches with positive quantity
  -- Use FOR UPDATE to lock batches during allocation
  FOR v_batch IN
    SELECT id, batch_number, quantity, expiry_date
      FROM public.medicine_batches
     WHERE medicine_id = p_medicine_id
       AND user_id = p_user_id
       AND quantity > 0
       AND expiry_date > CURRENT_DATE  -- Skip expired batches
     ORDER BY expiry_date ASC, created_at ASC
     FOR UPDATE
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    -- Take as much as possible from this batch
    v_to_take := LEAST(v_batch.quantity, v_remaining);

    -- Add to allocations
    v_allocations := v_allocations || jsonb_build_object(
      'batch_id', v_batch.id,
      'batch_number', v_batch.batch_number,
      'qty', v_to_take,
      'expiry_date', v_batch.expiry_date
    );

    v_remaining := v_remaining - v_to_take;
  END LOOP;

  -- If we couldn't allocate the full amount, raise error
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Stok batch tidak mencukupi. Tersedia: %, diminta: %',
      (p_qty_needed - v_remaining), p_qty_needed;
  END IF;

  RETURN v_allocations;
END;
$$;

COMMENT ON FUNCTION public.allocate_quantity_fefo IS
  'FEFO allocation: returns JSONB array of {batch_id, qty} for requested quantity';


-- ─────────────────────────────────────────────────────────────
-- 4. Rewrite process_checkout with FEFO logic
--    Now uses allocate_quantity_fefo to determine which batches
--    to deduct from, and creates transaction_items + stock_movements
--    per batch allocation
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
  v_user_id         UUID;
  v_trx_id          UUID;
  v_trx_number      TEXT;
  v_year_month      TEXT;
  v_seq             INTEGER;
  v_item            JSONB;
  v_med_id          UUID;
  v_qty_total       INTEGER;
  v_current_stock   INTEGER;
  v_med_name        TEXT;
  v_allocations     JSONB;
  v_alloc           JSONB;
  v_batch_id        UUID;
  v_batch_qty       INTEGER;
  v_has_batches     BOOLEAN;
  v_price           NUMERIC;
  v_discount        NUMERIC;
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

  -- ── c. Loop through items and apply FEFO allocation ───────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id    := (v_item->>'medicine_id')::UUID;
    v_qty_total := (v_item->>'quantity')::INTEGER;
    v_price     := (v_item->>'price_at_transaction')::NUMERIC;
    v_discount  := COALESCE((v_item->>'discount_amount')::NUMERIC, 0);

    -- Validate quantity
    IF v_qty_total <= 0 THEN
      RAISE EXCEPTION 'Jumlah harus positif untuk obat %', v_med_id;
    END IF;

    -- Lock medicine row + get name and stock (FOR UPDATE prevents concurrent oversell)
    SELECT stock, name INTO v_current_stock, v_med_name
      FROM public.medicines
     WHERE id = v_med_id AND user_id = v_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Obat dengan ID % tidak ditemukan', v_med_id;
    END IF;

    IF v_current_stock < v_qty_total THEN
      RAISE EXCEPTION 'Stok "%" tidak mencukupi. Tersedia: %, diminta: %',
        v_med_name, v_current_stock, v_qty_total;
    END IF;

    -- Check if this medicine has batches
    SELECT EXISTS(
      SELECT 1 FROM public.medicine_batches
       WHERE medicine_id = v_med_id
         AND user_id = v_user_id
         AND quantity > 0
    ) INTO v_has_batches;

    IF v_has_batches THEN
      -- ── FEFO Mode: allocate across batches ──────────────────
      v_allocations := public.allocate_quantity_fefo(v_med_id, v_user_id, v_qty_total);

      -- Loop through allocations and create transaction_items + deduct batch
      FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_allocations) LOOP
        v_batch_id  := (v_alloc->>'batch_id')::UUID;
        v_batch_qty := (v_alloc->>'qty')::INTEGER;

        -- Insert transaction_item with batch_id
        INSERT INTO public.transaction_items (
          transaction_id, medicine_id, batch_id, quantity,
          price_at_transaction, discount_amount
        ) VALUES (
          v_trx_id, v_med_id, v_batch_id, v_batch_qty,
          v_price, v_discount * (v_batch_qty::NUMERIC / v_qty_total::NUMERIC)  -- pro-rate discount
        );

        -- Deduct from batch quantity
        UPDATE public.medicine_batches
           SET quantity   = quantity - v_batch_qty,
               updated_at = NOW()
         WHERE id = v_batch_id;

        -- Stock movement with batch tracking
        INSERT INTO public.stock_movements (
          medicine_id, user_id, batch_id, type, quantity, reference_id
        ) VALUES (
          v_med_id, v_user_id, v_batch_id, 'sale', v_batch_qty, v_trx_id
        );
      END LOOP;

      -- Update medicine total stock (sum of all batches)
      UPDATE public.medicines
         SET stock = (
           SELECT COALESCE(SUM(quantity), 0)
             FROM public.medicine_batches
            WHERE medicine_id = v_med_id AND user_id = v_user_id
         ),
         updated_at = NOW()
       WHERE id = v_med_id AND user_id = v_user_id;

    ELSE
      -- ── Legacy Mode: no batches, direct stock decrement ─────
      INSERT INTO public.transaction_items (
        transaction_id, medicine_id, quantity,
        price_at_transaction, discount_amount
      ) VALUES (
        v_trx_id, v_med_id, v_qty_total,
        v_price, v_discount
      );

      -- Direct stock decrement
      UPDATE public.medicines
         SET stock      = stock - v_qty_total,
             updated_at = NOW()
       WHERE id = v_med_id AND user_id = v_user_id;

      -- Stock movement without batch
      INSERT INTO public.stock_movements (
        medicine_id, user_id, type, quantity, reference_id
      ) VALUES (
        v_med_id, v_user_id, 'sale', v_qty_total, v_trx_id
      );
    END IF;
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

COMMENT ON FUNCTION public.process_checkout IS
  'Thread-safe checkout with FEFO batch allocation. Auto-selects batches by earliest expiry.';

COMMIT;
