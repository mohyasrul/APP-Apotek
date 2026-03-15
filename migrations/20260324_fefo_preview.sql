-- ─────────────────────────────────────────────────────────────
-- FEFO Preview Function (Read-Only)
-- Date: 2026-03-24
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_fefo_preview(
  p_medicine_id UUID,
  p_user_id     UUID,
  p_qty_needed  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch         RECORD;
  v_allocations   JSONB := '[]'::JSONB;
  v_remaining     INTEGER := p_qty_needed;
  v_to_take       INTEGER;
BEGIN
  -- Identical logic to allocate_quantity_fefo but WITHOUT 'FOR UPDATE'
  -- This is used for UI preview only and does not lock/change data.
  FOR v_batch IN
    SELECT id, batch_number, quantity, expiry_date
      FROM public.medicine_batches
     WHERE medicine_id = p_medicine_id
       AND user_id = p_user_id
       AND quantity > 0
       AND expiry_date > CURRENT_DATE
     ORDER BY expiry_date ASC, created_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    v_to_take := LEAST(v_batch.quantity, v_remaining);

    v_allocations := v_allocations || jsonb_build_object(
      'batch_id', v_batch.id,
      'batch_number', v_batch.batch_number,
      'qty', v_to_take,
      'expiry_date', v_batch.expiry_date
    );

    v_remaining := v_remaining - v_to_take;
  END LOOP;

  RETURN v_allocations;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fefo_preview(UUID, UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_fefo_preview IS
  'Non-locking FEFO preview: returns JSONB array of {batch_id, qty} for UI display';
