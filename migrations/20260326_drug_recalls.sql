-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260326_drug_recalls.sql
-- Deskripsi: Tabel manajemen recall obat dari BPOM / distributor
--
-- Regulasi: Permenkes & Per-BPOM tentang penarikan obat.
-- Apotek wajib merespons recall BPOM dengan menarik obat dari rak dan
-- melaporkan sisa stok ke BPOM/distributor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.drug_recalls (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recall_number   TEXT        NOT NULL,          -- nomor recall/peringatan BPOM, mis. BPOM/PP/20260310/001
  medicine_name   TEXT        NOT NULL,          -- nama obat yang di-recall
  batch_numbers   TEXT        NOT NULL DEFAULT '*', -- nomor batch terdampak, '*' = semua batch
  manufacturer    TEXT,                          -- nama produsen / PBF
  bpom_notice     TEXT,                          -- isi pengumuman / instruksi recall dari BPOM
  recall_date     DATE        NOT NULL,          -- tanggal informasi recall diterima
  reason          TEXT        NOT NULL,          -- alasan recall (kualitas, keamanan, dll.)
  -- status: active = masih aktif ditangani
  --         quarantined = obat sudah dikarantina dari rak
  --         reported = sudah dilaporkan ke BPOM/distributor
  --         resolved = selesai (obat dikembalikan/dimusnahkan)
  status          TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'quarantined', 'reported', 'resolved')),
  -- Stok terdampak yang ditemukan
  stock_found     NUMERIC     NOT NULL DEFAULT 0,  -- jumlah stok terdampak yang ditemukan
  stock_unit      TEXT,
  -- Tindakan
  action_taken    TEXT,                            -- tindakan yang diambil (karantina, kembalikan, musnahkan)
  resolved_at     TIMESTAMPTZ,
  pic_name        TEXT        NOT NULL,            -- nama penanggung jawab / apoteker
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.drug_recalls IS 'Manajemen recall obat dari BPOM / distributor';
COMMENT ON COLUMN public.drug_recalls.recall_number  IS 'Nomor recall resmi dari BPOM atau distributor';
COMMENT ON COLUMN public.drug_recalls.batch_numbers  IS 'Nomor batch terdampak, gunakan * untuk semua batch';
COMMENT ON COLUMN public.drug_recalls.bpom_notice    IS 'Isi pengumuman/instruksi recall dari BPOM';
COMMENT ON COLUMN public.drug_recalls.status         IS 'Status penanganan: active | quarantined | reported | resolved';
COMMENT ON COLUMN public.drug_recalls.stock_found    IS 'Jumlah stok terdampak yang berhasil ditemukan di apotek';

-- Index untuk filter cepat per apotek
CREATE INDEX IF NOT EXISTS idx_drug_recalls_user_created
  ON public.drug_recalls (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drug_recalls_status
  ON public.drug_recalls (user_id, status);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_drug_recalls_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drug_recalls_updated_at ON public.drug_recalls;
CREATE TRIGGER trg_drug_recalls_updated_at
  BEFORE UPDATE ON public.drug_recalls
  FOR EACH ROW EXECUTE FUNCTION public.set_drug_recalls_updated_at();

-- Row Level Security
ALTER TABLE public.drug_recalls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their pharmacy drug recalls"
  ON public.drug_recalls FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());
