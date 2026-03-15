-- ============================================================
-- MVP Features Migration
-- Target: Apotek Kecil / Mandiri
-- Date: 2026-03-12
-- Features:
--   1. Nomor nota readable (TRX/YYYY/MM/NNNN)
--   2. SIA / SIPA di profil apotek
--   3. Void transaksi + revert stok
--   4. Modul resep minimal
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Users: tambah kolom informasi resmi apotek
-- ─────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sia_number      TEXT,
  ADD COLUMN IF NOT EXISTS sipa_number     TEXT,
  ADD COLUMN IF NOT EXISTS apoteker_name   TEXT;

COMMENT ON COLUMN public.users.sia_number    IS 'Nomor Surat Izin Apotek (SIA)';
COMMENT ON COLUMN public.users.sipa_number   IS 'Nomor Surat Izin Praktik Apoteker (SIPA)';
COMMENT ON COLUMN public.users.apoteker_name IS 'Nama Apoteker Penanggung Jawab';

-- ─────────────────────────────────────────────
-- 2. Transactions: tambah nomor nota & void support
-- ─────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_number TEXT,
  ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'active'
                                              CHECK (status IN ('active', 'voided')),
  ADD COLUMN IF NOT EXISTS voided_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason        TEXT,
  ADD COLUMN IF NOT EXISTS prescription_id    UUID;  -- FK ke prescriptions, nullable

-- Index nomor nota agar pencarian cepat
CREATE INDEX IF NOT EXISTS idx_transactions_number
  ON public.transactions (transaction_number)
  WHERE transaction_number IS NOT NULL;

-- Index status untuk filter active-only
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON public.transactions (user_id, status);

COMMENT ON COLUMN public.transactions.transaction_number IS 'Nomor nota readable, format TRX/YYYY/MM/NNNN';
COMMENT ON COLUMN public.transactions.status             IS 'Status transaksi: active | voided';

-- ─────────────────────────────────────────────
-- 3. RPC: generate_transaction_number
--    Format: TRX/2026/03/0001 (sequential per user per bulan)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_transaction_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year   TEXT;
  v_month  TEXT;
  v_seq    INTEGER;
  v_result TEXT;
BEGIN
  v_year  := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');

  SELECT COUNT(*) + 1
    INTO v_seq
    FROM public.transactions
   WHERE user_id = p_user_id
     AND TO_CHAR(created_at, 'YYYY-MM') = v_year || '-' || v_month;

  v_result := 'TRX/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_result;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. RPC: void_transaction
--    - Set status = voided
--    - Kembalikan stok semua item via increment_stock
--    - Catat ke stock_movements type = 'void_return'
-- ─────────────────────────────────────────────
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
  -- Verifikasi kepemilikan & status
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

  -- Update status transaksi
  UPDATE public.transactions
     SET status      = 'voided',
         voided_at   = NOW(),
         void_reason = p_reason
   WHERE id = p_transaction_id;

  -- Loop items: kembalikan stok & catat movement
  FOR v_item IN
    SELECT medicine_id, quantity
      FROM public.transaction_items
     WHERE transaction_id = p_transaction_id
  LOOP
    -- Kembalikan stok
    UPDATE public.medicines
       SET stock      = stock + v_item.quantity,
           updated_at = NOW()
     WHERE id = v_item.medicine_id;

    -- Catat stock movement
    INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id, notes)
    VALUES (
      v_item.medicine_id,
      p_user_id,
      'void_return',
      v_item.quantity,
      p_transaction_id,
      'Pembatalan transaksi: ' || COALESCE(p_reason, '-')
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. Update RPC get_total_laba: exclude voided transactions
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_total_laba(
  p_user_id   UUID,
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
    COALESCE(SUM(
      (SELECT SUM((ti.price_at_transaction - m.buy_price) * ti.quantity)
         FROM public.transaction_items ti
         JOIN public.medicines m ON m.id = ti.medicine_id
        WHERE ti.transaction_id = t.id)
    ), 0),
    COUNT(t.id)
  INTO v_omset, v_laba_kotor, v_trx_count
  FROM public.transactions t
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

-- ─────────────────────────────────────────────
-- 6. Update RPC get_dashboard_metrics: exclude voided
-- ─────────────────────────────────────────────
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
  v_items_sold      INTEGER := 0;
  v_critical_stock  INTEGER := 0;
  v_expiry_count    INTEGER := 0;
BEGIN
  -- Sales metrics (active only)
  SELECT
    COALESCE(SUM(t.total_amount), 0),
    COUNT(t.id),
    COALESCE(SUM(
      (SELECT SUM(ti.quantity) FROM public.transaction_items ti WHERE ti.transaction_id = t.id)
    ), 0)
  INTO v_total_sales, v_total_trx, v_items_sold
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.status = 'active'
    AND (p_start_date IS NULL OR t.created_at >= p_start_date);

  -- Critical stock count
  SELECT COUNT(*)
    INTO v_critical_stock
    FROM public.medicines
   WHERE user_id = p_user_id
     AND stock < min_stock;

  -- Expiry warning count (within 90 days)
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

-- ─────────────────────────────────────────────
-- 7. Tabel prescriptions (Resep Minimal)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prescription_number TEXT NOT NULL,                -- No. resep dari dokter
  patient_name        TEXT NOT NULL,
  patient_age         INTEGER,
  doctor_name         TEXT NOT NULL,
  doctor_sip          TEXT,                          -- Nomor SIP dokter
  prescription_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  transaction_id      UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 8. Tabel prescription_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id     UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_name       TEXT NOT NULL,                 -- nama obat dari dokter
  medicine_id         UUID REFERENCES public.medicines(id) ON DELETE SET NULL,
  signa               TEXT,                          -- aturan pakai, mis: "3x1 sesudah makan"
  quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  dispensed_quantity  INTEGER NOT NULL DEFAULT 0,    -- qty yang sudah ditebus
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_user_status
  ON public.prescriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
  ON public.prescriptions (user_id, patient_name);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription
  ON public.prescription_items (prescription_id);

-- Fungsi untuk auto-update updated_at (buat jika belum ada)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Auto-update updated_at trigger untuk prescriptions
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────
-- 9. RLS Policies: prescriptions
-- ─────────────────────────────────────────────
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prescriptions"
  ON public.prescriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 10. RLS Policies: prescription_items
-- ─────────────────────────────────────────────
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prescription items"
  ON public.prescription_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
       WHERE p.id = prescription_id
         AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
       WHERE p.id = prescription_id
         AND p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 11. Update stock_movements type constraint untuk void_return
-- ─────────────────────────────────────────────
-- Drop existing check if any, re-add with void_return
DO $$
BEGIN
  -- Hapus constraint lama jika ada (untuk idempotency)
  ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
  -- Tambah constraint baru dengan jenis tambahan
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_type_check
    CHECK (type IN ('sale', 'restock', 'adjustment', 'expired_removal', 'void_return'));
EXCEPTION
  WHEN others THEN
    -- Jika tabel belum ada constraint, lanjut saja
    NULL;
END;
$$;
