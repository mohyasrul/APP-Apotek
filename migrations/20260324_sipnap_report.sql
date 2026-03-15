-- ─────────────────────────────────────────────────────────────
-- SIPNAP Report & Stock History Backfill
-- Date: 2026-03-24
-- ─────────────────────────────────────────────────────────────

-- 1. Trigger to auto-record initial stock as movement
CREATE OR REPLACE FUNCTION public.record_initial_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.stock > 0) THEN
    INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, notes)
    VALUES (NEW.id, NEW.user_id, 'adjustment', NEW.stock, 'Stok awal saat pendaftaran obat');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initial_stock ON public.medicines;
CREATE TRIGGER trg_initial_stock
  AFTER INSERT ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.record_initial_stock_movement();

-- 2. Backfill: If medicine has stock but NO movements, create adjustment
INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, notes, created_at)
SELECT m.id, m.user_id, 'adjustment', m.stock, 'Backfill: Stok awal terdeteksi', m.created_at
FROM public.medicines m
LEFT JOIN public.stock_movements sm ON m.id = sm.medicine_id
WHERE m.stock > 0 AND sm.id IS NULL;

-- 3. SIPNAP Report Function
-- Returns monthly data for Narkotika & Psikotropika
CREATE OR REPLACE FUNCTION public.get_sipnap_report(
  p_pharmacy_id UUID,
  p_month       INTEGER,
  p_year        INTEGER
)
RETURNS TABLE (
  medicine_id    UUID,
  medicine_name  TEXT,
  unit          TEXT,
  category      TEXT,
  beginning_bal NUMERIC,
  total_in      NUMERIC,
  total_out     NUMERIC,
  ending_bal    NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMP;
  v_end_date   TIMESTAMP;
BEGIN
  v_start_date := make_date(p_year, p_month, 1)::TIMESTAMP;
  v_end_date   := (v_start_date + interval '1 month')::TIMESTAMP;

  RETURN QUERY
  WITH pharmacy_meds AS (
    SELECT id, name, unit, category, stock
    FROM public.medicines
    WHERE user_id = p_pharmacy_id
      AND category IN ('narkotika', 'psikotropika', 'psikotropik', 'prekursor')
  ),
  m_in AS (
    SELECT sm.medicine_id, SUM(sm.quantity) as qty
    FROM public.stock_movements sm
    WHERE sm.user_id = p_pharmacy_id
      AND sm.type IN ('restock', 'void_return')
      AND sm.created_at >= v_start_date
      AND sm.created_at < v_end_date
    GROUP BY 1
  ),
  m_out AS (
    SELECT sm.medicine_id, SUM(sm.quantity) as qty
    FROM public.stock_movements sm
    WHERE sm.user_id = p_pharmacy_id
      AND sm.type IN ('sale', 'expired_removal', 'adjustment')
      AND sm.created_at >= v_start_date
      AND sm.created_at < v_end_date
    GROUP BY 1
  ),
  m_after AS (
    -- Movements after the period to calculate historical ending balance
    SELECT sm.medicine_id, 
           SUM(CASE 
             WHEN sm.type IN ('restock', 'void_return') THEN sm.quantity 
             ELSE -sm.quantity 
           END) as delta
    FROM public.stock_movements sm
    WHERE sm.user_id = p_pharmacy_id
      AND sm.created_at >= v_end_date
    GROUP BY 1
  )
  SELECT 
    pm.id,
    pm.name,
    pm.unit,
    pm.category,
    -- Beginning Balance = Ending - In + Out
    (pm.stock - COALESCE(ma.delta, 0) - COALESCE(mi.qty, 0) + COALESCE(mo.qty, 0))::NUMERIC as beginning_bal,
    COALESCE(mi.qty, 0)::NUMERIC as total_in,
    COALESCE(mo.qty, 0)::NUMERIC as total_out,
    (pm.stock - COALESCE(ma.delta, 0))::NUMERIC as ending_bal
  FROM pharmacy_meds pm
  LEFT JOIN m_in mi ON pm.id = mi.medicine_id
  LEFT JOIN m_out mo ON pm.id = mo.medicine_id
  LEFT JOIN m_after ma ON pm.id = ma.medicine_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sipnap_report(UUID, INTEGER, INTEGER) TO authenticated;
