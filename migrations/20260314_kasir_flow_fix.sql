-- ================================================================
-- Fix: Redesign Kasir Invitation Flow
-- Date: 2026-03-14
--
-- Changes:
--   1. remove_kasir(p_kasir_id) — SECURITY DEFINER RPC
--      Fixes RLS bug: owner can't directly update kasir's row.
--   2. revoke_invitation(p_invitation_id) — SECURITY DEFINER RPC
--      Allows owner to invalidate a pending invite.
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. remove_kasir
--    Called by owner to remove a kasir from their team.
--    Bypasses RLS by using SECURITY DEFINER.
--    Validates ownership before updating.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_kasir(p_kasir_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate: the kasir must actually belong to the calling owner
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_kasir_id
      AND pharmacy_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Kasir tidak ditemukan atau bukan anggota tim Anda';
  END IF;

  UPDATE public.users
     SET pharmacy_owner_id = NULL,
         role              = 'owner'
   WHERE id = p_kasir_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_kasir(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_kasir(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. revoke_invitation
--    Called by owner to cancel a pending invitation.
--    Sets expires_at to past time so the code becomes invalid.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invitations
    WHERE id = p_invitation_id
      AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan';
  END IF;

  UPDATE public.invitations
     SET expires_at = NOW() - INTERVAL '1 second'
   WHERE id = p_invitation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_invitation(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.revoke_invitation(UUID) TO authenticated;
