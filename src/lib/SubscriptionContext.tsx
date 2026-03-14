import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import type { SubscriptionInfo, EntitlementResult } from './types';

type SubscriptionContextType = {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  /** Check if a feature is available in current plan */
  checkFeature: (feature: string) => boolean;
  /** Check entitlement via RPC (server-side validation) */
  checkEntitlement: (feature: string) => Promise<EntitlementResult>;
  /** Check if near/over a usage limit */
  getUsagePercent: (metric: 'medicines' | 'transactions' | 'kasir' | 'customers') => number;
  /** Is this a paid plan (not free) */
  isPaid: boolean;
  /** Is in trial period */
  isTrialing: boolean;
  /** Days remaining in trial or period */
  daysRemaining: number;
  /** Refresh subscription data */
  refreshSubscription: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  checkFeature: () => true,
  checkEntitlement: async () => ({ allowed: true }),
  getUsagePercent: () => 0,
  isPaid: false,
  isTrialing: false,
  daysRemaining: 0,
  refreshSubscription: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_subscription_info');
      if (error) throw error;
      setSubscription(data as unknown as SubscriptionInfo);
    } catch {
      // Fallback: assume free plan if RPC not available
      setSubscription({
        subscription: null,
        plan: null,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const checkFeature = useCallback((feature: string): boolean => {
    if (!subscription?.plan) return true; // Default allow if no subscription system
    return subscription.plan.features.includes(feature);
  }, [subscription]);

  const checkEntitlement = useCallback(async (feature: string): Promise<EntitlementResult> => {
    try {
      const { data, error } = await supabase.rpc('check_entitlement', { p_feature: feature });
      if (error) return { allowed: true }; // Fail-open if RPC unavailable
      return data as unknown as EntitlementResult;
    } catch {
      return { allowed: true };
    }
  }, []);

  const getUsagePercent = useCallback((metric: 'medicines' | 'transactions' | 'kasir' | 'customers'): number => {
    if (!subscription?.subscription || !subscription?.plan) return 0;
    const sub = subscription.subscription;
    const plan = subscription.plan;

    const usage: Record<string, number> = {
      medicines: sub.medicines_count,
      transactions: sub.transactions_count,
      kasir: sub.kasir_count,
      customers: sub.customers_count,
    };

    const limits: Record<string, number | null> = {
      medicines: plan.max_medicines,
      transactions: plan.max_transactions_per_month,
      kasir: plan.max_kasir,
      customers: plan.max_customers,
    };

    const limit = limits[metric];
    if (!limit) return 0; // Unlimited
    return Math.round((usage[metric] / limit) * 100);
  }, [subscription]);

  const isPaid = subscription?.plan ? subscription.plan.price_monthly > 0 : false;
  const isTrialing = subscription?.subscription?.status === 'trialing';

  const daysRemaining = (() => {
    if (!subscription?.subscription) return 0;
    const endDate = isTrialing
      ? subscription.subscription.trial_ends_at
      : subscription.subscription.current_period_end;
    if (!endDate) return 0;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  // Only fetch subscription for owner role
  const isOwner = profile?.role === 'owner';

  return (
    <SubscriptionContext.Provider value={{
      subscription: isOwner ? subscription : subscription, // Kasir sees owner's plan via RPC
      loading,
      checkFeature,
      checkEntitlement,
      getUsagePercent,
      isPaid,
      isTrialing,
      daysRemaining,
      refreshSubscription: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
