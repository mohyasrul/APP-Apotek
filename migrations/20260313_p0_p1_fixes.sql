-- ================================================================
-- P0/P1 Bug Fixes Migration
-- Date: 2026-03-13
-- Fixes:
--   P0-A1: RPC process_checkout — satu transaksi DB atomic
--          (gen nomor nota + insert trx + items + stock decrement)
--   P0-A3: Tabel transaction_counters — sequence thread-safe
--          menggantikan COUNT(*)+1 yang race-prone
--   P1-B3: Kolom customer_phone pada transactions
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. transaction_counters
--    Menyimpan sequence nomor nota per (user, bulan).
--    INSERT ... ON CONFLICT DO UPDATE memberi row-level lock
--    otomatis, sehingga dua kasir bersamaan tidak bisa dapat
--    nomor yang sama.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transaction_counters (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,          -- format: 'YYYY-MM'
  seq        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);

ALTER TABLE public.transaction_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transaction counters"
  ON public.transaction_counters FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- ─────────────────────────────────────────────────────────────
-- 2. customer_phone di transactions (P1-B3)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

COMMENT ON COLUMN public.transactions.customer_phone IS
  'Nomor HP pelanggan (opsional). Disimpan untuk kemudahan kirim WhatsApp struk.';

-- ─────────────────────────────────────────────────────────────
-- 3. RPC process_checkout
--    Satu fungsi yang menjalankan SELURUH proses checkout
--    dalam satu PostgreSQL transaction:
--      a. Generate nomor nota (thread-safe via INSERT ON CONFLICT)
--      b. INSERT ke transactions
--      c. INSERT ke transaction_items (loop)
--      d. UPDATE stock — atomic (stock = stock - qty, bukan fetch-then-update)
--      e. INSERT ke stock_movements
--      f. UPDATE prescription status (jika ada)
--
--    Jika salah satu langkah gagal, seluruh transaksi di-ROLLBACK
--    otomatis oleh PostgreSQL.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_user_id         UUID,
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
  v_trx_id     UUID;
  v_trx_number TEXT;
  v_year_month TEXT;
  v_seq        INTEGER;
  v_item       JSONB;
  v_med_id     UUID;
  v_qty        INTEGER;
BEGIN
  v_year_month := TO_CHAR(NOW(), 'YYYY-MM');

  -- ── a. Generate nomor nota (thread-safe) ────────────────────
  -- INSERT ... ON CONFLICT DO UPDATE mengunci baris secara
  -- eksklusif hingga transaksi selesai — tidak ada race condition.
  INSERT INTO public.transaction_counters (user_id, year_month, seq)
  VALUES (p_user_id, v_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET seq = public.transaction_counters.seq + 1
  RETURNING seq INTO v_seq;

  v_trx_number := 'TRX/'
    || REPLACE(v_year_month, '-', '/')
    || '/'
    || LPAD(v_seq::TEXT, 4, '0');

  -- ── b. Insert transaksi ──────────────────────────────────────
  INSERT INTO public.transactions (
    user_id, total_amount, discount_total, payment_method,
    transaction_number, status,
    prescription_id, customer_name, customer_phone
  ) VALUES (
    p_user_id, p_total_amount, p_discount_total, p_payment_method,
    v_trx_number, 'active',
    p_prescription_id, p_customer_name, p_customer_phone
  )
  RETURNING id INTO v_trx_id;

  -- ── c+d+e. Items + stock decrement + audit ───────────────────
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

    -- Atomic stock decrement — UPDATE langsung tanpa fetch dulu
    -- GREATEST(0, ...) agar stok tidak pernah negatif
    UPDATE public.medicines
       SET stock      = GREATEST(0, stock - v_qty),
           updated_at = NOW()
     WHERE id = v_med_id;

    -- Stock movement log
    INSERT INTO public.stock_movements (
      medicine_id, user_id, type, quantity, reference_id
    ) VALUES (
      v_med_id, p_user_id, 'sale', v_qty, v_trx_id
    );
  END LOOP;

  -- ── f. Update status resep ───────────────────────────────────
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

-- Revoke public execute, hanya user terotentikasi
REVOKE EXECUTE ON FUNCTION public.process_checkout FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.process_checkout TO authenticated;
