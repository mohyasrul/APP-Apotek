import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { useSubscription } from "../lib/SubscriptionContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { MagnifyingGlass, Coins, Package, CaretLeft, CaretRight, Eye, X, Receipt, DownloadSimple, Printer, Prohibit, ChartBar, Warning, Rocket } from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatRupiah } from "../lib/types";
import type { ProcessedTransaction, DateFilterType, Transaction, TransactionItem } from "../lib/types";
import { printReceipt } from "../lib/receipt";
import { Link } from "react-router-dom";

const PAGE_SIZE = 15;

export default function Laporan() {
  const { user, profile, effectiveUserId } = useAuth();
  const { checkFeature } = useSubscription();

  const hasLaporanFeature = checkFeature('laporan');

  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'qris' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Detail modal
  const [selectedTrx, setSelectedTrx] = useState<ProcessedTransaction | null>(null);

  // Void modal
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const [chartData, setChartData] = useState<{ date: string; omset: number; count: number }[]>([]);

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    omset: 0,
    labaKotor: 0,
    trxCount: 0
  });

  useEffect(() => {
    if (user) {
      setPage(0);
      fetchMetrics();
      fetchChartData();
      fetchData();
    }
  }, [user, dateFilter, paymentFilter]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [page]);

  const getDateRange = () => {
    const today = new Date();
    const startDate = new Date();

    if (dateFilter === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'week') {
      startDate.setDate(today.getDate() - 7);
    } else if (dateFilter === 'month') {
      startDate.setMonth(today.getMonth() - 1);
    } else {
      return null;
    }

    return startDate.toISOString();
  };

  // Fetch accurate metrics (separate from paginated data)
  const fetchMetrics = async () => {
    try {
      const startDate = getDateRange();

      // Try RPC first (accurate server-side calculation)
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('get_total_laba', {
          p_user_id: effectiveUserId,
          p_start_date: startDate
        });

        if (!rpcError && rpcResult) {
          setMetrics({
            omset: rpcResult.omset || 0,
            labaKotor: rpcResult.laba_kotor || 0,
            trxCount: rpcResult.trx_count || 0,
          });
          return;
        }
      } catch {
        // RPC not available, fallback
      }

      // Fallback: fetch all transactions for metrics
      let metricsQuery = supabase
        .from('transactions')
        .select(`
          total_amount,
          transaction_items (
            quantity, price_at_transaction,
            medicines ( buy_price )
          )
        `)
        .eq('user_id', effectiveUserId);

      if (startDate) {
        metricsQuery = metricsQuery.gte('created_at', startDate);
      }

      const { data: allTrx, error } = await metricsQuery;
      if (error) throw error;

      let totalOmset = 0;
      let totalLaba = 0;

      // Minimal type for metrics query (partial select)
      type MetricsTrxRow = {
        total_amount: number;
        transaction_items: Array<{
          quantity: number;
          price_at_transaction: number;
          medicines: { buy_price: number | null } | null;
        }>;
      };

      (allTrx as unknown as MetricsTrxRow[])?.forEach((trx) => {
        totalOmset += trx.total_amount || 0;
        trx.transaction_items?.forEach((item) => {
          const buyPrice = item.medicines?.buy_price || 0;
          totalLaba += (item.price_at_transaction - buyPrice) * item.quantity;
        });
      });

      setMetrics({
        omset: totalOmset,
        labaKotor: totalLaba,
        trxCount: allTrx?.length || 0,
      });
    } catch (error: unknown) {
      toast.error('Gagal memuat metrik: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    }
  };

  const fetchChartData = async () => {
    try {
      const startDate = getDateRange();
      let query = supabase
        .from('transactions')
        .select('created_at, total_amount')
        .eq('user_id', effectiveUserId)
        .neq('status', 'voided');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by date
      const grouped: Record<string, { omset: number; count: number }> = {};

      // Pre-fill dates based on filter
      const days = dateFilter === 'today' ? 1 : dateFilter === 'week' ? 7 : dateFilter === 'month' ? 30 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        grouped[key] = { omset: 0, count: 0 };
      }

      data?.forEach((trx: { created_at: string; total_amount: number }) => {
        const key = new Date(trx.created_at).toISOString().split('T')[0];
        if (!grouped[key]) grouped[key] = { omset: 0, count: 0 };
        grouped[key].omset += trx.total_amount || 0;
        grouped[key].count += 1;
      });

      const result = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => ({
          date: new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
          omset: val.omset,
          count: val.count,
        }));

      setChartData(result);
    } catch {
      // silent
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const startDate = getDateRange();

      // Count query
      let countQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      if (startDate) {
        countQuery = countQuery.gte('created_at', startDate);
      }
      if (paymentFilter !== 'all') {
        countQuery = countQuery.eq('payment_method', paymentFilter);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Data query with pagination
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from('transactions')
        .select(`
          *,
          transaction_items (
            quantity,
            price_at_transaction,
            discount_amount,
            medicines (
              name,
              buy_price,
              unit
            )
          )
        `)
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (startDate) {
        dataQuery = dataQuery.gte('created_at', startDate);
      }
      if (paymentFilter !== 'all') {
        dataQuery = dataQuery.eq('payment_method', paymentFilter);
      }

      const { data: trxData, error: trxError } = await dataQuery;
      if (trxError) throw trxError;

      const processedTrx: ProcessedTransaction[] = trxData?.map((trx: Transaction) => {
        let labaTrx = 0;

        trx.transaction_items?.forEach((item: TransactionItem) => {
          const buyPrice = item.medicines?.buy_price || 0;
          const sellPrice = item.price_at_transaction;
          const qty = item.quantity;
          labaTrx += (sellPrice - buyPrice) * qty;
        });

        return {
          ...trx,
          laba: labaTrx,
          itemsCount: trx.transaction_items?.reduce((sum: number, it: TransactionItem) => sum + it.quantity, 0) || 0
        };
      }) || [];

      setTransactions(processedTrx);
    } catch (error: unknown) {
      toast.error('Gagal memuat laporan: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  const filteredTrx = transactions.filter(trx =>
    (trx.transaction_number || trx.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    trx.payment_method?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleVoid = async () => {
    if (!selectedTrx || !user || !voidReason.trim()) {
      toast.warning('Masukkan alasan pembatalan');
      return;
    }
    setIsVoiding(true);
    try {
      const { error } = await supabase.rpc('void_transaction', {
        p_transaction_id: selectedTrx.id,
        p_user_id: effectiveUserId,
        p_reason: voidReason.trim(),
      });
      if (error) throw error;
      toast.success('Transaksi berhasil dibatalkan, stok dikembalikan');
      setShowVoidModal(false);
      setVoidReason('');
      setSelectedTrx(null);
      fetchData();
      fetchMetrics();
    } catch (err: unknown) {
      toast.error('Gagal membatalkan transaksi: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setIsVoiding(false);
    }
  };

  const handleReprint = (trx: ProcessedTransaction) => {
    const items = trx.transaction_items?.map((ti: TransactionItem) => ({
      name: ti.medicines?.name || 'Item',
      quantity: ti.quantity,
      price: ti.price_at_transaction,
      unit: ti.medicines?.unit,
    })) || [];

    printReceipt({
      transactionNumber: trx.transaction_number || trx.id.split('-')[0].toUpperCase(),
      date: new Date(trx.created_at).toLocaleString('id-ID'),
      items,
      total: trx.total_amount,
      discount: trx.discount_total || 0,
      paymentMethod: trx.payment_method || 'cash',
      pharmacyName: profile?.pharmacy_name || 'APOTEK',
      pharmacyAddress: profile?.pharmacy_address || '',
      pharmacyPhone: profile?.phone || '',
      apotekerName: profile?.apoteker_name || undefined,
      siaNumber: profile?.sia_number || undefined,
      sipaNumber: profile?.sipa_number || undefined,
      logoUrl: profile?.logo_url || undefined,
    });
  };

  // Check if a transaction can be voided (only active, within H+1)
  const canVoid = (trx: ProcessedTransaction) => {
    if (trx.status === 'voided') return false;
    const trxDate = new Date(trx.created_at);
    const now = new Date();
    const diffHours = (now.getTime() - trxDate.getTime()) / (1000 * 60 * 60);
    return diffHours <= 36; // within 36 hours
  };

  const getPaymentLabel = (method: string) => {
    const map: Record<string, { label: string; class: string }> = {
      cash: { label: 'Tunai', class: 'bg-emerald-50 text-emerald-600' },
      qris: { label: 'QRIS', class: 'bg-blue-50 text-blue-600' },
      transfer: { label: 'Transfer', class: 'bg-purple-50 text-purple-600' },
    };
    return map[method] || { label: method, class: 'bg-slate-100 text-slate-600' };
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (transactions.length === 0) {
      toast.info('Tidak ada data untuk di-export');
      return;
    }

    const rows = transactions.map(trx => ({
      'No. Nota': trx.transaction_number || trx.id,
      'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
      'Metode Bayar': getPaymentLabel(trx.payment_method || 'cash').label,
      'Jumlah Item': trx.itemsCount,
      'Laba Kotor': trx.laba,
      'Total': trx.total_amount,
      'Status': trx.status === 'voided' ? 'VOID' : 'Aktif',
      'Pelanggan': trx.customer_name || '-',
    }));

    const Papa = (await import("papaparse")).default;
    const csv = Papa.unparse(rows);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${dateFilter}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan berhasil di-export ke CSV!');
  };

  // Export Excel (.xlsx via XML spreadsheet)
  const handleExportExcel = () => {
    if (transactions.length === 0) {
      toast.info('Tidak ada data untuk di-export');
      return;
    }

    const pharmacyName = profile?.pharmacy_name || 'Apotek';
    const periodLabel = dateFilter === 'today' ? 'Hari Ini' : dateFilter === 'week' ? '7 Hari Terakhir' : dateFilter === 'month' ? '30 Hari Terakhir' : 'Semua Data';

    const escapeXml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const headerRow = `<tr><td><b>${escapeXml(pharmacyName)} — Laporan Penjualan</b></td></tr><tr><td>Periode: ${escapeXml(periodLabel)} | Dicetak: ${new Date().toLocaleString('id-ID')}</td></tr><tr></tr>`;

    const tableHeader = '<tr>' +
      ['No. Nota', 'Tanggal', 'Metode Bayar', 'Jumlah Item', 'Laba Kotor (Rp)', 'Total (Rp)', 'Status', 'Pelanggan']
        .map(h => `<th style="font-weight:bold;background-color:#f1f5f9;border:1px solid #ccc;padding:6px">${h}</th>`)
        .join('') +
      '</tr>';

    const tableRows = transactions.map(trx => {
      const nota = escapeXml(trx.transaction_number || trx.id);
      const tanggal = new Date(trx.created_at).toLocaleString('id-ID');
      const metode = getPaymentLabel(trx.payment_method || 'cash').label;
      const items = trx.itemsCount;
      const laba = trx.laba;
      const total = trx.total_amount;
      const status = trx.status === 'voided' ? 'VOID' : 'Aktif';
      const pelanggan = escapeXml(trx.customer_name || '-');

      return `<tr><td style="border:1px solid #ccc;padding:4px">${nota}</td><td style="border:1px solid #ccc;padding:4px">${tanggal}</td><td style="border:1px solid #ccc;padding:4px">${metode}</td><td style="border:1px solid #ccc;padding:4px;text-align:right">${items}</td><td style="border:1px solid #ccc;padding:4px;text-align:right">${laba.toLocaleString('id-ID')}</td><td style="border:1px solid #ccc;padding:4px;text-align:right">${total.toLocaleString('id-ID')}</td><td style="border:1px solid #ccc;padding:4px">${status}</td><td style="border:1px solid #ccc;padding:4px">${pelanggan}</td></tr>`;
    }).join('');

    const summaryRow = `<tr><td colspan="4" style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:bold">Total:</td><td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:bold">${metrics.labaKotor.toLocaleString('id-ID')}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:bold">${metrics.omset.toLocaleString('id-ID')}</td><td colspan="2" style="border:1px solid #ccc;padding:6px"></td></tr>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Laporan</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>${headerRow}${tableHeader}${tableRows}${summaryRow}</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${dateFilter}-${Date.now()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan berhasil di-export ke Excel!');
  };

  // Print Report
  const handlePrintReport = () => {
    const pharmacyName = profile?.pharmacy_name || 'Apotek';
    const periodLabel = dateFilter === 'today' ? 'Hari Ini' : dateFilter === 'week' ? '7 Hari Terakhir' : dateFilter === 'month' ? '30 Hari Terakhir' : 'Semua Data';
    const paymentLabel = paymentFilter === 'all' ? 'Semua Metode' : paymentFilter === 'cash' ? 'Tunai' : paymentFilter === 'qris' ? 'QRIS' : 'Transfer';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Laporan ${pharmacyName}</title>
<style>body{font-family:sans-serif;padding:24px;font-size:12px}h2{margin:0 0 4px}p{margin:2px 0 8px;color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f1f5f9;font-weight:600}tfoot td{font-weight:700;background:#f8fafc}@media print{button{display:none}}</style>
</head><body>
<h2>${pharmacyName} — Laporan Penjualan</h2>
<p>Periode: ${periodLabel} | Metode: ${paymentLabel}</p>
<p>Dicetak: ${new Date().toLocaleString('id-ID')} | Total Transaksi: ${transactions.length} | Omzet: Rp ${metrics.omset.toLocaleString('id-ID')}</p>
<table><thead><tr><th>No. Nota</th><th>Tanggal</th><th>Metode</th><th>Item</th><th>Total</th><th>Status</th></tr></thead>
<tbody>${transactions.map(t => `<tr><td>${t.transaction_number || t.id.slice(0,8)}</td><td>${new Date(t.created_at).toLocaleString('id-ID')}</td><td>${getPaymentLabel(t.payment_method || 'cash').label}</td><td style="text-align:center">${t.itemsCount}</td><td style="text-align:right">Rp ${t.total_amount?.toLocaleString('id-ID')}</td><td>${t.status === 'voided' ? 'VOID' : 'Aktif'}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="4" style="text-align:right">Total Omzet:</td><td style="text-align:right">Rp ${metrics.omset.toLocaleString('id-ID')}</td><td></td></tr></tfoot>
</table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  return (
    <div className="font-sans text-slate-800 antialiased min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-0">

      <main className="flex-1 p-6 lg:p-8 max-w-[1200px] mx-auto w-full">

        {/* Feature Gate - show upgrade prompt if not available */}
        {!hasLaporanFeature && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 text-center mb-8">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Warning weight="fill" className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Fitur Laporan Premium</h2>
            <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
              Fitur laporan lengkap dengan grafik, export CSV, dan analisis laba tersedia
              di paket Starter ke atas. Upgrade sekarang untuk akses penuh.
            </p>
            <Link
              to="/billing"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              <Rocket weight="bold" className="w-5 h-5" />
              Upgrade Sekarang
            </Link>
          </div>
        )}

        {hasLaporanFeature && (
          <>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Laporan Penjualan</h1>
            <p className="text-sm text-slate-500">Pantau omzet, laba kotor, dan riwayat transaksi apotek Anda.</p>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
              {[
                { value: 'today' as DateFilterType, label: 'Hari Ini' },
                { value: 'week' as DateFilterType, label: '7 Hari' },
                { value: 'month' as DateFilterType, label: '30 Hari' },
                { value: 'all' as DateFilterType, label: 'Semua' },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setDateFilter(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    dateFilter === f.value
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={handlePrintReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              <Printer weight="bold" className="w-4 h-4" /> Print
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              <DownloadSimple weight="bold" className="w-4 h-4" /> CSV
            </button>
            <button onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm border-emerald-200">
              <DownloadSimple weight="bold" className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Coins weight="fill" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Omzet</p>
              {loading ? <div className="h-7 w-32 bg-slate-100 rounded-lg animate-pulse" /> : (
                <h3 className="text-2xl font-bold text-slate-800">{formatRupiah(metrics.omset)}</h3>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package weight="fill" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Transaksi</p>
              {loading ? <div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" /> : (
                <h3 className="text-2xl font-bold text-slate-800">{metrics.trxCount} <span className="text-base font-medium text-slate-400">Nota</span></h3>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-4 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4"><Coins weight="fill" className="w-32 h-32" /></div>
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">Estimasi Laba Kotor</p>
              {loading ? <div className="h-7 w-32 bg-slate-700 rounded-lg animate-pulse" /> : (
                <h3 className="text-2xl font-bold text-emerald-400">{formatRupiah(metrics.labaKotor)}</h3>
              )}
            </div>
          </div>
        </div>

        {/* Sales Trend Chart */}
        {chartData.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ChartBar weight="fill" className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-800">Tren Penjualan</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : String(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '13px',
                    }}
                    formatter={(value) => [formatRupiah(Number(value)), 'Omzet']}
                    labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}
                  />
                  <Bar
                    dataKey="omset"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={chartData.length > 14 ? 16 : 40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">Riwayat Transaksi</h2>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Cari ID atau metode bayar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
                  />
                </div>
              </div>
            </div>

            {/* Payment filter tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              {(['all', 'cash', 'qris', 'transfer'] as const).map(pm => (
                <button key={pm} onClick={() => setPaymentFilter(pm)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    paymentFilter === pm ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {pm === 'all' ? 'Semua' : pm === 'cash' ? 'Tunai' : pm === 'qris' ? 'QRIS' : 'Transfer'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold">TANGGAL & WAKTU</th>
                  <th className="px-6 py-4 font-semibold">NO. NOTA</th>
                  <th className="px-6 py-4 font-semibold">METODE</th>
                  <th className="px-6 py-4 font-semibold">STATUS</th>
                  <th className="px-6 py-4 font-semibold">ITEM</th>
                  <th className="px-6 py-4 font-semibold">LABA KOTOR</th>
                  <th className="px-6 py-4 font-semibold text-right">TOTAL NILAI</th>
                  <th className="px-6 py-4 font-semibold text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${[60, 75, 50, 80, 55, 70, 65][j % 7]}%` }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredTrx.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Belum ada transaksi pada periode ini.</td></tr>
                ) : (
                  filteredTrx.map((trx) => {
                    const pm = getPaymentLabel(trx.payment_method || 'cash');
                    const isVoided = trx.status === 'voided';
                    return (
                      <tr key={trx.id} className={`border-b border-slate-50 transition-colors ${isVoided ? 'opacity-60 bg-rose-50/30' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(trx.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                            {trx.transaction_number || trx.id.split('-')[0].toUpperCase() + '...'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase ${pm.class}`}>{pm.label}</span>
                        </td>
                        <td className="px-6 py-4">
                          {isVoided ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-100 text-rose-600">
                              <Prohibit weight="bold" className="w-3 h-3" /> VOID
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-600">AKTIF</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{trx.itemsCount} Items</td>
                        <td className="px-6 py-4 text-emerald-600 font-medium">{formatRupiah(trx.laba)}</td>
                        <td className="px-6 py-4 text-right"><span className={`font-bold ${isVoided ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{formatRupiah(trx.total_amount)}</span></td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setSelectedTrx(trx)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye weight="bold" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">Halaman {page + 1} dari {totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <CaretLeft weight="bold" className="w-4 h-4 text-slate-600" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <CaretRight weight="bold" className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {/* Transaction Detail Modal */}
      {selectedTrx && !showVoidModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedTrx(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt weight="fill" className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-lg text-slate-800">Detail Transaksi</h3>
                {selectedTrx.status === 'voided' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-100 text-rose-600">
                    <Prohibit weight="bold" className="w-3 h-3" /> VOID
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedTrx(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-between mb-3 text-sm">
                <span className="text-slate-500">No. Nota</span>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">
                  {selectedTrx.transaction_number || selectedTrx.id.split('-')[0].toUpperCase() + '...'}
                </span>
              </div>
              <div className="flex justify-between mb-3 text-sm">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-medium text-slate-800">{new Date(selectedTrx.created_at).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between mb-4 text-sm">
                <span className="text-slate-500">Metode Bayar</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase ${getPaymentLabel(selectedTrx.payment_method || 'cash').class}`}>
                  {getPaymentLabel(selectedTrx.payment_method || 'cash').label}
                </span>
              </div>
              {selectedTrx.void_reason && (
                <div className="mb-4 p-3 bg-rose-50 rounded-xl border border-rose-100 text-sm">
                  <p className="text-xs font-semibold text-rose-600 mb-1">Alasan Pembatalan:</p>
                  <p className="text-rose-700">{selectedTrx.void_reason}</p>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Item Belanja</p>
                <div className="space-y-2">
                  {selectedTrx.transaction_items?.map((item: TransactionItem, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.medicines?.name || 'Item'} x{item.quantity}</span>
                      <span className="font-semibold text-slate-800">{formatRupiah(item.price_at_transaction * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2 mb-5">
                {selectedTrx.discount_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-500">Diskon</span>
                    <span className="font-semibold text-blue-500">-{formatRupiah(selectedTrx.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Laba Kotor</span>
                  <span className="font-semibold text-emerald-600">{formatRupiah(selectedTrx.laba)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="text-xl font-bold text-blue-600">{formatRupiah(selectedTrx.total_amount)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleReprint(selectedTrx)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <Printer weight="bold" className="w-4 h-4" /> Cetak Ulang
                </button>
                {canVoid(selectedTrx) && (
                  <button
                    onClick={() => setShowVoidModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    <Prohibit weight="bold" className="w-4 h-4" /> Batalkan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {selectedTrx && showVoidModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Prohibit weight="fill" className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-lg text-slate-800">Batalkan Transaksi</h3>
              </div>
              <button onClick={() => { setShowVoidModal(false); setVoidReason(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-5">
                <p className="text-sm font-semibold text-rose-700 mb-1">No. Nota: {selectedTrx.transaction_number || selectedTrx.id.split('-')[0].toUpperCase()}</p>
                <p className="text-sm text-rose-600">Total: {formatRupiah(selectedTrx.total_amount)}</p>
                <p className="text-xs text-rose-500 mt-2">⚠ Stok semua item akan dikembalikan secara otomatis.</p>
              </div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Alasan Pembatalan <span className="text-rose-500">*</span></label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none mb-5"
                placeholder="Contoh: Salah obat, salah harga, permintaan pelanggan..."
                autoFocus
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowVoidModal(false); setVoidReason(''); }}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleVoid}
                  disabled={isVoiding || !voidReason.trim()}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-rose-500 rounded-xl hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {isVoiding ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</>
                  ) : (
                    <><Prohibit weight="bold" className="w-4 h-4" /> Konfirmasi Batal</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
