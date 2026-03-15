-- ================================================================
-- P2/P3 Features Migration
-- Date: 2026-03-13
-- Fixes / Features:
--   P2-E3: Fix audit_logs RLS SELECT policy
--          (owner bisa lihat log dari semua kasir di apoteknya)
--   P2-IX: Index tambahan untuk query audit_logs & stock_movements
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix audit_logs RLS SELECT policy (E3)
--
--    Policy lama bermasalah:
--      USING (user_id = get_effective_user_id() OR user_id = auth.uid())
--    → kasir tidak bisa lihat log owner, owner tidak bisa lihat log kasir
--
--    Policy baru:
--      - Setiap user bisa lihat log yang dibuat oleh dirinya sendiri
--      - Owner bisa lihat log dari semua kasir yang terdaftar di apoteknya
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view pharmacy audit logs" ON public.audit_logs;

CREATE POLICY "Users view pharmacy audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    -- Bisa lihat log sendiri
    user_id = auth.uid()
    OR
    -- Owner bisa lihat log kasir di apoteknya
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = audit_logs.user_id
         AND u.pharmacy_owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Index tambahan untuk performa query audit_logs & stock_movements
-- ─────────────────────────────────────────────────────────────

-- stock_movements per medicine — untuk modal riwayat stok
CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine
  ON public.stock_movements (medicine_id, created_at DESC);

-- audit_logs filter by entity_type
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
  ON public.audit_logs (entity_type, created_at DESC);

-- customers search by name/phone
CREATE INDEX IF NOT EXISTS idx_customers_name
  ON public.customers (user_id, name);
