-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260325_missing_tables.sql
-- Deskripsi: Menambahkan tabel dan kolom yang dibutuhkan frontend namun
--            belum ada di database.
--
-- Gap yang ditemukan dari analisis frontend-backend:
--   1. Kolom users: sia_expiry_date, sipa_expiry_date, stra_expiry_date, receipt_width
--   2. Tabel: konseling_pio   (halaman Konseling / PIO)
--   3. Tabel: racikan_formula (halaman Racikan)
--   4. Tabel: meso_reports    (halaman MESO / ESO)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tambah kolom pada tabel users
--    - sia_expiry_date  : tanggal kadaluarsa SIA apotik
--    - sipa_expiry_date : tanggal kadaluarsa SIPA apoteker
--    - stra_expiry_date : tanggal kadaluarsa STRA
--    - receipt_width    : lebar struk cetak ('58mm' | '80mm' | 'A4')
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sia_expiry_date   DATE,
  ADD COLUMN IF NOT EXISTS sipa_expiry_date  DATE,
  ADD COLUMN IF NOT EXISTS stra_expiry_date  DATE,
  ADD COLUMN IF NOT EXISTS receipt_width     TEXT DEFAULT '58mm'
    CHECK (receipt_width IN ('58mm', '80mm', 'A4'));

COMMENT ON COLUMN public.users.sia_expiry_date  IS 'Tanggal kadaluarsa Surat Izin Apotek (SIA)';
COMMENT ON COLUMN public.users.sipa_expiry_date IS 'Tanggal kadaluarsa Surat Izin Praktik Apoteker (SIPA)';
COMMENT ON COLUMN public.users.stra_expiry_date IS 'Tanggal kadaluarsa Surat Tanda Registrasi Apoteker (STRA)';
COMMENT ON COLUMN public.users.receipt_width    IS 'Lebar kertas struk: 58mm, 80mm, atau A4';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tabel konseling_pio
--    Mencatat kegiatan Pelayanan Informasi Obat (PIO) dan konseling pasien
--    sesuai PMK No. 73 Tahun 2016 tentang Standar Pelayanan Kefarmasian
--    di Apotek.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.konseling_pio (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal             DATE        NOT NULL,
  patient_name        TEXT        NOT NULL,
  patient_phone       TEXT,
  prescription_number TEXT,
  medicines           TEXT        NOT NULL,  -- deskripsi obat yang dikonseling
  informasi           TEXT        NOT NULL,  -- informasi / PIO yang diberikan
  catatan             TEXT,
  petugas             TEXT        NOT NULL,  -- nama apoteker / TTK yang melayani
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.konseling_pio             IS 'Dokumentasi kegiatan konseling dan PIO sesuai PMK 73/2016';
COMMENT ON COLUMN public.konseling_pio.medicines   IS 'Deskripsi obat-obatan yang dikonseling';
COMMENT ON COLUMN public.konseling_pio.informasi   IS 'Informasi yang diberikan kepada pasien/keluarga';
COMMENT ON COLUMN public.konseling_pio.petugas     IS 'Nama apoteker / TTK yang memberikan konseling';

-- Index untuk mempercepat query per apotek
CREATE INDEX IF NOT EXISTS idx_konseling_pio_user_tanggal
  ON public.konseling_pio (user_id, tanggal DESC);

-- Row Level Security
ALTER TABLE public.konseling_pio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy konseling pio records"
  ON public.konseling_pio FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Tabel racikan_formula
--    Menyimpan formula/template racikan obat yang sering dibuat,
--    memungkinkan apoteker menyimpan komposisi bahan dan signa standar.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.racikan_formula (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nama_racikan   TEXT        NOT NULL,
  -- Jenis sediaan: puyer, kapsul, krim, salep, sirup, lainnya
  jenis          TEXT        NOT NULL DEFAULT 'puyer'
                   CHECK (jenis IN ('puyer', 'kapsul', 'krim', 'salep', 'sirup', 'lainnya')),
  jumlah_bungkus INTEGER     NOT NULL DEFAULT 1,
  signa          TEXT        NOT NULL,  -- aturan pakai, misal: "3 x 1 bungkus"
  notes          TEXT,
  biaya_racik    NUMERIC     NOT NULL DEFAULT 0,
  -- Array objek JSON dengan struktur: [{medicine_id, name, unit, qty_per_bungkus, sell_price}]
  ingredients    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.racikan_formula              IS 'Template / formula racikan obat';
COMMENT ON COLUMN public.racikan_formula.jenis        IS 'Bentuk sediaan: puyer, kapsul, krim, salep, sirup, lainnya';
COMMENT ON COLUMN public.racikan_formula.ingredients  IS 'Komposisi bahan: [{medicine_id, name, unit, qty_per_bungkus, sell_price}]';
COMMENT ON COLUMN public.racikan_formula.biaya_racik  IS 'Biaya jasa racikan (tidak termasuk harga bahan)';

-- Index
CREATE INDEX IF NOT EXISTS idx_racikan_formula_user_created
  ON public.racikan_formula (user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.racikan_formula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy racikan formulas"
  ON public.racikan_formula FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Tabel meso_reports
--    Monitoring Efek Samping Obat (MESO) / Laporan ESO.
--    Digunakan untuk pelaporan efek samping obat kepada BPOM sesuai
--    Peraturan BPOM No. 2 Tahun 2022 tentang Pengawasan Obat.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meso_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal           DATE        NOT NULL,
  patient_name      TEXT        NOT NULL,
  patient_age       TEXT,        -- tersimpan sebagai teks karena bisa "35 tahun", "3 bulan", dsb
  patient_gender    TEXT,        -- 'laki-laki' | 'perempuan'
  medicine_name     TEXT        NOT NULL,
  batch_number      TEXT,
  indication        TEXT        NOT NULL,  -- indikasi penggunaan obat
  reaction          TEXT        NOT NULL,  -- reaksi / efek samping yang terjadi
  -- severity: ringan, sedang, berat, mengancam_jiwa
  severity          TEXT        NOT NULL DEFAULT 'ringan'
                      CHECK (severity IN ('ringan', 'sedang', 'berat', 'mengancam_jiwa')),
  onset             TEXT        NOT NULL,  -- waktu muncul reaksi
  action_taken      TEXT        NOT NULL,  -- tindakan yang diambil
  outcome           TEXT        NOT NULL,  -- kondisi akhir pasien
  reported_to_bpom  BOOLEAN     NOT NULL DEFAULT FALSE,
  reporter_name     TEXT        NOT NULL,  -- nama apoteker pelapor
  catatan           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.meso_reports                  IS 'Laporan Monitoring Efek Samping Obat (MESO / ESO) sesuai BPOM';
COMMENT ON COLUMN public.meso_reports.severity         IS 'Tingkat keparahan: ringan, sedang, berat, mengancam_jiwa';
COMMENT ON COLUMN public.meso_reports.reported_to_bpom IS 'Apakah sudah dilaporkan ke BPOM';
COMMENT ON COLUMN public.meso_reports.onset            IS 'Waktu munculnya reaksi (misal: 30 menit setelah konsumsi)';
COMMENT ON COLUMN public.meso_reports.action_taken     IS 'Tindakan yang dilakukan (hentikan obat, rujuk, dsb)';

-- Index
CREATE INDEX IF NOT EXISTS idx_meso_reports_user_tanggal
  ON public.meso_reports (user_id, tanggal DESC);

-- Row Level Security
ALTER TABLE public.meso_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy meso reports"
  ON public.meso_reports FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());
