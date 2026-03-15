-- ================================================================
-- Fase 3–5 Features Migration
-- Target: MediSir Apotek SaaS
-- Date: 2026-03-12
-- Features:
--   3.1  Kasir management (multi-user per apotek)
--   3.2  Customers table + capture di POS
--   4.4  Audit logs untuk perubahan obat
--   4.5  valid_until di prescriptions
--   5.2  Medicine alternatives table
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. pharmacy_owner_id — hubungkan kasir ke owner
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pharmacy_owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.users.pharmacy_owner_id IS
  'Jika di-set, user ini adalah kasir milik apotek yang di-reference. NULL = owner.';

-- ─────────────────────────────────────────────────────────────
-- 2. get_effective_user_id()
--    Mengembalikan owner_id jika user adalah kasir,
--    mengembalikan uid sendiri jika user adalah owner.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_effective_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT pharmacy_owner_id FROM public.users WHERE id = auth.uid()),
    auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Update semua RLS policies agar kasir bisa akses data owner
-- ─────────────────────────────────────────────────────────────

-- 3a. users: kasir bisa baca profil owner-nya
DROP POLICY IF EXISTS "Users can only see and update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users manage own profile" ON public.users;
DROP POLICY IF EXISTS "Cashier can read owner profile" ON public.users;

CREATE POLICY "Users manage own profile"
  ON public.users FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users read effective pharmacy profile"
  ON public.users FOR SELECT
  USING (id = public.get_effective_user_id());

-- 3b. medicines
DROP POLICY IF EXISTS "Users can manage medicines of their pharmacy" ON public.medicines;
DROP POLICY IF EXISTS "Users manage own pharmacy medicines" ON public.medicines;

CREATE POLICY "Users manage pharmacy medicines"
  ON public.medicines FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- 3c. transactions
DROP POLICY IF EXISTS "Users can manage transactions of their pharmacy" ON public.transactions;
DROP POLICY IF EXISTS "Users manage own pharmacy transactions" ON public.transactions;

CREATE POLICY "Users manage pharmacy transactions"
  ON public.transactions FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- 3d. transaction_items (via transactions join)
DROP POLICY IF EXISTS "Users can manage transaction items of their pharmacy" ON public.transaction_items;
DROP POLICY IF EXISTS "Users manage own pharmacy transaction_items" ON public.transaction_items;

CREATE POLICY "Users manage pharmacy transaction items"
  ON public.transaction_items FOR ALL
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE user_id = public.get_effective_user_id()
    )
  )
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE user_id = public.get_effective_user_id()
    )
  );

-- 3e. stock_movements
DROP POLICY IF EXISTS "Users can manage stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users manage own pharmacy stock movements" ON public.stock_movements;

CREATE POLICY "Users manage pharmacy stock movements"
  ON public.stock_movements FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- 3f. prescriptions
DROP POLICY IF EXISTS "Users manage own prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Users manage prescriptions" ON public.prescriptions;

CREATE POLICY "Users manage pharmacy prescriptions"
  ON public.prescriptions FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- 3g. prescription_items
DROP POLICY IF EXISTS "Users manage own prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Users manage prescription items" ON public.prescription_items;

CREATE POLICY "Users manage pharmacy prescription items"
  ON public.prescription_items FOR ALL
  USING (
    prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE user_id = public.get_effective_user_id()
    )
  )
  WITH CHECK (
    prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE user_id = public.get_effective_user_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Tabel invitations — undang kasir via email
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('cashier')),
  code        TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own invitations"
  ON public.invitations FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invitations_code
  ON public.invitations (code) WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_owner
  ON public.invitations (owner_id);

-- RPC: buat kode undangan (dipanggil oleh owner)
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
  -- Batalkan undangan lama yang belum dipakai untuk email yang sama
  UPDATE public.invitations
     SET expires_at = NOW() - INTERVAL '1 second'
   WHERE owner_id = v_owner_id
     AND email    = LOWER(TRIM(p_email))
     AND used_at IS NULL;

  -- Buat kode 8 karakter unik
  LOOP
    v_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invitations WHERE code = v_code);
  END LOOP;

  INSERT INTO public.invitations (owner_id, email, role, code)
  VALUES (v_owner_id, LOWER(TRIM(p_email)), p_role, v_code);

  RETURN v_code;
END;
$$;

-- RPC: terima undangan (dipanggil oleh kasir yang baru daftar)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite     public.invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  SELECT * INTO v_invite
    FROM public.invitations
   WHERE code     = UPPER(TRIM(p_code))
     AND used_at  IS NULL
     AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kode undangan tidak valid atau sudah kadaluarsa';
  END IF;

  SELECT email INTO v_user_email
    FROM auth.users
   WHERE id = auth.uid();

  IF LOWER(v_user_email) != v_invite.email THEN
    RAISE EXCEPTION 'Email Anda tidak sesuai dengan undangan ini';
  END IF;

  -- Hubungkan kasir ke owner
  UPDATE public.users
     SET pharmacy_owner_id = v_invite.owner_id,
         role              = v_invite.role
   WHERE id = auth.uid();

  -- Tandai undangan sudah digunakan
  UPDATE public.invitations
     SET used_at  = NOW(),
         used_by  = auth.uid()
   WHERE id = v_invite.id;

  RETURN json_build_object('success', true, 'role', v_invite.role);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Tabel customers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy customers"
  ON public.customers FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

CREATE INDEX IF NOT EXISTS idx_customers_pharmacy
  ON public.customers (user_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON public.customers (user_id, phone)
  WHERE phone IS NOT NULL;

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tambah customer_id + customer_name ke transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS customer_id   UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

COMMENT ON COLUMN public.transactions.customer_name IS
  'Nama pelanggan (denormalisasi untuk kecepatan, bisa berbeda dari customers.name jika customer dihapus)';

-- ─────────────────────────────────────────────────────────────
-- 6. Tabel audit_logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action      TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  entity_name TEXT,
  before_data JSONB,
  after_data  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view pharmacy audit logs"
  ON public.audit_logs FOR SELECT
  USING (user_id = public.get_effective_user_id() OR user_id = auth.uid());

CREATE POLICY "Users insert pharmacy audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON public.audit_logs (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 7. valid_until di prescriptions (4.5)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Default: 30 hari dari tanggal resep untuk baris yang sudah ada
UPDATE public.prescriptions
   SET valid_until = (prescription_date + INTERVAL '30 days')::DATE
 WHERE valid_until IS NULL;

COMMENT ON COLUMN public.prescriptions.valid_until IS
  'Batas waktu penebusan resep. Default: 30 hari dari prescription_date.';

-- ─────────────────────────────────────────────────────────────
-- 8. medicine_alternatives (5.2)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicine_alternatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  medicine_id     UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  alternative_id  UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (medicine_id, alternative_id),
  CHECK (medicine_id != alternative_id)
);

ALTER TABLE public.medicine_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage medicine alternatives"
  ON public.medicine_alternatives FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

CREATE INDEX IF NOT EXISTS idx_med_alt_medicine
  ON public.medicine_alternatives (user_id, medicine_id);

-- ─────────────────────────────────────────────────────────────
-- 9. Update RPCs untuk multi-user (tetap kompatibel)
-- ─────────────────────────────────────────────────────────────

-- generate_transaction_number: gunakan effective user id agar kasir
-- tetap membuat nomor nota di bawah apotek owner
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
