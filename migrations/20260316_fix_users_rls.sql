-- ================================================================
-- Fix: Users table RLS + accept_invite_by_token improvement
-- Date: 2026-03-16
--
-- Fixes:
--   1. RLS users table: owner tidak bisa baca kasir rows (B2 + B3)
--   2. accept_invite_by_token: copy pharmacy_name dari owner (B5)
-- ================================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Fix RLS SELECT policy pada tabel users
--
-- Masalah lama:
--   USING (id = public.get_effective_user_id())
--   → Untuk owner: hanya row dengan id = owner.id yang lolos
--   → Kasir rows (pharmacy_owner_id = owner.id) DIBLOKIR
--   → fetchTeam di Settings.tsx selalu return empty
--   → audit_logs EXISTS subquery juga gagal (ikut RLS ini)
--
-- Policy baru: konservatif, hanya buka akses yang logis
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users read effective pharmacy profile" ON public.users;

-- get_effective_user_id() adalah SECURITY DEFINER → bypass RLS saat
-- membaca pharmacy_owner_id dari users table → NO RECURSION.
--
-- Coverage:
--   owner: id = auth.uid() (baris sendiri) + pharmacy_owner_id = auth.uid() (kasir miliknya)
--   kasir:  id = auth.uid() (baris sendiri) + id = get_effective_user_id() (baris owner)
CREATE POLICY "Users can read own and related rows"
  ON public.users
  FOR SELECT
  USING (
    id = auth.uid()                        -- baca row sendiri
    OR pharmacy_owner_id = auth.uid()      -- owner baca kasir-kasirnya
    OR id = public.get_effective_user_id() -- kasir baca row owner (SECURITY DEFINER, no recursion)
  );


-- ─────────────────────────────────────────────────────────────
-- 2. Update RPC accept_invite_by_token
--    Perbaikan: saat INSERT kasir row baru, copy pharmacy_name
--    dari owner (bukan hardcode 'Kasir')
--    Sehingga TopNavigation kasir menampilkan nama apotek yang benar
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_invite_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv        public.invitations%ROWTYPE;
  v_user_id    UUID;
  v_user_email TEXT;
  v_owner_pharmacy_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesi tidak ditemukan. Silakan login terlebih dahulu.';
  END IF;

  -- Lock the row to prevent concurrent double-accepts
  SELECT * INTO v_inv
    FROM public.invitations
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan';
  END IF;

  IF v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Undangan sudah kadaluarsa';
  END IF;

  IF v_inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Undangan ini sudah pernah digunakan';
  END IF;

  -- Email check: only enforce if owner specified an email for this invite
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF v_inv.email IS NOT NULL AND LOWER(v_user_email) != LOWER(v_inv.email) THEN
    RAISE EXCEPTION 'Email akun Anda tidak sesuai dengan undangan ini (undangan untuk: %)',
      LEFT(v_inv.email, 2) || '***@' || SPLIT_PART(v_inv.email, '@', 2);
  END IF;

  -- Ambil pharmacy_name dari owner untuk ditampilkan di nav kasir
  SELECT pharmacy_name INTO v_owner_pharmacy_name
    FROM public.users
   WHERE id = v_inv.owner_id;

  -- Ensure profile row exists (handles brand-new signups with no row yet)
  -- Copy pharmacy_name dari owner agar TopNavigation kasir tampil benar
  INSERT INTO public.users (id, full_name, pharmacy_name, pharmacy_address, role)
  VALUES (
    v_user_id,
    SPLIT_PART(COALESCE(v_user_email, 'kasir'), '@', 1),
    COALESCE(v_owner_pharmacy_name, 'Apotek'),
    '-',
    'cashier'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Link kasir to owner, set role to cashier
  -- Juga update pharmacy_name jika kasir sudah punya row (existing account)
  UPDATE public.users
     SET pharmacy_owner_id = v_inv.owner_id,
         role              = 'cashier',
         pharmacy_name     = COALESCE(v_owner_pharmacy_name, pharmacy_name)
   WHERE id = v_user_id;

  -- Mark invite as consumed
  UPDATE public.invitations
     SET used_at = NOW(),
         used_by = v_user_id
   WHERE id = v_inv.id;

  RETURN json_build_object(
    'success',  true,
    'owner_id', v_inv.owner_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invite_by_token(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_invite_by_token(UUID) TO authenticated;
