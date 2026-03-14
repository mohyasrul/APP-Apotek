import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePOSStore } from '../lib/store';

export function useFEFOAllocations(effectiveUserId: string | null) {
  const { cart } = usePOSStore();
  const [allocations, setAllocations] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!effectiveUserId || cart.length === 0) {
      setAllocations({});
      return;
    }

    const fetchAllocations = async () => {
      setLoading(true);
      const newAllocations: Record<string, any[]> = {};
      
      try {
        await Promise.all(cart.map(async (item) => {
          const { data, error } = await supabase.rpc('get_fefo_preview', {
            p_medicine_id: item.id,
            p_user_id: effectiveUserId,
            p_qty_needed: item.quantity
          });

          if (!error && data) {
            newAllocations[item.id] = data as any[];
          }
        }));
        
        setAllocations(newAllocations);
      } catch (err) {
        console.error('Error fetching FEFO previews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllocations();
  }, [cart, effectiveUserId]);

  return { allocations, loading };
}
