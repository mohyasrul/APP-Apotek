-- ================================================================
-- Pengadaan: Surat Pesanan & Buku Defecta Migration
-- Date: 2026-03-21
--
-- Changes:
--   1. Create suppliers table (PBF)
--   2. Create defecta_books table (Buku Defecta)
--   3. Create purchase_orders & purchase_order_items tables (Surat Pesanan)
-- ================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Suppliers (PBF - Pedagang Besar Farmasi)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage suppliers of their pharmacy"
  ON public.suppliers FOR ALL
  USING (pharmacy_id = public.get_effective_user_id());

-- ─────────────────────────────────────────────────────────────
-- 2. Defecta Books (Buku Defecta)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.defecta_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'ordered'
  required_stock INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.defecta_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage defecta of their pharmacy"
  ON public.defecta_books FOR ALL
  USING (pharmacy_id = public.get_effective_user_id());


-- ─────────────────────────────────────────────────────────────
-- 3. Purchase Orders (Surat Pesanan)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'received', 'cancelled'
  order_type TEXT NOT NULL DEFAULT 'reguler', -- 'reguler', 'prekursor', 'oot', 'narkotika', 'psikotropika'
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pharmacy_id, order_number)
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage purchase orders of their pharmacy"
  ON public.purchase_orders FOR ALL
  USING (pharmacy_id = public.get_effective_user_id());

-- ─────────────────────────────────────────────────────────────
-- 4. Purchase Order Items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Pcs',
  estimated_price NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage purchase order items of their pharmacy"
  ON public.purchase_order_items FOR ALL
  USING (
    po_id IN (
      SELECT id FROM public.purchase_orders WHERE pharmacy_id = public.get_effective_user_id()
    )
  );

COMMIT;
