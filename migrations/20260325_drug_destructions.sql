-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260325_drug_destructions.sql
-- Deskripsi: Tabel pemusnahan obat (Berita Acara Pemusnahan / BAP)
--
-- Sebelumnya PemusnahanObat.tsx menyimpan data di localStorage saja.
-- Migration ini membuat tabel permanen di Supabase sesuai PMK 73/2016 &
-- PMK 3/2015 (narkotika/psikotropika).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabel drug_destructions
--    Setiap baris adalah satu Berita Acara Pemusnahan (BAP).
--    Items disimpan sebagai JSONB agar sesuai dengan tipe DrugDestructionItem
--    di frontend tanpa memerlukan join tabel terpisah.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drug_destructions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  destruction_number  TEXT        NOT NULL,
  destruction_date    DATE        NOT NULL,
  -- status: draft → scheduled → completed
  status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'scheduled', 'completed')),
  penanggung_jawab    TEXT        NOT NULL,
  saksi_1             TEXT        NOT NULL,
  saksi_2             TEXT        NOT NULL,
  -- metode: dibakar, dikubur, dihancurkan, dilarutkan, lainnya
  metode              TEXT        NOT NULL DEFAULT 'dibakar',
  -- Array JSON: [{medicine_id, medicine_name, batch_number, expiry_date, quantity, unit, alasan}]
  items               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.drug_destructions                    IS 'Berita Acara Pemusnahan (BAP) obat sesuai PMK 73/2016 & PMK 3/2015';
COMMENT ON COLUMN public.drug_destructions.status             IS 'Alur: draft → scheduled → completed';
COMMENT ON COLUMN public.drug_destructions.items              IS '[{medicine_id, medicine_name, batch_number, expiry_date, quantity, unit, alasan}]';
COMMENT ON COLUMN public.drug_destructions.metode             IS 'Metode pemusnahan: dibakar, dikubur, dihancurkan, dilarutkan, lainnya';

-- Index
CREATE INDEX IF NOT EXISTS idx_drug_destructions_user_date
  ON public.drug_destructions (user_id, destruction_date DESC);

CREATE INDEX IF NOT EXISTS idx_drug_destructions_status
  ON public.drug_destructions (user_id, status);

-- Row Level Security
ALTER TABLE public.drug_destructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy drug destructions"
  ON public.drug_destructions FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());
