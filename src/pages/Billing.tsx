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
      case 'free': return 'from-slate-500 to-slate-600';
      case 'starter': return 'from-blue-500 to-blue-600';
      case 'professional': return 'from-purple-500 to-purple-600';
      case 'enterprise': return 'from-amber-500 to-amber-600';
      default: return 'from-slate-500 to-slate-600';
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
      icon: <Package weight="fill" className="w-5 h-5 text-blue-500" />,
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
    <div className="font-sans text-slate-800 antialiased min-h-screen flex flex-col bg-slate-50 pb-20 lg:pb-0">
      <main className="flex-1 p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Langganan & Billing</h1>
          <p className="text-sm text-slate-500">Kelola paket langganan MediSir untuk apotek Anda.</p>
        </div>

        {/* Current Plan Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getPlanColor(currentPlan?.id || 'free')} text-white flex items-center justify-center shadow-lg`}>
                {getPlanIcon(currentPlan?.id || 'free')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">{currentPlan?.name || 'Gratis'}</h2>
                  {isTrialing && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                      Trial
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{currentPlan?.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {currentSub && (
                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    {isTrialing ? 'Trial berakhir' : 'Periode berikutnya'}
                  </p>
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {daysRemaining} hari lagi
                  </p>
                </div>
              )}

              {isPaid && (
                <div className="text-right">
                  <p className="text-sm text-slate-500">Tagihan</p>
                  <p className="text-xl font-bold text-slate-800">
                    {formatRupiah(
                      currentSub?.billing_cycle === 'yearly'
                        ? (currentPlan?.price_yearly || 0)
                        : (currentPlan?.price_monthly || 0)
                    )}
                    <span className="text-sm font-normal text-slate-400">
                      /{currentSub?.billing_cycle === 'yearly' ? 'tahun' : 'bulan'}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Usage metrics */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <ChartBar weight="fill" className="w-4 h-4 text-slate-400" />
              Pemakaian Saat Ini
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {usageMetrics.map(metric => (
                <div key={metric.label} className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {metric.icon}
                      <span className="text-sm font-medium text-slate-600">{metric.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">
                      {metric.current} / {metric.max || '∞'}
                    </span>
                  </div>
                  {metric.max && (
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
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
                    <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">
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
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-800' : 'text-slate-400'}`}>
            Bulanan
          </span>
          <button
            onClick={() => setBillingCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
              billingCycle === 'yearly' ? 'left-7' : 'left-1'
            }`} />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-slate-800' : 'text-slate-400'}`}>
            Tahunan
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">
              Hemat 17%
            </span>
          </span>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                <div className="h-8 bg-slate-100 rounded-lg w-24 mb-4" />
                <div className="h-10 bg-slate-100 rounded-lg w-32 mb-4" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-4 bg-slate-100 rounded w-full" />
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
                  className={`relative bg-white rounded-2xl border-2 transition-all ${
                    isCurrentPlan
                      ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                      : isPopular
                      ? 'border-purple-200'
                      : 'border-slate-200'
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

                  <h3 className="text-lg font-bold text-slate-800 mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mb-4 min-h-[40px]">{plan.description}</p>

                  <div className="mb-6">
                    {price === 0 ? (
                      <p className="text-3xl font-bold text-slate-800">Gratis</p>
                    ) : (
                      <>
                        <p className="text-3xl font-bold text-slate-800">
                          {formatRupiah(monthlyEquivalent)}
                          <span className="text-sm font-normal text-slate-400">/bulan</span>
                        </p>
                        {billingCycle === 'yearly' && (
                          <p className="text-xs text-slate-500 mt-1">
                            Ditagih {formatRupiah(price)}/tahun
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 min-h-[180px]">
                    <li className="flex items-start gap-2 text-sm">
                      <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {plan.max_medicines ? `${plan.max_medicines} obat` : 'Obat unlimited'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {plan.max_transactions_per_month
                          ? `${plan.max_transactions_per_month} transaksi/bulan`
                          : 'Transaksi unlimited'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {plan.max_kasir === 0 ? 'Owner saja' : `${plan.max_kasir} kasir`}
                      </span>
                    </li>
                    {plan.features.includes('laporan') && (
                      <li className="flex items-start gap-2 text-sm">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Laporan penjualan</span>
                      </li>
                    )}
                    {plan.features.includes('stock_opname') && (
                      <li className="flex items-start gap-2 text-sm">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Stock opname</span>
                      </li>
                    )}
                    {plan.features.includes('audit_log') && (
                      <li className="flex items-start gap-2 text-sm">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Audit log</span>
                      </li>
                    )}
                    {plan.features.includes('priority_support') && (
                      <li className="flex items-start gap-2 text-sm">
                        <Check weight="bold" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>Prioritas support</span>
                      </li>
                    )}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || upgrading !== null}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPopular
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
          <p className="text-sm text-slate-500">
            Butuh bantuan memilih paket yang tepat?{' '}
            <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer"
               className="text-blue-500 hover:underline font-medium">
              Hubungi tim MediSir
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
