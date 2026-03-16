import { useState, useEffect } from 'react';
import {
  CurrencyCircleDollar, TrendUp, TrendDown, Receipt, ChartLine,
  DownloadSimple, CalendarBlank, Warning
} from '@phosphor-icons/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { formatRupiah } from '../lib/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type PeriodFilter = '1m' | '3m' | '6m' | '12m';

type MonthlyFinancial = {
  month: string;       // "Jan 2026"
  omset: number;
  hpp: number;
  labaKotor: number;
  pembelian: number;   // total beli ke PBF
};

type APSummary = {
  total_hutang: number;
  total_lunas: number;
  outstanding: number;
  invoice_count: number;
  overdue_count: number;
};

export default function LaporanKeuangan() {
  const { effectiveUserId, profile } = useAuth();
  const { checkFeature } = useSubscription();
  const hasFeature = checkFeature('laporan');

  const [period, setPeriod] = useState<PeriodFilter>('3m');
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyFinancial[]>([]);
  const [apSummary, setApSummary] = useState<APSummary | null>(null);

  // Totals
  const totalOmset    = monthlyData.reduce((s, m) => s + m.omset, 0);
  const totalHPP      = monthlyData.reduce((s, m) => s + m.hpp, 0);
  const totalLabaKotor= monthlyData.reduce((s, m) => s + m.labaKotor, 0);
  const totalPembelian= monthlyData.reduce((s, m) => s + m.pembelian, 0);
  const marginPct     = totalOmset > 0 ? (totalLabaKotor / totalOmset) * 100 : 0;

  const fetchData = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      // Date range
      const now = new Date();
      const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

      // Build month buckets
      const buckets: Record<string, MonthlyFinancial> = {};
      for (let i = 0; i < months; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets[key] = {
          month: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          omset: 0,
          hpp: 0,
          labaKotor: 0,
          pembelian: 0,
        };
      }

      // Fetch transactions
      const { data: trxData } = await supabase
        .from('transactions')
        .select('total_amount, created_at, transaction_items(quantity, price_at_transaction, discount_amount, medicines(buy_price))')
        .eq('user_id', effectiveUserId)
        .eq('status', 'active')
        .gte('created_at', startDate.toISOString());

      (trxData || []).forEach((trx: Record<string, unknown>) => {
        const d = new Date(trx.created_at as string);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets[key]) return;
        const totalAmt = (trx.total_amount as number) || 0;
        buckets[key].omset += totalAmt;
        const items = (trx.transaction_items as Record<string, unknown>[]) || [];
        items.forEach((item: Record<string, unknown>) => {
          const qty = (item.quantity as number) || 0;
          const buyPrice = ((item.medicines as Record<string, unknown>)?.buy_price as number) || 0;
          buckets[key].hpp += qty * buyPrice;
        });
      });

      // Fetch purchase orders (pembelian ke PBF)
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('total_amount, order_date, status')
        .eq('pharmacy_id', effectiveUserId)
        .in('status', ['received'])
        .gte('order_date', startDate.toISOString().split('T')[0]);

      (poData || []).forEach((po: Record<string, unknown>) => {
        const d = new Date(po.order_date as string);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets[key]) return;
        buckets[key].pembelian += (po.total_amount as number) || 0;
      });

      // Calculate laba kotor
      Object.keys(buckets).forEach(k => {
        buckets[k].labaKotor = buckets[k].omset - buckets[k].hpp;
      });

      setMonthlyData(Object.values(buckets));

      // Fetch AP summary (hutang PBF)
      const { data: invoices } = await supabase
        .from('pbf_invoices')
        .select('total_amount, amount_paid, status, due_date')
        .eq('pharmacy_id', effectiveUserId);

      if (invoices && invoices.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        let total_hutang = 0, total_lunas = 0, overdue = 0;
        (invoices as Record<string, unknown>[]).forEach((inv) => {
          const ta = (inv.total_amount as number) || 0;
          const ap = (inv.amount_paid as number) || 0;
          total_hutang += ta;
          total_lunas  += ap;
          const outstanding_inv = ta - ap;
          if (outstanding_inv > 0 && (inv.due_date as string) < today) overdue++;
        });
        setApSummary({
          total_hutang,
          total_lunas,
          outstanding: total_hutang - total_lunas,
          invoice_count: invoices.length,
          overdue_count: overdue,
        });
      } else {
        setApSummary(null);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId, period]);

  const handleExportExcel = () => {
    if (monthlyData.length === 0) return toast.info('Tidak ada data untuk di-export');
    const rows = monthlyData.map(m => [
      m.month, m.omset, m.hpp, m.labaKotor,
      m.omset > 0 ? ((m.labaKotor / m.omset) * 100).toFixed(1) + '%' : '0%',
      m.pembelian
    ]);
    const totalRow = ['TOTAL', totalOmset, totalHPP, totalLabaKotor, marginPct.toFixed(1) + '%', totalPembelian];
    const firstMonth = monthlyData.length > 0 ? monthlyData[0].month : '';
    const lastMonth  = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].month : '';
    const header = [['', 'MediSir – Laporan Keuangan'], ['Apotek', profile?.pharmacy_name || ''], ['Periode', `${firstMonth} – ${lastMonth}`], []];
    const colHeaders = [['Bulan', 'Omset (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)', 'Pembelian PBF (Rp)']];
    const allRows = [...header, ...colHeaders, ...rows, [], totalRow];
    const tableHTML = allRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${tableHTML}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-keuangan-${period}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan keuangan berhasil di-export ke Excel!');
  };

  if (!hasFeature) {
    return (
      <div className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <CurrencyCircleDollar weight="fill" className="w-16 h-16 text-blue-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Laporan Keuangan</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
            Fitur laporan keuangan lengkap dengan grafik P&L dan analisis hutang dagang
            tersedia di plan <b>Starter</b> ke atas.
          </p>
          <Link to="/billing" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            Upgrade Sekarang
          </Link>
        </div>
      </div>
    );
  }

  const chartData = monthlyData.map(m => ({
    name: m.month,
    Omset: m.omset,
    HPP: m.hpp,
    'Laba Kotor': m.labaKotor,
    Pembelian: m.pembelian,
  }));

  return (
    <div className="flex-1 overflow-x-hidden p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CurrencyCircleDollar weight="fill" className="w-6 h-6 text-indigo-600" />
            Laporan Keuangan
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Laba rugi, hutang dagang, dan rekap pembelian per bulan
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Filter */}
          <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
            {(['1m', '3m', '6m', '12m'] as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  period === p
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {p === '1m' ? '1 Bln' : p === '3m' ? '3 Bln' : p === '6m' ? '6 Bln' : '12 Bln'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <DownloadSimple weight="bold" className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat laporan keuangan...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Omset</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(totalOmset)}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <TrendUp className="w-3.5 h-3.5 text-emerald-500" />
                {monthlyData.length} bulan
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total HPP</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(totalHPP)}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <TrendDown className="w-3.5 h-3.5 text-rose-500" />
                Harga Pokok Penjualan
              </p>
            </div>
            <div className={`rounded-xl p-5 shadow-sm border ${totalLabaKotor >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalLabaKotor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>Laba Kotor</p>
              <p className={`text-lg font-semibold ${totalLabaKotor >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700'}`}>{formatRupiah(totalLabaKotor)}</p>
              <p className={`text-xs mt-1 font-semibold ${totalLabaKotor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                Margin {marginPct.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pembelian PBF</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(totalPembelian)}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5" />
                SP diterima
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
            <h2 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <ChartLine weight="fill" className="w-5 h-5 text-indigo-600" />
              Grafik Laba Rugi per Bulan
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Jt`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatRupiah(Number(v ?? 0))} />
                <Bar dataKey="Omset" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="HPP" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Laba Kotor" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-8 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="font-bold text-gray-700 dark:text-gray-200">Rincian per Bulan</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-3 text-left">Bulan</th>
                    <th className="px-5 py-3 text-right">Omset</th>
                    <th className="px-5 py-3 text-right">HPP</th>
                    <th className="px-5 py-3 text-right">Laba Kotor</th>
                    <th className="px-5 py-3 text-right">Margin</th>
                    <th className="px-5 py-3 text-right">Pembelian PBF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {monthlyData.map((m) => {
                    const margin = m.omset > 0 ? (m.labaKotor / m.omset) * 100 : 0;
                    return (
                      <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <CalendarBlank className="w-4 h-4 text-gray-400" />
                          {m.month}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-700 dark:text-gray-200">{formatRupiah(m.omset)}</td>
                        <td className="px-5 py-3 text-right text-rose-600 dark:text-rose-400">{formatRupiah(m.hpp)}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${m.labaKotor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatRupiah(m.labaKotor)}
                        </td>
                        <td className={`px-5 py-3 text-right text-sm font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {margin.toFixed(1)}%
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{formatRupiah(m.pembelian)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-zinc-800 font-bold">
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">TOTAL</td>
                    <td className="px-5 py-3 text-right text-indigo-600">{formatRupiah(totalOmset)}</td>
                    <td className="px-5 py-3 text-right text-rose-600">{formatRupiah(totalHPP)}</td>
                    <td className={`px-5 py-3 text-right ${totalLabaKotor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatRupiah(totalLabaKotor)}</td>
                    <td className={`px-5 py-3 text-right ${marginPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{marginPct.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatRupiah(totalPembelian)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* AP Summary */}
          {apSummary && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
              <h2 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                <Receipt weight="fill" className="w-5 h-5 text-amber-500" />
                Hutang Dagang (Account Payable / PBF)
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center bg-gray-50 dark:bg-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Hutang</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(apSummary.total_hutang)}</p>
                </div>
                <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 mb-1">Sudah Lunas</p>
                  <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">{formatRupiah(apSummary.total_lunas)}</p>
                </div>
                <div className={`text-center rounded-xl p-4 ${apSummary.outstanding > 0 ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                  <p className={`text-xs mb-1 ${apSummary.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Belum Lunas</p>
                  <p className={`text-base font-semibold ${apSummary.outstanding > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{formatRupiah(apSummary.outstanding)}</p>
                </div>
                <div className={`text-center rounded-xl p-4 ${apSummary.overdue_count > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-zinc-800'}`}>
                  <p className={`text-xs mb-1 ${apSummary.overdue_count > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Jatuh Tempo Lewat</p>
                  <p className={`text-base font-semibold ${apSummary.overdue_count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-200'}`}>{apSummary.overdue_count} Faktur</p>
                </div>
              </div>
              {apSummary.overdue_count > 0 && (
                <div className="mt-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-300">
                  <Warning weight="fill" className="w-4 h-4 shrink-0" />
                  Terdapat {apSummary.overdue_count} faktur PBF yang sudah melewati jatuh tempo. Segera selesaikan pembayaran.
                </div>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Catatan:</span> Laporan ini merupakan <b>laporan internal</b> berdasarkan data transaksi di MediSir.
            Untuk laporan pajak resmi, silakan konsultasikan dengan akuntan atau konsultan pajak Anda.
            HPP dihitung berdasarkan harga beli saat pembelian dicatat.
          </div>
        </>
      )}
    </div>
  );
}
