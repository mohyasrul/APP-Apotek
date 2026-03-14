import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight, Coins, Package, Star, Pill, Cross, Flask,
  Calendar, Plus, ChartLineUp, Warning, ShoppingCart
} from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatRupiah, getExpiryStatus, getGreeting, getLicenseExpiryStatus } from "../lib/types";

type ChartDataItem = { name: string; sales: number; isToday?: boolean };
type TopSellingItem = { name: string; category: string; totalQty: number; unit: string };
type AlertItem = { id: string; name: string; stock: number; min_stock: number; expiry_date: string; unit: string };
type DateFilter = 'week' | 'month' | 'all';

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white p-3 rounded-lg text-sm font-bold shadow-lg border border-slate-700">
        <p>{formatRupiah(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, profile, effectiveUserId } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    totalSales: 0, itemsSold: 0, totalTransactions: 0,
    criticalStockCount: 0, expiryCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [topSelling, setTopSelling] = useState<TopSellingItem[]>([]);
  const [criticalItems, setCriticalItems] = useState<AlertItem[]>([]);
  const [expiryItems, setExpiryItems] = useState<AlertItem[]>([]);

  // Cache: skip re-fetch jika data < 60 detik, filter & userId tidak berubah
  const lastFetchedAt = useRef<number>(0);
  const lastFetchedFilter = useRef<DateFilter | null>(null);
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !effectiveUserId) return; // tunggu profile kasir selesai load
    const age = Date.now() - lastFetchedAt.current;
    const filterUnchanged = lastFetchedFilter.current === dateFilter;
    const userIdUnchanged = lastFetchedUserId.current === effectiveUserId;
    if (filterUnchanged && userIdUnchanged && age < 60_000 && lastFetchedAt.current > 0) return;
    fetchDashboardData();
  }, [user, dateFilter, effectiveUserId]);

  const getChartDays = (): number => {
    if (dateFilter === 'week') return 7;
    if (dateFilter === 'month') return 30;
    return 30; // 'all' still shows last 30 days in chart for readability
  };

  const getChartTitle = (): string => {
    if (dateFilter === 'week') return 'Penjualan 7 Hari Terakhir';
    if (dateFilter === 'month') return 'Penjualan 30 Hari Terakhir';
    return 'Penjualan 30 Hari Terakhir';
  };

  const fetchDashboardData = async () => {
    // Spinner hanya saat first load, filter berubah, atau user berubah
    // Navigasi kembali ke halaman yang sudah ada datanya → tidak show spinner
    const isFirstLoad = lastFetchedAt.current === 0;
    const isFilterChange = lastFetchedFilter.current !== dateFilter;
    const isUserChange = lastFetchedUserId.current !== effectiveUserId;
    if (isFirstLoad || isFilterChange || isUserChange) setLoading(true);

    try {

      // Date filter calculation
      let startDate: string | null = null;
      const now = new Date();

      if (dateFilter === 'week') {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        startDate = d.toISOString();
      } else if (dateFilter === 'month') {
        const d = new Date();
        d.setMonth(now.getMonth() - 1);
        startDate = d.toISOString();
      }

      // Chart date range — always use getChartDays() to determine range
      const chartDays = getChartDays();
      const chartStart = new Date();
      chartStart.setDate(now.getDate() - chartDays);
      const chartStartISO = chartStart.toISOString();

      // ── Group 1: Parallel queries ─────────────────────────
      const rpcPromise = (async () => {
        try {
          return await supabase.rpc('get_dashboard_metrics', {
            p_user_id: effectiveUserId,
            p_start_date: startDate
          });
        } catch {
          return { data: null, error: null };
        }
      })();

      // Fetch transactions for chart data (uses chart date range)
      const trxPromise = supabase
        .from('transactions')
        .select('id, total_amount, created_at')
        .eq('user_id', effectiveUserId)
        .eq('status', 'active')
        .gte('created_at', chartStartISO)
        .order('created_at', { ascending: false });

      // Top selling via new RPC (no more N+1 pattern)
      const topSellingPromise = (async () => {
        try {
          return await supabase.rpc('get_top_selling', {
            p_start_date: startDate,
            p_limit: 5,
          });
        } catch {
          return { data: null, error: null };
        }
      })();

      // Quick alerts fetch
      const alertsPromise = supabase
        .from('medicines')
        .select('id, name, stock, min_stock, expiry_date, unit')
        .eq('user_id', effectiveUserId);

      const [rpcResponse, trxResponse, topSellingResponse, alertsResponse] = await Promise.all([
        rpcPromise, trxPromise, topSellingPromise, alertsPromise
      ]);

      type TrxRow = { id: string; total_amount: number; created_at: string };
      const trxData = trxResponse.data as TrxRow[] | null;
      if (trxResponse.error) throw trxResponse.error;

      // ── Metrics ────────────────────────────────────────────
      let metricsLoaded = false;
      if (rpcResponse.data && !rpcResponse.error) {
        const r = rpcResponse.data as { total_sales: number; items_sold: number; total_transactions: number; critical_stock: number; expiry_count: number };
        setMetrics({
          totalSales: r.total_sales || 0,
          itemsSold: r.items_sold || 0,
          totalTransactions: r.total_transactions || 0,
          criticalStockCount: r.critical_stock || 0,
          expiryCount: r.expiry_count || 0,
        });
        metricsLoaded = true;
      }

      if (!metricsLoaded && alertsResponse.data) {
        const totalSales = trxData?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;
        let criticalStockCount = 0;
        let expiryCount = 0;
        alertsResponse.data.forEach(med => {
          if (med.stock < (med.min_stock || 5)) criticalStockCount++;
          const status = getExpiryStatus(med.expiry_date);
          if (status === 'near-expiry' || status === 'expired') expiryCount++;
        });
        setMetrics({
          totalSales, itemsSold: 0,
          totalTransactions: trxData?.length || 0,
          criticalStockCount, expiryCount,
        });
      }

      // Populate Alerts
      if (alertsResponse.data) {
        const cItems = alertsResponse.data.filter(m => m.stock < (m.min_stock || 5)).sort((a,b) => a.stock - b.stock).slice(0, 10);
        const eItems = alertsResponse.data.filter(m => {
          const s = getExpiryStatus(m.expiry_date);
          return s === 'expired' || s === 'near-expiry';
        }).sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()).slice(0, 10);
        setCriticalItems(cItems);
        setExpiryItems(eItems);
      }

      // ── Build chart data (dynamic days based on filter) ────
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const chartItems: ChartDataItem[] = [];
      const today = new Date();

      for (let i = chartDays - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

        const daySales = trxData?.filter(t => {
          const tDate = new Date(t.created_at);
          return tDate >= dayStart && tDate < dayEnd;
        }).reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;

        const label = chartDays <= 7
          ? dayNames[date.getDay()]
          : `${date.getDate()}/${date.getMonth() + 1}`;

        chartItems.push({ name: label, sales: daySales, isToday: i === 0 });
      }
      setChartData(chartItems);

      // ── Top Selling (via new RPC) ─────────────────────────
      if (topSellingResponse.data && Array.isArray(topSellingResponse.data)) {
        setTopSelling(topSellingResponse.data.map((item: { medicine_name: string; category: string; total_qty: number; unit: string }) => ({
          name: item.medicine_name || 'Unknown',
          category: item.category || 'umum',
          totalQty: item.total_qty || 0,
          unit: item.unit || 'pcs',
        })));
      } else {
        setTopSelling([]);
      }
    } catch (error: unknown) {
      toast.error("Gagal memuat dashboard: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
      lastFetchedAt.current = Date.now();
      lastFetchedFilter.current = dateFilter;
      lastFetchedUserId.current = effectiveUserId;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'resep': return <Cross weight="fill" className="w-6 h-6 text-rose-500" />;
      case 'vitamin': return <Flask weight="fill" className="w-6 h-6 text-cyan-500" />;
      case 'alkes': return <Package weight="fill" className="w-6 h-6 text-purple-500" />;
      default: return <Pill weight="fill" className="w-6 h-6 text-emerald-500" />;
    }
  };

  const getCategoryBadge = (cat: string) => {
    const map: Record<string, string> = {
      bebas: "bg-emerald-50 text-emerald-600",
      keras: "bg-rose-50 text-rose-600",
      resep: "bg-purple-50 text-purple-600",
      alkes: "bg-cyan-50 text-cyan-600",
      vitamin: "bg-amber-50 text-amber-600",
    };
    return map[cat] || "bg-slate-100 text-slate-600";
  };

  const periodTotalSales = chartData.reduce((s, d) => s + d.sales, 0);
  const avgDailySales = chartData.length > 0 ? periodTotalSales / chartData.length : 0;

  const periodLabel = dateFilter === 'week' ? '7 Hari' : dateFilter === 'month' ? '30 Hari' : 'Periode';

  return (
    <div className="font-sans text-slate-800 antialiased min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-0">
      <main className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-slate-500 mb-0.5">{getGreeting()}, <span className="font-semibold text-slate-700">{profile?.full_name || 'User'}</span></p>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard {profile?.pharmacy_name ? `— ${profile.pharmacy_name}` : ''}</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Statistik</span>
              <button onClick={() => setShowStats(!showStats)}
                className={`relative w-10 h-6 rounded-full transition-colors ${showStats ? 'bg-blue-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${showStats ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Periode</span>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="week">7 Hari Terakhir</option>
                <option value="month">30 Hari Terakhir</option>
                <option value="all">Semua Waktu</option>
              </select>
            </div>
            <button onClick={() => navigate('/pos')}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]">
              <Plus weight="bold" className="w-4 h-4" /> Buka Kasir
            </button>
          </div>
        </div>

        {/* License Expiry Warnings */}
        {profile?.role === 'owner' && (() => {
          const licenseChecks = [
            { label: 'SIA', date: profile.sia_expiry_date },
            { label: 'SIPA', date: profile.sipa_expiry_date },
            { label: 'STRA', date: profile.stra_expiry_date },
          ];
          const alerts = licenseChecks
            .map(l => ({ ...l, info: getLicenseExpiryStatus(l.date) }))
            .filter(l => l.date && (l.info.status === 'expired' || l.info.status === 'critical' || l.info.status === 'warning'));

          if (alerts.length === 0) return null;

          return (
            <div className="mb-6 space-y-2">
              {alerts.map(alert => (
                <div
                  key={alert.label}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    alert.info.status === 'expired'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : alert.info.status === 'critical'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  }`}
                >
                  <Warning weight="fill" className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{alert.label}:</strong> {alert.info.label}.{' '}
                    <button
                      onClick={() => navigate('/settings')}
                      className="underline hover:no-underline font-semibold"
                    >
                      Perbarui di Pengaturan
                    </button>
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {/* KPI 1: Total Sales */}
            <div className="bg-white p-6 rounded-[24px] shadow-soft border border-slate-100 relative group cursor-pointer hover:border-blue-100 transition-colors">
              <button className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                <ArrowUpRight weight="bold" className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><Coins weight="fill" className="w-4 h-4" /></div>
                <span className="font-medium text-slate-600">Total Penjualan</span>
              </div>
              {loading ? <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-2/3 mb-4" /> : (
                <h3 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">{formatRupiah(metrics.totalSales)}</h3>
              )}
              <div className="text-sm"><span className="text-slate-400 font-medium text-xs">{metrics.totalTransactions} transaksi</span></div>
            </div>

            {/* KPI 2: Items Sold */}
            <div className="bg-white p-6 rounded-[24px] shadow-soft border border-slate-100 relative group cursor-pointer hover:border-emerald-100 transition-colors">
              <button className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                <ArrowUpRight weight="bold" className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><Package weight="fill" className="w-4 h-4" /></div>
                <span className="font-medium text-slate-600">Obat Terjual</span>
              </div>
              {loading ? <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-1/2 mb-4" /> : (
                <h3 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight flex items-baseline gap-2">
                  {metrics.itemsSold} <span className="text-base font-medium text-slate-400">Pcs</span>
                </h3>
              )}
              <div className="text-sm"><span className="text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-xs">Realtime</span></div>
            </div>

            {/* KPI 3: Critical Stock */}
            <div className="bg-white p-6 rounded-[24px] shadow-soft border border-slate-100 relative group cursor-pointer hover:border-rose-100 transition-colors" onClick={() => navigate('/medicines')}>
              <button className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">
                <ArrowUpRight weight="bold" className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><Warning weight="fill" className="w-4 h-4" /></div>
                <span className="font-medium text-slate-600">Stok Kritis</span>
              </div>
              {loading ? <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-1/3 mb-4" /> : (
                <h3 className={`text-3xl font-bold mb-4 tracking-tight flex items-baseline gap-2 ${metrics.criticalStockCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {metrics.criticalStockCount} <span className="text-base font-medium text-slate-400">Item</span>
                </h3>
              )}
              <div className="text-sm">
                {metrics.criticalStockCount > 0
                  ? <span className="text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded-md text-xs">Segera Restock!</span>
                  : <span className="text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-xs">Aman</span>}
              </div>
            </div>

            {/* KPI 4: Expiry Warning */}
            <div className="bg-white p-6 rounded-[24px] shadow-soft border border-slate-100 relative group cursor-pointer hover:border-amber-100 transition-colors" onClick={() => navigate('/medicines')}>
              <button className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                <ArrowUpRight weight="bold" className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center"><Calendar weight="fill" className="w-4 h-4" /></div>
                <span className="font-medium text-slate-600">Akan Kedaluwarsa</span>
              </div>
              {loading ? <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-1/3 mb-4" /> : (
                <h3 className={`text-3xl font-bold mb-4 tracking-tight flex items-baseline gap-2 ${metrics.expiryCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {metrics.expiryCount} <span className="text-base font-medium text-slate-400">Item</span>
                </h3>
              )}
              <div className="text-sm">
                {metrics.expiryCount > 0
                  ? <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md text-xs">Cek Rak Obat (FEFO)</span>
                  : <span className="text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-xs">Aman</span>}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart */}
          <div className="lg:col-span-8 bg-white rounded-[24px] p-6 shadow-soft border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm"><ChartLineUp weight="fill" className="w-4 h-4" /></div>
                <h2 className="text-lg font-bold text-slate-800">{getChartTitle()}</h2>
              </div>
            </div>

            <div className="h-72 w-full relative mb-6">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : chartData.every(d => d.sales === 0) ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <ShoppingCart className="w-12 h-12 text-slate-200 mb-3" />
                  <p className="text-sm font-medium">Belum ada data penjualan</p>
                  <p className="text-xs">Mulai transaksi untuk melihat grafik</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: chartData.length > 7 ? 10 : 13, fontWeight: 500 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(value) => value === 0 ? '0' : `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    {avgDailySales > 0 && <ReferenceLine y={avgDailySales} stroke="#94a3b8" strokeDasharray="4 4" />}
                    <Bar dataKey="sales" radius={[50, 50, 50, 50]} barSize={chartData.length > 7 ? 12 : 40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isToday ? '#3b82f6' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total {periodLabel}</p>
                <h4 className="text-xl font-bold text-slate-800">{formatRupiah(periodTotalSales)}</h4>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Rata-rata Harian</p>
                <h4 className="text-xl font-bold text-slate-800">{formatRupiah(Math.round(avgDailySales))}</h4>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Hari Ini</p>
                <h4 className="text-xl font-bold text-blue-600">{formatRupiah(chartData.length > 0 ? chartData[chartData.length - 1].sales : 0)}</h4>
              </div>
            </div>
          </div>

          {/* Top Selling */}
          <div className="lg:col-span-4 bg-white rounded-[24px] p-6 shadow-soft border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm"><Star weight="fill" className="w-4 h-4" /></div>
                <h2 className="text-lg font-bold text-slate-800">Obat Terlaris</h2>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-lg mb-2">
              <span className="text-sm font-medium text-slate-700">Nama Produk</span>
              <span className="text-sm font-medium text-slate-700">Terjual</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 animate-pulse">
                    <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-slate-100" /><div><div className="h-4 bg-slate-100 rounded w-24 mb-2" /><div className="h-3 bg-slate-100 rounded w-16" /></div></div>
                    <div className="h-4 bg-slate-100 rounded w-12" />
                  </div>
                ))
              ) : topSelling.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 py-8">
                  <div className="text-center"><Star className="w-10 h-10 text-slate-200 mx-auto mb-2" /><p className="text-sm">Belum ada data penjualan</p></div>
                </div>
              ) : (
                topSelling.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200/60 p-1 flex items-center justify-center">{getCategoryIcon(item.category)}</div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-md ${getCategoryBadge(item.category)}`}>{item.category || 'Umum'}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{item.totalQty} {item.unit}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Critical Stock Alerts */}
          <div className="lg:col-span-6 bg-white rounded-[24px] p-6 shadow-soft border border-slate-100 flex flex-col mt-6 lg:mt-0 xl:col-span-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm"><Warning weight="fill" className="w-4 h-4" /></div>
                <h2 className="text-lg font-bold text-slate-800">Peringatan Stok Limit</h2>
              </div>
              <button onClick={() => navigate('/medicines')} className="text-sm text-blue-500 hover:text-blue-700 font-semibold">Lihat Semua</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                 <div className="p-4 text-center text-slate-400 text-sm animate-pulse">Memuat data...</div>
              ) : criticalItems.length === 0 ? (
                 <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Stok obat aman</p>
                 </div>
              ) : (
                 <div className="space-y-2">
                   {criticalItems.map((med, idx) => (
                     <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors">
                       <div>
                         <p className="font-bold text-slate-800 text-sm">{med.name}</p>
                         <p className="text-xs text-slate-500 mt-0.5">Minimal Stok: {med.min_stock} {med.unit}</p>
                       </div>
                       <div className="text-right">
                         <span className="font-bold text-rose-600 px-2.5 py-1 bg-white rounded-lg border border-rose-100 shadow-sm">{med.stock} {med.unit}</span>
                       </div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </div>

          {/* Near Expiry Alerts */}
          <div className="lg:col-span-6 bg-white rounded-[24px] p-6 shadow-soft border border-slate-100 flex flex-col mt-6 lg:mt-0 xl:col-span-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shadow-sm"><Calendar weight="fill" className="w-4 h-4" /></div>
                <h2 className="text-lg font-bold text-slate-800">Segera Kedaluwarsa (FEFO)</h2>
              </div>
              <button onClick={() => navigate('/medicines')} className="text-sm text-blue-500 hover:text-blue-700 font-semibold">Lihat Semua</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                 <div className="p-4 text-center text-slate-400 text-sm animate-pulse">Memuat data...</div>
              ) : expiryItems.length === 0 ? (
                 <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Batas kedaluwarsa aman</p>
                 </div>
              ) : (
                 <div className="space-y-2">
                   {expiryItems.map((med, idx) => {
                     const status = getExpiryStatus(med.expiry_date);
                     const isExpired = status === 'expired';
                     return (
                       <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isExpired ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-100' : 'bg-amber-50/50 hover:bg-amber-50 border-amber-100'}`}>
                         <div>
                           <p className="font-bold text-slate-800 text-sm">{med.name}</p>
                           <p className="text-xs text-slate-500 mt-0.5">Sisa Stok: {med.stock} {med.unit}</p>
                         </div>
                         <div className="text-right">
                           <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border shadow-sm ${isExpired ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                             {new Date(med.expiry_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                             {isExpired ? ' (Expired)' : ''}
                           </span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
