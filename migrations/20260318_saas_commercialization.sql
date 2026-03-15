-- ================================================================
-- SaaS Commercialization Migration
-- Date: 2026-03-18
--
-- Phase 1: Compliance & Clinical Guardrails
-- Phase 2: Inventory Traceability (Batch/Lot, FEFO, Stock Opname)
-- Phase 3: Security Hardening
-- Phase 4: SaaS Core Platform (Subscriptions, Entitlements)
-- ================================================================

-- ═══════════════════════════════════════════════════════════════
-- PHASE 1: COMPLIANCE & CLINICAL GUARDRAILS
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1.1 Medicine category constraints for dispensing rules
--     Categories: bebas, bebas_terbatas, keras, narkotika, psikotropika
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_category_check;
  ALTER TABLE public.medicines
    ADD CONSTRAINT medicines_category_check
    CHECK (category IN ('bebas', 'bebas_terbatas', 'keras', 'narkotika', 'psikotropika', 'vitamin', 'alkes', 'umum', 'resep'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 1.2 Dispensing rules table — configurable per-pharmacy
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispensing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  requires_prescription BOOLEAN NOT NULL DEFAULT false,
  max_qty_without_prescription INTEGER,  -- NULL = unlimited
  requires_apoteker_approval BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.dispensing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy dispensing rules"
  ON public.dispensing_rules FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- Insert default rules for existing pharmacies
INSERT INTO public.dispensing_rules (user_id, category, requires_prescription, requires_apoteker_approval)
SELECT DISTINCT u.id, cat.category, cat.req_resep, cat.req_apt
FROM public.users u
CROSS JOIN (VALUES
  ('keras', true, false),
  ('narkotika', true, true),
  ('psikotropika', true, true),
  ('resep', true, false)
) AS cat(category, req_resep, req_apt)
WHERE u.role = 'owner'
ON CONFLICT (user_id, category) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 1.3 Enhanced audit_logs — immutable high-risk action log
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS actor_role TEXT;

-- Prevent deletion of audit logs (immutable)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be deleted for compliance reasons';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_deletion();

-- Prevent update of audit logs (immutable)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified for compliance reasons';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();

-- ─────────────────────────────────────────────────────────────
-- 1.4 Void transaction — role-restricted
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_transaction(
  p_transaction_id UUID,
  p_user_id        UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item       RECORD;
  v_status     TEXT;
  v_actor_role TEXT;
  v_actor_id   UUID := auth.uid();
  v_trx_number TEXT;
  v_trx_age    INTERVAL;
BEGIN
  -- Get actor role
  SELECT role INTO v_actor_role FROM public.users WHERE id = v_actor_id;

  -- Verify ownership & status
  SELECT status, transaction_number, NOW() - created_at
    INTO v_status, v_trx_number, v_trx_age
    FROM public.transactions
   WHERE id = p_transaction_id
     AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan atau bukan milik Anda';
  END IF;

  IF v_status = 'voided' THEN
    RAISE EXCEPTION 'Transaksi sudah pernah dibatalkan';
  END IF;

  -- Kasir can only void within 2 hours, owner within 36 hours
  IF v_actor_role = 'cashier' AND v_trx_age > INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'Kasir hanya bisa membatalkan transaksi dalam 2 jam. Hubungi owner.';
  END IF;

  IF v_trx_age > INTERVAL '36 hours' THEN
    RAISE EXCEPTION 'Transaksi lebih dari 36 jam tidak bisa dibatalkan.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
  END IF;

  -- Update transaction status
  UPDATE public.transactions
     SET status      = 'voided',
         voided_at   = NOW(),
         void_reason = p_reason
   WHERE id = p_transaction_id;

  -- Loop items: restore stock & log movement
  FOR v_item IN
    SELECT medicine_id, quantity
      FROM public.transaction_items
     WHERE transaction_id = p_transaction_id
  LOOP
    UPDATE public.medicines
       SET stock      = stock + v_item.quantity,
           updated_at = NOW()
     WHERE id = v_item.medicine_id;

    IF NOT FOUND THEN
      INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id, notes)
      VALUES (v_item.medicine_id, p_user_id, 'void_return', v_item.quantity,
              p_transaction_id, 'PERINGATAN: obat sudah dihapus, stok tidak bisa dikembalikan');
      CONTINUE;
    END IF;

    INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id, notes)
    VALUES (v_item.medicine_id, p_user_id, 'void_return', v_item.quantity,
            p_transaction_id, 'Pembatalan transaksi: ' || COALESCE(p_reason, '-'));
  END LOOP;

  -- Immutable audit log for void
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, entity_name, severity, actor_role, after_data)
  VALUES (v_actor_id, 'delete', 'transaction', p_transaction_id, v_trx_number, 'critical', v_actor_role,
          jsonb_build_object('reason', p_reason, 'voided_by', v_actor_id, 'voided_at', NOW()));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1.5 process_checkout — dispensing validation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_total_amount    NUMERIC,
  p_discount_total  NUMERIC,
  p_payment_method  TEXT,
  p_items           JSONB,
  p_prescription_id UUID    DEFAULT NULL,
  p_customer_name   TEXT    DEFAULT NULL,
  p_customer_phone  TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id      UUID;
  v_actor_id     UUID := auth.uid();
  v_actor_role   TEXT;
  v_trx_id       UUID;
  v_trx_number   TEXT;
  v_year_month   TEXT;
  v_seq          INTEGER;
  v_item         JSONB;
  v_med_id       UUID;
  v_qty          INTEGER;
  v_current_stock INTEGER;
  v_med_name     TEXT;
  v_med_category TEXT;
  v_rule_requires_rx BOOLEAN;
BEGIN
  -- SECURITY: derive user_id from auth context
  v_user_id := public.get_effective_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi';
  END IF;

  SELECT role INTO v_actor_role FROM public.users WHERE id = v_actor_id;

  -- INPUT VALIDATION
  IF p_total_amount < 0 THEN
    RAISE EXCEPTION 'Total amount tidak boleh negatif';
  END IF;

  IF p_discount_total < 0 THEN
    RAISE EXCEPTION 'Diskon tidak boleh negatif';
  END IF;

  IF p_payment_method NOT IN ('cash', 'qris', 'transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid: %', p_payment_method;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Item transaksi tidak boleh kosong';
  END IF;

  -- PRE-VALIDATE: check dispensing rules for restricted categories
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id := (v_item->>'medicine_id')::UUID;

    SELECT category INTO v_med_category
      FROM public.medicines
     WHERE id = v_med_id AND user_id = v_user_id;

    -- Check if medicine category requires prescription
    SELECT requires_prescription INTO v_rule_requires_rx
      FROM public.dispensing_rules
     WHERE user_id = v_user_id AND category = v_med_category;

    IF v_rule_requires_rx IS TRUE AND p_prescription_id IS NULL THEN
      SELECT name INTO v_med_name FROM public.medicines WHERE id = v_med_id;
      RAISE EXCEPTION 'Obat "%" kategori "%" wajib ada resep dokter', v_med_name, v_med_category;
    END IF;
  END LOOP;

  v_year_month := TO_CHAR(NOW(), 'YYYY-MM');

  -- Generate nomor nota (thread-safe)
  INSERT INTO public.transaction_counters (user_id, year_month, seq)
  VALUES (v_user_id, v_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET seq = public.transaction_counters.seq + 1
  RETURNING seq INTO v_seq;

  v_trx_number := 'TRX/'
    || REPLACE(v_year_month, '-', '/')
    || '/'
    || LPAD(v_seq::TEXT, 4, '0');

  -- Insert transaksi
  INSERT INTO public.transactions (
    user_id, total_amount, discount_total, payment_method,
    transaction_number, status,
    prescription_id, customer_name, customer_phone
  ) VALUES (
    v_user_id, p_total_amount, p_discount_total, p_payment_method,
    v_trx_number, 'active',
    p_prescription_id, p_customer_name, p_customer_phone
  )
  RETURNING id INTO v_trx_id;

  -- Single loop: validate (FOR UPDATE) + insert + decrement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_med_id := (v_item->>'medicine_id')::UUID;
    v_qty    := (v_item->>'quantity')::INTEGER;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah harus positif untuk obat %', v_med_id;
    END IF;

    -- Lock row + validate stock (FOR UPDATE prevents concurrent oversell)
    SELECT stock, name INTO v_current_stock, v_med_name
      FROM public.medicines
     WHERE id = v_med_id AND user_id = v_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Obat dengan ID % tidak ditemukan', v_med_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok "%" tidak mencukupi. Tersedia: %, diminta: %',
        v_med_name, v_current_stock, v_qty;
    END IF;

    INSERT INTO public.transaction_items (
      transaction_id, medicine_id, quantity,
      price_at_transaction, discount_amount
    ) VALUES (
      v_trx_id, v_med_id, v_qty,
      (v_item->>'price_at_transaction')::NUMERIC,
      COALESCE((v_item->>'discount_amount')::NUMERIC, 0)
    );

    UPDATE public.medicines
       SET stock = stock - v_qty, updated_at = NOW()
     WHERE id = v_med_id AND user_id = v_user_id;

    INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id)
    VALUES (v_med_id, v_user_id, 'sale', v_qty, v_trx_id);
  END LOOP;

  -- Update prescription status
  IF p_prescription_id IS NOT NULL THEN
    UPDATE public.prescriptions
       SET status         = 'dispensed',
           transaction_id = v_trx_id,
           updated_at     = NOW()
     WHERE id = p_prescription_id;
  END IF;

  -- Audit log for checkout
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, entity_name, severity, actor_role, after_data)
  VALUES (v_actor_id, 'create', 'transaction', v_trx_id, v_trx_number, 'info', v_actor_role,
          jsonb_build_object('total', p_total_amount, 'items_count', jsonb_array_length(p_items), 'payment', p_payment_method));

  RETURN json_build_object(
    'transaction_id',     v_trx_id,
    'transaction_number', v_trx_number
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_checkout(NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.process_checkout(NUMERIC, NUMERIC, TEXT, JSONB, UUID, TEXT, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- PHASE 2: INVENTORY TRACEABILITY
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 2.1 Medicine batches table (lot/batch tracking)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id   UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  batch_number  TEXT NOT NULL,
  expiry_date   DATE NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  buy_price     NUMERIC NOT NULL DEFAULT 0,
  received_at   TIMESTAMPTZ DEFAULT NOW(),
  supplier      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (medicine_id, batch_number)
);

ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy medicine batches"
  ON public.medicine_batches FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

CREATE INDEX IF NOT EXISTS idx_medicine_batches_medicine
  ON public.medicine_batches (medicine_id, expiry_date ASC);

CREATE INDEX IF NOT EXISTS idx_medicine_batches_user_expiry
  ON public.medicine_batches (user_id, expiry_date ASC)
  WHERE quantity > 0;

-- ─────────────────────────────────────────────────────────────
-- 2.2 Stock opname (physical inventory count)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opname_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
  approved_by   UUID REFERENCES public.users(id),
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy stock opnames"
  ON public.stock_opnames FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());

-- ─────────────────────────────────────────────────────────────
-- 2.3 Stock opname items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id     UUID NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  medicine_id   UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  system_stock  INTEGER NOT NULL,     -- stock in system at time of opname
  physical_stock INTEGER NOT NULL,    -- actual counted stock
  difference    INTEGER GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage pharmacy stock opname items"
  ON public.stock_opname_items FOR ALL
  USING (
    opname_id IN (
      SELECT id FROM public.stock_opnames
      WHERE user_id = public.get_effective_user_id()
    )
  )
  WITH CHECK (
    opname_id IN (
      SELECT id FROM public.stock_opnames
      WHERE user_id = public.get_effective_user_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2.4 RPC: approve stock opname (owner only, applies adjustments)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_stock_opname(p_opname_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_actor_role TEXT;
  v_user_id    UUID;
  v_status     TEXT;
  v_item       RECORD;
BEGIN
  SELECT role INTO v_actor_role FROM public.users WHERE id = v_actor_id;
  IF v_actor_role != 'owner' THEN
    RAISE EXCEPTION 'Hanya owner yang bisa menyetujui stock opname';
  END IF;

  SELECT user_id, status INTO v_user_id, v_status
    FROM public.stock_opnames
   WHERE id = p_opname_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock opname tidak ditemukan';
  END IF;

  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'Stock opname sudah disetujui sebelumnya';
  END IF;

  -- Apply adjustments
  FOR v_item IN
    SELECT soi.medicine_id, soi.physical_stock, soi.system_stock, soi.difference, soi.notes
      FROM public.stock_opname_items soi
     WHERE soi.opname_id = p_opname_id
       AND soi.difference != 0
  LOOP
    UPDATE public.medicines
       SET stock = v_item.physical_stock, updated_at = NOW()
     WHERE id = v_item.medicine_id AND user_id = v_user_id;

    INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, reference_id, notes)
    VALUES (
      v_item.medicine_id, v_user_id, 'adjustment', v_item.difference,
      p_opname_id,
      'Stock opname: sistem=' || v_item.system_stock || ', fisik=' || v_item.physical_stock
        || COALESCE('. ' || v_item.notes, '')
    );
  END LOOP;

  -- Mark as approved
  UPDATE public.stock_opnames
     SET status = 'approved', approved_by = v_actor_id, approved_at = NOW(), updated_at = NOW()
   WHERE id = p_opname_id;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, severity, actor_role, after_data)
  VALUES (v_actor_id, 'update', 'stock_opname', p_opname_id, 'warning', v_actor_role,
          jsonb_build_object('status', 'approved', 'approved_at', NOW()));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_stock_opname(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_stock_opname(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2.5 Update stock_movements type constraint for opname
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_type_check
    CHECK (type IN ('sale', 'restock', 'adjustment', 'expired_removal', 'void_return', 'opname_adjustment', 'transfer'));
EXCEPTION
  WHEN others THEN NULL;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: SECURITY HARDENING
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 3.1 Rate limiting table for auth actions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  TEXT NOT NULL,           -- email or IP
  action      TEXT NOT NULL,           -- 'login', 'signup', 'reset_password', 'invite'
  attempts    INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_lookup
  ON public.auth_rate_limits (identifier, action, window_start DESC);

-- Cleanup old rate limit entries (run via cron/scheduled function)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.auth_rate_limits
   WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3.2 RPC: check_rate_limit — call before sensitive operations
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action     TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_attempts    INTEGER;
  v_blocked     TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Check if blocked
  SELECT blocked_until INTO v_blocked
    FROM public.auth_rate_limits
   WHERE identifier = p_identifier
     AND action = p_action
     AND blocked_until > NOW()
   LIMIT 1;

  IF v_blocked IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- Count recent attempts
  SELECT COUNT(*) INTO v_attempts
    FROM public.auth_rate_limits
   WHERE identifier = p_identifier
     AND action = p_action
     AND window_start >= v_window_start;

  IF v_attempts >= p_max_attempts THEN
    -- Block for escalating duration: 15min, 30min, 1hr
    INSERT INTO public.auth_rate_limits (identifier, action, blocked_until)
    VALUES (p_identifier, p_action, NOW() + (p_window_minutes || ' minutes')::INTERVAL);
    RETURN FALSE;
  END IF;

  -- Record attempt
  INSERT INTO public.auth_rate_limits (identifier, action)
  VALUES (p_identifier, p_action);

  RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3.3 Security: Restrict void_transaction permissions
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.void_transaction(UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.void_transaction(UUID, UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- PHASE 4: SAAS CORE PLATFORM
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 4.1 Subscription plans table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id              TEXT PRIMARY KEY,      -- 'free', 'starter', 'professional', 'enterprise'
  name            TEXT NOT NULL,
  description     TEXT,
  price_monthly   NUMERIC NOT NULL DEFAULT 0,
  price_yearly    NUMERIC NOT NULL DEFAULT 0,
  -- Entitlements / limits
  max_medicines   INTEGER,               -- NULL = unlimited
  max_transactions_per_month INTEGER,    -- NULL = unlimited
  max_kasir       INTEGER NOT NULL DEFAULT 0,
  max_customers   INTEGER,
  features        JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Metadata
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans
INSERT INTO public.subscription_plans (id, name, description, price_monthly, price_yearly, max_medicines, max_transactions_per_month, max_kasir, max_customers, features, sort_order)
VALUES
  ('free', 'Gratis', 'Untuk memulai. Cocok untuk apotek baru yang ingin mencoba.', 0, 0, 50, 100, 0, 20,
   '["pos_basic","inventory_basic","receipt_print","dashboard"]'::JSONB, 1),
  ('starter', 'Starter', 'Untuk apotek kecil yang mulai berkembang.', 99000, 990000, 200, 500, 1, 100,
   '["pos_basic","inventory_basic","receipt_print","dashboard","laporan","resep","csv_export","customers"]'::JSONB, 2),
  ('professional', 'Professional', 'Untuk apotek mandiri yang ingin operasi penuh.', 249000, 2490000, NULL, NULL, 3, NULL,
   '["pos_basic","inventory_basic","inventory_batch","receipt_print","receipt_custom","dashboard","laporan","resep","csv_export","customers","stock_opname","audit_log","dispensing_rules","whatsapp_receipt","barcode_scanner"]'::JSONB, 3),
  ('enterprise', 'Enterprise', 'Solusi lengkap untuk jaringan apotek.', 499000, 4990000, NULL, NULL, 10, NULL,
   '["pos_basic","inventory_basic","inventory_batch","receipt_print","receipt_custom","dashboard","laporan","resep","csv_export","customers","stock_opname","audit_log","dispensing_rules","whatsapp_receipt","barcode_scanner","api_access","priority_support","multi_branch"]'::JSONB, 4)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4.2 Tenant subscriptions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id         TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status          TEXT NOT NULL DEFAULT 'trialing'
                  CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  billing_cycle   TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly', 'yearly')),
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  cancelled_at    TIMESTAMPTZ,
  -- Payment
  payment_method  TEXT,
  external_id     TEXT,                 -- Midtrans/Xendit order ID
  -- Usage tracking
  medicines_count    INTEGER NOT NULL DEFAULT 0,
  transactions_count INTEGER NOT NULL DEFAULT 0,
  kasir_count        INTEGER NOT NULL DEFAULT 0,
  customers_count    INTEGER NOT NULL DEFAULT 0,
  -- Grace period
  grace_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own subscription"
  ON public.subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4.3 Usage metering table (daily snapshots)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  metric_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  transactions_count INTEGER NOT NULL DEFAULT 0,
  medicines_count    INTEGER NOT NULL DEFAULT 0,
  kasir_count        INTEGER NOT NULL DEFAULT 0,
  customers_count    INTEGER NOT NULL DEFAULT 0,
  storage_bytes      BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, metric_date)
);

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own usage"
  ON public.usage_metrics FOR SELECT
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4.4 Auto-create free subscription for existing users
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.subscriptions (user_id, plan_id, status, trial_ends_at, current_period_end)
SELECT id, 'free', 'active', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days'
FROM public.users
WHERE role = 'owner'
  AND id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4.5 RPC: check_entitlement — frontend calls before actions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_entitlement(p_feature TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id    UUID := public.get_effective_user_id();
  v_sub        RECORD;
  v_plan       RECORD;
  v_allowed    BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  SELECT s.*, sp.features, sp.max_medicines, sp.max_transactions_per_month, sp.max_kasir, sp.max_customers
    INTO v_sub
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'no_subscription');
  END IF;

  -- Check subscription status
  IF v_sub.status NOT IN ('trialing', 'active') THEN
    -- Allow read-only access during grace period
    IF v_sub.grace_ends_at IS NOT NULL AND v_sub.grace_ends_at > NOW() THEN
      IF p_feature IN ('dashboard', 'laporan', 'csv_export') THEN
        RETURN json_build_object('allowed', true, 'grace_period', true);
      END IF;
    END IF;
    RETURN json_build_object('allowed', false, 'reason', 'subscription_' || v_sub.status);
  END IF;

  -- Check feature access
  IF p_feature IS NOT NULL AND p_feature != '' THEN
    v_allowed := v_sub.features ? p_feature;
    IF NOT v_allowed THEN
      RETURN json_build_object('allowed', false, 'reason', 'feature_not_in_plan', 'plan', v_sub.plan_id);
    END IF;
  END IF;

  RETURN json_build_object('allowed', true, 'plan', v_sub.plan_id, 'status', v_sub.status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_entitlement(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_entitlement(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4.6 RPC: get_subscription_info — full subscription details
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_subscription_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner_id UUID;
  v_result  JSON;
BEGIN
  -- Get owner id (kasir sees owner's subscription)
  SELECT COALESCE(pharmacy_owner_id, id) INTO v_owner_id FROM public.users WHERE id = v_user_id;

  SELECT json_build_object(
    'subscription', json_build_object(
      'id', s.id,
      'plan_id', s.plan_id,
      'status', s.status,
      'billing_cycle', s.billing_cycle,
      'trial_ends_at', s.trial_ends_at,
      'current_period_start', s.current_period_start,
      'current_period_end', s.current_period_end,
      'grace_ends_at', s.grace_ends_at,
      'medicines_count', s.medicines_count,
      'transactions_count', s.transactions_count,
      'kasir_count', s.kasir_count,
      'customers_count', s.customers_count
    ),
    'plan', json_build_object(
      'id', sp.id,
      'name', sp.name,
      'description', sp.description,
      'price_monthly', sp.price_monthly,
      'price_yearly', sp.price_yearly,
      'max_medicines', sp.max_medicines,
      'max_transactions_per_month', sp.max_transactions_per_month,
      'max_kasir', sp.max_kasir,
      'max_customers', sp.max_customers,
      'features', sp.features
    )
  ) INTO v_result
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = v_owner_id;

  IF v_result IS NULL THEN
    RETURN json_build_object('subscription', null, 'plan', null);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_subscription_info() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_subscription_info() TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status) WHERE status IN ('trialing', 'active');
CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_date ON public.usage_metrics (user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispensing_rules_user ON public.dispensing_rules (user_id, category);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_user ON public.stock_opnames (user_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_opname ON public.stock_opname_items (opname_id);
