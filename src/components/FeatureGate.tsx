import { ReactNode } from 'react';
import { useSubscription } from '../lib/SubscriptionContext';
import { Warning, Rocket } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

type FeatureGateProps = {
  feature: string;
  children: ReactNode;
  /** Fallback UI when feature is not available. If not provided, shows default upgrade prompt */
  fallback?: ReactNode;
  /** If true, renders nothing instead of upgrade prompt */
  silent?: boolean;
};

/**
 * Wraps content that requires a specific subscription feature.
 * Shows upgrade prompt if the feature is not available in current plan.
 */
export function FeatureGate({ feature, children, fallback, silent = false }: FeatureGateProps) {
  const { checkFeature, subscription, loading } = useSubscription();

  // While loading, render nothing to prevent flash
  if (loading) {
    return null;
  }

  const hasFeature = checkFeature(feature);

  if (hasFeature) {
    return <>{children}</>;
  }

  // If silent mode, don't render anything
  if (silent) {
    return null;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  const planName = subscription?.plan?.name || 'Gratis';

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 text-center">
      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
        <Warning weight="fill" className="w-6 h-6 text-amber-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">Fitur Premium</h3>
      <p className="text-sm text-slate-600 mb-4">
        Fitur ini tidak tersedia di paket <span className="font-semibold">{planName}</span>.
        <br />
        Upgrade ke paket yang lebih tinggi untuk mengakses fitur ini.
      </p>
      <Link
        to="/billing"
        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      >
        <Rocket weight="bold" className="w-4 h-4" />
        Lihat Paket Upgrade
      </Link>
    </div>
  );
}

/**
 * Shows inline badge when feature is not available
 */
export function FeatureBadge({ feature }: { feature: string }) {
  const { checkFeature } = useSubscription();

  if (checkFeature(feature)) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
      <Rocket weight="bold" className="w-3 h-3" />
      Premium
    </span>
  );
}

/**
 * Hook to check multiple features at once
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeatures(features: string[]) {
  const { checkFeature } = useSubscription();

  return features.reduce((acc, feature) => {
    acc[feature] = checkFeature(feature);
    return acc;
  }, {} as Record<string, boolean>);
}
