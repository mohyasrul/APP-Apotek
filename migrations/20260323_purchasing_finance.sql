-- ================================================================
-- Purchasing & Finance: Pencatatan Invoice PBF dan Hutang Dagang
-- Date: 2026-03-23
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pbf_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pharmacy_id, supplier_id, invoice_number)
);

ALTER TABLE public.pbf_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage pbf invoices of their pharmacy"
  ON public.pbf_invoices FOR ALL
  USING (pharmacy_id = public.get_effective_user_id());


CREATE TABLE IF NOT EXISTS public.pbf_invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.pbf_invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'transfer',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pbf_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage pbf invoice payments"
  ON public.pbf_invoice_payments FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM public.pbf_invoices WHERE pharmacy_id = public.get_effective_user_id()
    )
  );

-- Function to update invoice status when a payment is added/removed
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
BEGIN
  -- Re-calculate total paid for this invoice
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM pbf_invoice_payments WHERE invoice_id = OLD.invoice_id;
    SELECT total_amount INTO v_invoice_total FROM pbf_invoices WHERE id = OLD.invoice_id;
    
    UPDATE pbf_invoices SET 
      amount_paid = v_total_paid,
      status = CASE 
                 WHEN v_total_paid >= v_invoice_total THEN 'paid'
                 WHEN v_total_paid > 0 THEN 'partial'
                 ELSE 'unpaid' 
               END,
      updated_at = NOW()
    WHERE id = OLD.invoice_id;
    
    RETURN OLD;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM pbf_invoice_payments WHERE invoice_id = NEW.invoice_id;
    SELECT total_amount INTO v_invoice_total FROM pbf_invoices WHERE id = NEW.invoice_id;
    
    UPDATE pbf_invoices SET 
      amount_paid = v_total_paid,
      status = CASE 
                 WHEN v_total_paid >= v_invoice_total THEN 'paid'
                 WHEN v_total_paid > 0 THEN 'partial'
                 ELSE 'unpaid' 
               END,
      updated_at = NOW()
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON pbf_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_status();

COMMIT;
