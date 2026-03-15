-- ============================================================
-- MIGRATION: Schema Improvements for MediSir POS
-- Date: 2024-03-12
-- ============================================================

-- ===========================================
-- 1. ALTER TABLE: users (tambah phone, logo, updated_at)
-- ===========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===========================================
-- 2. ALTER TABLE: medicines (tambah unit, supplier, batch, min_stock, updated_at)
-- ===========================================
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'tablet';
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 5;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===========================================
-- 3. ALTER TABLE: transactions (discount, notes)
-- ===========================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_total NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;

-- ===========================================
-- 4. ALTER TABLE: transaction_items (discount per-item)
-- ===========================================
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- ===========================================
-- 5. CHECK CONSTRAINTS
-- ===========================================
DO $$ BEGIN
  ALTER TABLE medicines ADD CONSTRAINT chk_stock_non_negative CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE medicines ADD CONSTRAINT chk_buy_price_positive CHECK (buy_price > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE medicines ADD CONSTRAINT chk_sell_price_positive CHECK (sell_price > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transaction_items ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- 6. INDEXES (performance)
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_medicines_user_id ON medicines(user_id);
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medicines_user_name ON medicines(user_id, name);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trx_items_trx_id ON transaction_items(transaction_id);

-- ===========================================
-- 7. STOCK MOVEMENTS AUDIT TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL, -- 'sale', 'restock', 'adjustment', 'expired_removal'
  quantity INTEGER NOT NULL, -- positive = masuk, negative = keluar
  reference_id UUID,       -- transaction_id jika type = 'sale'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own stock movements" ON stock_movements
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id, created_at DESC);

-- ===========================================
-- 8. AUTO updated_at TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_medicines_updated_at ON medicines;
CREATE TRIGGER trg_medicines_updated_at BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- 9. RPC: decrement_stock (atomic stock deduction + audit log)
-- ===========================================
CREATE OR REPLACE FUNCTION decrement_stock(p_medicine_id UUID, p_qty INTEGER, p_transaction_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE medicines
  SET stock = stock - p_qty
  WHERE id = p_medicine_id AND stock >= p_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok tidak mencukupi untuk medicine_id: %', p_medicine_id;
  END IF;

  -- Log stock movement
  INSERT INTO stock_movements (medicine_id, user_id, type, quantity, reference_id)
  VALUES (p_medicine_id, auth.uid(), 'sale', -p_qty, p_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 10. RPC: increment_stock (for restock)
-- ===========================================
CREATE OR REPLACE FUNCTION increment_stock(p_medicine_id UUID, p_qty INTEGER, p_notes TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE medicines
  SET stock = stock + p_qty
  WHERE id = p_medicine_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medicine not found: %', p_medicine_id;
  END IF;

  INSERT INTO stock_movements (medicine_id, user_id, type, quantity, notes)
  VALUES (p_medicine_id, auth.uid(), 'restock', p_qty, p_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 11. RPC: get_dashboard_metrics (server-side aggregation)
-- ===========================================
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_sales', COALESCE(SUM(t.total_amount), 0),
    'total_transactions', COUNT(t.id),
    'items_sold', COALESCE((
      SELECT SUM(ti.quantity)
      FROM transaction_items ti
      JOIN transactions tx ON tx.id = ti.transaction_id
      WHERE tx.user_id = p_user_id
      AND (p_start_date IS NULL OR tx.created_at >= p_start_date)
    ), 0),
    'critical_stock', COALESCE((
      SELECT COUNT(*)
      FROM medicines m
      WHERE m.user_id = p_user_id AND m.stock < m.min_stock
    ), 0),
    'expiry_count', COALESCE((
      SELECT COUNT(*)
      FROM medicines m
      WHERE m.user_id = p_user_id AND m.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')
    ), 0)
  ) INTO result
  FROM transactions t
  WHERE t.user_id = p_user_id
  AND (p_start_date IS NULL OR t.created_at >= p_start_date);

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 12. RPC: get_total_laba (accurate gross profit for Laporan)
-- ===========================================
CREATE OR REPLACE FUNCTION get_total_laba(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'omset', COALESCE(SUM(t.total_amount), 0),
    'laba_kotor', COALESCE(SUM(
      (SELECT SUM((ti.price_at_transaction - COALESCE(m.buy_price, 0)) * ti.quantity)
       FROM transaction_items ti
       LEFT JOIN medicines m ON m.id = ti.medicine_id
       WHERE ti.transaction_id = t.id)
    ), 0),
    'trx_count', COUNT(t.id)
  ) INTO result
  FROM transactions t
  WHERE t.user_id = p_user_id
  AND (p_start_date IS NULL OR t.created_at >= p_start_date);

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 13. FIX RLS POLICIES (split per-operation + WITH CHECK)
-- ===========================================

-- Medicines: drop old, create new split policies
DROP POLICY IF EXISTS "Users can manage medicines of their pharmacy" ON medicines;

DO $$ BEGIN
  CREATE POLICY "med_select" ON medicines FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_insert" ON medicines FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_update" ON medicines FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_delete" ON medicines FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Transactions: drop old, create new
DROP POLICY IF EXISTS "Users can manage transactions of their pharmacy" ON transactions;

DO $$ BEGIN
  CREATE POLICY "trx_select" ON transactions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "trx_insert" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "trx_update" ON transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "trx_delete" ON transactions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- 14. Supabase Storage bucket for pharmacy logos
-- ===========================================
-- NOTE: Run this in Supabase Dashboard > Storage > Create Bucket
-- Bucket name: pharmacy-assets
-- Public: true
-- File size limit: 2MB
-- Allowed MIME types: image/png, image/jpeg, image/webp
