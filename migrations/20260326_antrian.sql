-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260326_antrian.sql
-- Deskripsi: Tabel antrian sederhana untuk pengelolaan nomor antrian pasien
--
-- Fitur:
--   - Nomor antrian per hari per apotek (reset setiap hari)
--   - Jenis layanan: resep, konsultasi, umum
--   - Status: waiting | preparing | ready | taken
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.queue_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  queue_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  queue_number    INTEGER     NOT NULL,  -- nomor antrian per hari (001, 002, ...)
  patient_name    TEXT        NOT NULL DEFAULT 'Pasien',
  patient_phone   TEXT,
  -- jenis layanan: resep (penebusan resep), racikan (resep racikan), konsultasi, umum
  service_type    TEXT        NOT NULL DEFAULT 'umum'
                    CHECK (service_type IN ('resep', 'racikan', 'konsultasi', 'umum')),
  -- status antrian
  status          TEXT        NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'preparing', 'ready', 'taken', 'cancelled')),
  notes           TEXT,
  called_at       TIMESTAMPTZ,    -- waktu nomor dipanggil/diproses
  ready_at        TIMESTAMPTZ,    -- waktu obat siap
  taken_at        TIMESTAMPTZ,    -- waktu pasien mengambil
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.queue_entries IS 'Antrian pasien harian (resep, racikan, konsultasi, umum)';
COMMENT ON COLUMN public.queue_entries.queue_number  IS 'Nomor antrian harian, reset setiap hari';
COMMENT ON COLUMN public.queue_entries.service_type  IS 'Jenis layanan: resep | racikan | konsultasi | umum';
COMMENT ON COLUMN public.queue_entries.status        IS 'Status: waiting | preparing | ready | taken | cancelled';
COMMENT ON COLUMN public.queue_entries.called_at     IS 'Waktu nomor antrian dipanggil untuk diproses';
COMMENT ON COLUMN public.queue_entries.ready_at      IS 'Waktu obat/layanan siap diambil';
COMMENT ON COLUMN public.queue_entries.taken_at      IS 'Waktu pasien mengambil obat/selesai dilayani';

-- Unique constraint: satu nomor antrian per hari per apotek
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entries_unique_num
  ON public.queue_entries (user_id, queue_date, queue_number);

-- Index untuk list antrian harian
CREATE INDEX IF NOT EXISTS idx_queue_entries_daily
  ON public.queue_entries (user_id, queue_date DESC, queue_number ASC);

-- Row Level Security
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their pharmacy queue entries"
  ON public.queue_entries FOR ALL
  USING  (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- Function: get next queue number for today
CREATE OR REPLACE FUNCTION public.get_next_queue_number(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_max INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0)
  INTO v_max
  FROM public.queue_entries
  WHERE user_id = p_user_id
    AND queue_date = CURRENT_DATE;

  RETURN v_max + 1;
END;
$$;

COMMENT ON FUNCTION public.get_next_queue_number IS 'Mengembalikan nomor antrian berikutnya untuk hari ini';
