-- ============================================================
-- BPJS Klaim Management
-- Tabel untuk tracking klaim BPJS pasien apotek
-- (PRB - Program Rujuk Balik, Faskes 1, Umum BPJS)
-- ============================================================

-- Tabel utama klaim BPJS
CREATE TABLE IF NOT EXISTS bpjs_claims (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identitas klaim
  claim_number     TEXT        NOT NULL,          -- Nomor klaim internal (auto-generated)
  claim_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  claim_month      TEXT        NOT NULL,          -- YYYY-MM (periode klaim)

  -- Data pasien
  patient_name     TEXT        NOT NULL,
  bpjs_number      TEXT        NOT NULL,          -- Nomor kartu BPJS
  patient_nik      TEXT,
  diagnosis_code   TEXT,                          -- Kode ICD-10
  diagnosis_name   TEXT,
  doctor_name      TEXT,
  faskes_name      TEXT,                          -- Nama Faskes perujuk

  -- Jenis klaim
  claim_type       TEXT        NOT NULL DEFAULT 'prb'
                               CHECK (claim_type IN ('prb','faskes1','emergency','other')),

  -- Item klaim (JSON array of {medicine_name, qty, unit, unit_price, total})
  items            JSONB       NOT NULL DEFAULT '[]',
  total_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Status klaim
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','submitted','verified','rejected')),
  submitted_at     TIMESTAMPTZ,
  verified_at      TIMESTAMPTZ,
  rejection_reason TEXT,

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk performa
CREATE INDEX IF NOT EXISTS bpjs_claims_user_id_idx        ON bpjs_claims (user_id);
CREATE INDEX IF NOT EXISTS bpjs_claims_claim_month_idx    ON bpjs_claims (user_id, claim_month);
CREATE INDEX IF NOT EXISTS bpjs_claims_status_idx         ON bpjs_claims (user_id, status);
CREATE INDEX IF NOT EXISTS bpjs_claims_bpjs_number_idx    ON bpjs_claims (user_id, bpjs_number);

-- RLS
ALTER TABLE bpjs_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY bpjs_claims_owner ON bpjs_claims
  USING  (user_id = get_effective_user_id())
  WITH CHECK (user_id = get_effective_user_id());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_bpjs_claims_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bpjs_claims_updated_at
  BEFORE UPDATE ON bpjs_claims
  FOR EACH ROW EXECUTE FUNCTION update_bpjs_claims_updated_at();
