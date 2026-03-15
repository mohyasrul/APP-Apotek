-- ================================================================
-- Apograph / Prescription dispense tracking
-- Update process_checkout to record dispensed_quantity
-- ================================================================

BEGIN;

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
  v_cashier_id      UUID;
  v_shift_id        UUID;
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
  v_cashier_id := auth.uid();
  IF v_cashier_id IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  v_user_id := public.get_effective_user_id();

  SELECT id INTO v_shift_id
    FROM public.cashier_shifts
   WHERE cashier_id = v_cashier_id
     AND pharmacy_id = v_user_id
     AND status = 'open'
   ORDER BY start_time DESC
   LIMIT 1;

  IF p_total_amount < 0 THEN RAISE EXCEPTION 'Total amount tidak boleh negatif'; END IF;
  IF p_discount_total < 0 THEN RAISE EXCEPTION 'Diskon tidak boleh negatif'; END IF;
  IF p_payment_method NOT IN ('cash', 'qris', 'transfer') THEN RAISE EXCEPTION 'Metode valid: %', p_payment_method; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Item kosong'; END IF;

  v_year_month := TO_CHAR(NOW(), 'YYYY-MM');

  INSERT INTO public.transaction_counters (user_id, year_month, seq)
  VALUES (v_user_id, v_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET seq = public.transaction_counters.seq + 1
  RETURNING seq INTO v_seq;

  v_trx_number := 'TRX/' || REPLACE(v_year_month, '-', '/') || '/' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO public.transactions (
    user_id, total_amount, discount_total, payment_method,
    transaction_number, status, prescription_id, customer_name, customer_phone,
    shift_id, cashier_id
  ) VALUES (
    v_user_id, p_total_amount, p_discount_total, p_payment_method,
    v_trx_number, 'active', p_prescription_id, p_customer_name, p_customer_phone,
    v_shift_id, v_cashier_id
  )
  RETURNING id INTO v_trx_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id    := (v_item->>'medicine_id')::UUID;
    v_qty_total := (v_item->>'quantity')::INTEGER;
    v_price     := (v_item->>'price_at_transaction')::NUMERIC;
    v_discount  := COALESCE((v_item->>'discount_amount')::NUMERIC, 0);

    IF v_qty_total <= 0 THEN RAISE EXCEPTION 'Jml harus positif %', v_med_id; END IF;

    SELECT stock, name INTO v_current_stock, v_med_name
      FROM public.medicines
     WHERE id = v_med_id AND user_id = v_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Obat % tidak ditemukan', v_med_id; END IF;
    IF v_current_stock < v_qty_total THEN RAISE EXCEPTION 'Stok tidak cukup'; END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.medicine_batches
       WHERE medicine_id = v_med_id AND user_id = v_user_id AND quantity > 0
    ) INTO v_has_batches;

    IF v_has_batches THEN
      v_allocations := public.allocate_quantity_fefo(v_med_id, v_user_id, v_qty_total);
      FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_allocations) LOOP
        v_batch_id  := (v_alloc->>'batch_id')::UUID;
        v_batch_qty := (v_alloc->>'qty')::INTEGER;

        INSERT INTO public.transaction_items (transaction_id, medicine_id, batch_id, quantity, price_at_transaction, discount_amount)
        VALUES (v_trx_id, v_med_id, v_batch_id, v_batch_qty, v_price, v_discount * (v_batch_qty::NUMERIC / v_qty_total::NUMERIC));

        UPDATE public.medicine_batches SET quantity = quantity - v_batch_qty, updated_at = NOW() WHERE id = v_batch_id;
        INSERT INTO public.stock_movements (medicine_id, user_id, batch_id, type, quantity, reference_id)
        VALUES (v_med_id, v_user_id, v_batch_id, 'sale', v_batch_qty, v_trx_id);
      END LOOP;

      UPDATE public.medicines SET stock = (
           SELECT COALESCE(SUM(quantity), 0) FROM public.medicine_batches WHERE medicine_id = v_med_id AND user_id = v_user_id
         ), updated_at = NOW() WHERE id = v_med_id AND user_id = v_user_id;
    ELSE
      INSERT INTO public.transaction_items (transaction_id, medicine_id, quantity, price_at_transaction, discount_amount)
      VALUES (v_trx_id, v_med_id, v_qty_total, v_price, v_discount);

      UPDATE public.medicines SET stock = stock - v_qty_total, updated_at = NOW() WHERE id = v_med_id AND user_id = v_user_id;

      INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id)
      VALUES (v_med_id, v_user_id, 'sale', v_qty_total, v_trx_id);
    END IF;

    -- Update dispensed_quantity in prescription_items if this checkout is attached to a prescription
    IF p_prescription_id IS NOT NULL THEN
      UPDATE public.prescription_items
         SET dispensed_quantity = COALESCE(dispensed_quantity, 0) + v_qty_total
       WHERE prescription_id = p_prescription_id
         AND medicine_id = v_med_id;
    END IF;
  END LOOP;

  IF p_prescription_id IS NOT NULL THEN
    UPDATE public.prescriptions SET status = 'dispensed', transaction_id = v_trx_id, updated_at = NOW() WHERE id = p_prescription_id;
  END IF;

  RETURN json_build_object('transaction_id', v_trx_id, 'transaction_number', v_trx_number);
END;
$$;

COMMIT;
