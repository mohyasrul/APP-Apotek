import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Check, Rocket, Star, Crown, Buildings,
  ArrowRight, Calendar, Warning, ChartBar, Users, Package, Receipt
} from '@phosphor-icons/react';
import { formatRupiah } from '../lib/types';
import type { SubscriptionPlan } from '../lib/types';

export default function Billing() {
  const { profile } = useAuth();
  const { subscription, daysRemaining, isTrialing, isPaid, getUsagePercent } = useSubscription();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPlans((data as SubscriptionPlan[]) || []);
    } catch {
      toast.error('Gagal memuat paket langganan');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (!profile || planId === subscription?.plan?.id) return;

    // For now, just show a toast - in production, this would redirect to payment gateway
    setUpgrading(planId);

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast.info(
      'Fitur pembayaran akan segera tersedia. Hubungi tim MediSir untuk upgrade manual.',
      { duration: 5000 }
    );

    setUpgrading(null);
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free': return <Rocket weight="fill" className="w-6 h-6" />;
      case 'starter': return <Star weight="fill" className="w-6 h-6" />;
      case 'professional': return <Crown weight="fill" className="w-6 h-6" />;
      case 'enterprise': return <Buildings weight="fill" className="w-6 h-6" />;
      default: return <Rocket weight="fill" className="w-6 h-6" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'free': return 'from-gray-500 to-gray-600';
      case 'starter': return 'from-blue-500 to-blue-600';
      case 'professional': return 'from-purple-500 to-purple-600';
      case 'enterprise': return 'from-amber-500 to-amber-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const currentPlan = subscription?.plan;
  const currentSub = subscription?.subscription;

  const usageMetrics = [
    {
      label: 'Obat',
      current: currentSub?.medicines_count || 0,
      max: currentPlan?.max_medicines,
      percent: getUsagePercent('medicines'),
      icon: <Package weight="fill" className="w-5 h-5 text-indigo-600" />,
    },
    {
      label: 'Transaksi/Bulan',
      current: currentSub?.transactions_count || 0,
      max: currentPlan?.max_transactions_per_month,
      percent: getUsagePercent('transactions'),
      icon: <Receipt weight="fill" className="w-5 h-5 text-emerald-500" />,
    },
    {
      label: 'Kasir',
      current: currentSub?.kasir_count || 0,
      max: currentPlan?.max_kasir,
      percent: getUsagePercent('kasir'),
      icon: <Users weight="fill" className="w-5 h-5 text-purple-500" />,
    },
  ];

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 antialiased min-h-screen flex flex-col bg-gray-50 dark:bg-zinc-950 pb-20 lg:pb-0">
      <main className="flex-1 p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Langganan & Billing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola paket langganan MediSir untuk apotek Anda.</p>
        </div>

        {/* Current Plan Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getPlanColor(currentPlan?.id || 'free')} text-white flex items-center justify-center shadow-lg`}>
                {getPlanIcon(currentPlan?.id || 'free')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentPlan?.name || 'Gratis'}</h2>
                  {isTrialing && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-full">
                      Trial
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{currentPlan?.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {currentSub && (
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isTrialing ? 'Trial berakhir' : 'Periode berikutnya'}
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-gray-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {daysRemaining} hari lagi
                  </p>
                </div>
              )}

              {isPaid && (
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tagihan</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatRupiah(
                      currentSub?.billing_cycle === 'yearly'
                        ? (currentPlan?.price_yearly || 0)
                        : (currentPlan?.price_monthly || 0)
                    )}
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
                      /{currentSub?.billing_cycle === 'yearly' ? 'tahun' : 'bulan'}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Usage metrics */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <ChartBar weight="fill" className="w-4 h-4 text-gray-400" />
              Pemakaian Saat Ini
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {usageMetrics.map(metric => (
                <div key={metric.label} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {metric.icon}
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                      {metric.current} / {metric.max || '∞'}
                    </span>
                  </div>
                  {metric.max && (
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          metric.percent >= 90 ? 'bg-rose-500' :
                          metric.percent >= 70 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, metric.percent)}%` }}
                      />
                    </div>
                  )}
                  {metric.percent >= 90 && (
                    <p className="text-xs text-rose-500 dark:text-rose-400 mt-2 flex items-center gap-1">
                      <Warning weight="fill" className="w-3 h-3" />
                      Hampir mencapai batas
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
            Bulanan
          </span>
          <button
            onClick={() => setBillingCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
            aria-label="Toggle billing cycle"
            className={`relative w-14 h-8 rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
              billingCycle === 'yearly' ? 'left-7' : 'left-1'
            }`} />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
            Tahunan
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded">
              Hemat 17%
            </span>
          </span>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 animate-pulse">
                <div className="h-8 bg-gray-100 dark:bg-zinc-800 rounded-lg w-24 mb-4" />
                <div className="h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg w-32 mb-4" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-4 bg-gray-100 dark:bg-zinc-800 rounded w-full" />
                  ))}
                </div>
              </div>
            ))
          ) : (
            plans.map(plan => {
              const isCurrentPlan = plan.id === currentPlan?.id;
              const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
              const monthlyEquivalent = billingCycle === 'yearly' ? Math.round(price / 12) : price;
              const isPopular = plan.id === 'professional';

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white dark:bg-zinc-900 rounded-xl border-2 transition-all ${
                    isCurrentPlan
                      ? 'border-indigo-600 shadow-lg shadow-indigo-500/10'
                      : isPopular
                      ? 'border-purple-200 dark:border-purple-800'
                      : 'border-gray-200 dark:border-zinc-800'
                  } p-6`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
                      Paling Populer
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanColor(plan.id)} text-white flex items-center justify-center shadow-sm mb-4`}>
                    {getPlanIcon(plan.id)}
                  </div>

                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 min-h-[40px]">{plan.description}</p>

                  <div className="mb-6">
                    {price === 0 ? (
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gratis</p>
                    ) : (
                      <>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {formatRupiah(monthlyEquivalent)}
                          <span className="text-sm font-normal text-gray-400 dark:text-gray-500">/bulan</span>
                        </p>
                        {billingCycle === 'yearly' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Ditagih {formatRupiah(price)}/tahun
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 min-h-[180px]">
                    <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {plan.max_medicines ? `${plan.max_medicines} obat` : 'Obat unlimited'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {plan.max_transactions_per_month
                          ? `${plan.max_transactions_per_month} transaksi/bulan`
                          : 'Transaksi unlimited'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {plan.max_kasir === 0 ? 'Owner saja' : `${plan.max_kasir} kasir`}
                      </span>
                    </li>
                    {plan.features.includes('laporan') && (
                      <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Laporan penjualan</span>
                      </li>
                    )}
                    {plan.features.includes('stock_opname') && (
                      <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Stock opname</span>
                      </li>
                    )}
                    {plan.features.includes('audit_log') && (
                      <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Audit log</span>
                      </li>
                    )}
                    {plan.features.includes('priority_support') && (
                      <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Prioritas support</span>
                      </li>
                    )}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || upgrading !== null}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isCurrentPlan
                        ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : isPopular
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {upgrading === plan.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isCurrentPlan ? (
                      'Paket Saat Ini'
                    ) : (
                      <>
                        Pilih Paket
                        <ArrowRight weight="bold" className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* FAQ or Contact */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Butuh bantuan memilih paket yang tepat?{' '}
            <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer"
               className="text-indigo-600 hover:underline font-medium">
              Hubungi tim MediSir
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
