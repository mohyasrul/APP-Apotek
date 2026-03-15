-- ================================================================
-- Hotfix: Perbaiki infinite recursion di RLS policy users table
-- Date: 2026-03-16b
--
-- Masalah: Policy dari 20260316 menggunakan subquery ke tabel users
-- itu sendiri → infinite recursion saat policy dievaluasi.
--
-- Solusi: Ganti subquery dengan get_effective_user_id() yang sudah
-- ada sebagai SECURITY DEFINER — fungsi ini bypass RLS saat berjalan
-- sehingga tidak ada rekursi.
-- ================================================================

DROP POLICY IF EXISTS "Users can read own and related rows" ON public.users;

-- get_effective_user_id() adalah SECURITY DEFINER → bypass RLS saat
-- membaca pharmacy_owner_id dari users table → NO RECURSION.
--
-- Coverage:
--   owner: id = auth.uid() (baris sendiri) + pharmacy_owner_id = auth.uid() (kasir miliknya)
--   kasir:  id = auth.uid() (baris sendiri) + id = get_effective_user_id() (baris owner mereka)
CREATE POLICY "Users can read own and related rows"
  ON public.users
  FOR SELECT
  USING (
    id = auth.uid()                        -- baca row sendiri
    OR pharmacy_owner_id = auth.uid()      -- owner baca kasir-kasirnya
    OR id = public.get_effective_user_id() -- kasir baca row owner (SECURITY DEFINER, no recursion)
  );
