import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import type { Medicine } from '../lib/types';

const CACHE_KEY = 'pos_catalog_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedCatalog(userId: string): Medicine[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { uid, ts, data } = JSON.parse(raw);
    if (uid !== userId || Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data as Medicine[];
  } catch {
    return null;
  }
}

function setCachedCatalog(userId: string, data: Medicine[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ uid: userId, ts: Date.now(), data }));
  } catch {
    // storage full — ignore
  }
}

/**
 * Custom hook for POS inventory management.
 * Handles: initial fetch, server-side search, realtime sync, catalog reset.
 */
export function usePOSInventory() {
  const { user, effectiveUserId } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep a reference to the full catalog (first 150 items) so we can restore
  // after a server-side search clears the search query.
  const catalogRef = useRef<Medicine[]>([]);

  const fetchInventory = useCallback(async () => {
    if (!effectiveUserId) return;

    // Try cache first for instant render
    const cached = getCachedCatalog(effectiveUserId);
    if (cached && cached.length > 0) {
      catalogRef.current = cached;
      setMedicines(cached);
      setLoading(false);
    }

    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name')
        .limit(150);

      if (error) throw error;
      const result = data || [];
      catalogRef.current = result;
      setMedicines(result);
      setCachedCatalog(effectiveUserId, result);
    } catch (error: unknown) {
      if (!cached || cached.length === 0) {
        toast.error('Gagal memuat katalog obat: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'), { id: 'pos-catalog-error' });
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  // Server-side search for pharmacies with >150 SKUs
  const searchInventory = useCallback(async (query: string) => {
    if (!effectiveUserId || query.length < 2) return;
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('user_id', effectiveUserId)
        .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
        .order('name')
        .limit(50);

      if (error) throw error;
      if (data && data.length > 0) setMedicines(data);
    } catch {
      // silent — keep local results
    }
  }, [effectiveUserId]);

  // Restore catalog to original 150 items (e.g. after clearing search)
  const restoreCatalog = useCallback(() => {
    if (catalogRef.current.length > 0) {
      setMedicines(catalogRef.current);
    }
  }, []);

  // Re-validate cart items against latest prices/stock
  const validateCartItems = useCallback(async (
    cartItemIds: string[]
  ): Promise<{ valid: boolean; updates: Record<string, { price: number; stock: number; name: string }> }> => {
    if (!effectiveUserId || cartItemIds.length === 0) {
      return { valid: true, updates: {} };
    }

    const { data, error } = await supabase
      .from('medicines')
      .select('id, name, sell_price, stock')
      .in('id', cartItemIds);

    if (error) {
      return { valid: false, updates: {} };
    }

    const updates: Record<string, { price: number; stock: number; name: string }> = {};
    (data || []).forEach(med => {
      updates[med.id] = { price: med.sell_price, stock: med.stock, name: med.name };
    });

    return { valid: true, updates };
  }, [effectiveUserId]);

  // Initial fetch
  useEffect(() => {
    if (user) fetchInventory();
  }, [user, fetchInventory]);

  // Realtime subscription for multi-cashier stock sync
  useEffect(() => {
    if (!effectiveUserId) return;

    const channel = supabase
      .channel(`medicines-pos-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'medicines',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        (payload) => {
          const updated = payload.new as Medicine;
          setMedicines(prev =>
            prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
          );
          // Also update the catalog ref
          catalogRef.current = catalogRef.current.map(m =>
            m.id === updated.id ? { ...m, ...updated } : m
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [effectiveUserId]);

  return {
    medicines,
    loading,
    fetchInventory,
    searchInventory,
    restoreCatalog,
    validateCartItems,
  };
}
