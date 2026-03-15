import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { formatRupiah, getExpiryStatus, UNIT_OPTIONS } from "../lib/types";
import type { Medicine } from "../lib/types";
import {
  Plus, MagnifyingGlass, PencilSimple, TrashSimple, X,
  CaretLeft, CaretRight, UploadSimple, Package, Warning, DownloadSimple,
  ArrowsClockwise, ClockCounterClockwise, ArrowsLeftRight, Archive
} from "@phosphor-icons/react";
import { BatchManagementModal } from "../components/medicines/BatchManagement";
import { StockCardModal } from "../components/inventory/StockCardModal";

const PAGE_SIZE = 20;

export default function Medicines() {
  const { user, profile, effectiveUserId } = useAuth();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Search (server-side)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Filter & Sort
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'stock_asc' | 'expiry_asc'>('name_asc');

  // Form Modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'bebas', barcode: '',
    buy_price: '', sell_price: '', stock: '', expiry_date: '',
    unit: 'tablet', supplier: '', batch_number: '', min_stock: '5',
  });

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Restock modal
  const [restockTarget, setRestockTarget] = useState<Medicine | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [restocking, setRestocking] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<Medicine | null>(null);

  // Medicine alternatives modal
  type AltEntry = { rowId: string; medicine: Medicine };
  const [altTarget, setAltTarget] = useState<Medicine | null>(null);
  const [altList, setAltList] = useState<AltEntry[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [altSearch, setAltSearch] = useState('');
  const [altSearchResults, setAltSearchResults] = useState<Medicine[]>([]);
  const [addingAlt, setAddingAlt] = useState(false);

  // Batch management modal
  const [batchTarget, setBatchTarget] = useState<Medicine | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (user) fetchMedicines();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveUserId, page, searchDebounce, categoryFilter, sortBy]);

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);

      // Build count query
      let countQuery = supabase
        .from('medicines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      if (searchDebounce) {
        countQuery = countQuery.or(`name.ilike.%${searchDebounce}%,barcode.ilike.%${searchDebounce}%`);
      }
      if (categoryFilter !== 'all') {
        countQuery = countQuery.eq('category', categoryFilter);
      }

      // Build data query (independent of count result)
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [sortField, sortDir] = (
        sortBy === 'stock_asc' ? ['stock', true] :
        sortBy === 'expiry_asc' ? ['expiry_date', true] :
        ['name', true]
      ) as [string, boolean];

      let dataQuery = supabase
        .from('medicines')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order(sortField, { ascending: sortDir })
        .range(from, to);

      if (searchDebounce) {
        dataQuery = dataQuery.or(`name.ilike.%${searchDebounce}%,barcode.ilike.%${searchDebounce}%`);
      }
      if (categoryFilter !== 'all') {
        dataQuery = dataQuery.eq('category', categoryFilter);
      }

      // Fire both queries in parallel
      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);
      if (dataResult.error) throw dataResult.error;
      setTotalCount(countResult.count || 0);
      setMedicines(dataResult.data || []);
    } catch (error: unknown) {
      toast.error("Gagal memuat data obat: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveUserId, page, searchDebounce, categoryFilter, sortBy]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetForm = () => {
    setForm({ name: '', category: 'bebas', barcode: '', buy_price: '', sell_price: '', stock: '', expiry_date: '', unit: 'tablet', supplier: '', batch_number: '', min_stock: '5' });
    setEditingId(null);
  };

  const openAddForm = () => { resetForm(); setShowForm(true); };

  const openEditForm = (med: Medicine) => {
    setEditingId(med.id);
    setForm({
      name: med.name,
      category: med.category || 'bebas',
      barcode: med.barcode || '',
      buy_price: med.buy_price.toString(),
      sell_price: med.sell_price.toString(),
      stock: med.stock.toString(),
      expiry_date: med.expiry_date,
      unit: med.unit || 'tablet',
      supplier: med.supplier || '',
      batch_number: med.batch_number || '',
      min_stock: (med.min_stock || 5).toString(),
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const buyPrice = parseInt(form.buy_price);
    const sellPrice = parseInt(form.sell_price);

    if (isNaN(buyPrice) || buyPrice < 0) {
      toast.warning("Harga beli harus berupa angka yang valid!");
      return;
    }
    if (isNaN(sellPrice) || sellPrice < 0) {
      toast.warning("Harga jual harus berupa angka yang valid!");
      return;
    }

    if (sellPrice <= buyPrice) {
      toast.warning("Harga jual harus lebih besar dari harga beli!");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: effectiveUserId,
        name: form.name,
        category: form.category,
        barcode: form.barcode || null,
        buy_price: buyPrice,
        sell_price: sellPrice,
        stock: parseInt(form.stock) || 0,
        expiry_date: form.expiry_date,
        unit: form.unit,
        supplier: form.supplier || null,
        batch_number: form.batch_number || null,
        min_stock: parseInt(form.min_stock) || 5,
      };

      if (editingId) {
        const { error } = await supabase.from('medicines').update(payload).eq('id', editingId);
        if (error) throw error;
        // Audit log handled by DB trigger (trg_audit_medicines)
        toast.success("Data obat berhasil diperbarui!");
      } else {
        const { error } = await supabase.from('medicines').insert([payload]);
        if (error) throw error;
        // Audit log handled by DB trigger (trg_audit_medicines)
        toast.success("Obat baru berhasil ditambahkan!");
      }

      setShowForm(false);
      resetForm();
      fetchMedicines();
    } catch (error: unknown) {
      toast.error("Gagal menyimpan: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('medicines').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      // Audit log handled by DB trigger (trg_audit_medicines)
      toast.success(`${deleteTarget.name} berhasil dihapus`);
      setDeleteTarget(null);
      fetchMedicines();
    } catch (error: unknown) {
      toast.error("Gagal menghapus: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setDeleting(false);
    }
  };

  // Restock
  const handleRestock = async () => {
    if (!restockTarget || !restockQty) return;
    const qty = parseInt(restockQty);
    if (qty <= 0) { toast.warning("Jumlah harus lebih dari 0"); return; }

    setRestocking(true);
    try {
      // Try RPC first
      try {
        const { error: rpcError } = await supabase.rpc('increment_stock', {
          p_medicine_id: restockTarget.id,
          p_qty: qty,
          p_notes: restockNotes || null
        });
        if (rpcError) throw rpcError;
      } catch {
        // Fallback
        const { error } = await supabase.from('medicines')
          .update({ stock: restockTarget.stock + qty })
          .eq('id', restockTarget.id);
        if (error) throw error;
      }

      toast.success(`Stok ${restockTarget.name} berhasil ditambah ${qty} ${restockTarget.unit || 'pcs'}`);
      setRestockTarget(null);
      setRestockQty('');
      setRestockNotes('');
      fetchMedicines();
    } catch (error: unknown) {
      toast.error("Gagal restock: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setRestocking(false);
    }
  };

  const openStockCard = (med: Medicine) => {
    setHistoryTarget(med);
  };

  // Medicine Alternatives
  const openAlternatives = async (med: Medicine) => {
    setAltTarget(med);
    setAltList([]);
    setAltSearch('');
    setAltSearchResults([]);
    setLoadingAlts(true);
    try {
      const { data, error } = await supabase
        .from('medicine_alternatives')
        .select('id, alternative_id')
        .eq('medicine_id', med.id)
        .eq('user_id', effectiveUserId);
      if (error) throw error;
      if (!data || data.length === 0) return;
      const altIds = data.map((d: { id: string; alternative_id: string }) => d.alternative_id);
      const { data: meds } = await supabase
        .from('medicines')
        .select('*')
        .in('id', altIds);
      const medMap: Record<string, Medicine> = {};
      (meds || []).forEach((m: Medicine) => { medMap[m.id] = m; });
      setAltList(data.map((d: { id: string; alternative_id: string }) => ({ rowId: d.id, medicine: medMap[d.alternative_id] })).filter((e: { rowId: string; medicine: Medicine | undefined }) => e.medicine));
    } catch (err: unknown) {
      toast.error('Gagal memuat alternatif: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setLoadingAlts(false);
    }
  };

  useEffect(() => {
    if (!altSearch.trim() || !altTarget) { setAltSearchResults([]); return; }
    const existingIds = new Set([altTarget.id, ...altList.map(a => a.medicine.id)]);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('medicines')
        .select('*')
        .eq('user_id', effectiveUserId)
        .ilike('name', `%${altSearch}%`)
        .limit(8);
      setAltSearchResults((data || []).filter((m: Medicine) => !existingIds.has(m.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [altSearch, altTarget, altList, effectiveUserId]);

  const handleAddAlt = async (altMed: Medicine) => {
    if (!altTarget) return;
    setAddingAlt(true);
    try {
      const { error } = await supabase.from('medicine_alternatives').insert([
        { user_id: effectiveUserId, medicine_id: altTarget.id, alternative_id: altMed.id },
        { user_id: effectiveUserId, medicine_id: altMed.id, alternative_id: altTarget.id },
      ]);
      if (error && !error.message.toLowerCase().includes('duplicate') && !error.message.includes('unique')) throw error;
      toast.success(`${altMed.name} ditambahkan sebagai alternatif`);
      setAltSearch('');
      setAltSearchResults([]);
      await openAlternatives(altTarget);
    } catch (err: unknown) {
      toast.error('Gagal menambahkan alternatif: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setAddingAlt(false);
    }
  };

  const handleRemoveAlt = async (altMedId: string) => {
    if (!altTarget) return;
    try {
      await supabase.from('medicine_alternatives').delete()
        .eq('medicine_id', altTarget.id).eq('alternative_id', altMedId);
      await supabase.from('medicine_alternatives').delete()
        .eq('medicine_id', altMedId).eq('alternative_id', altTarget.id);
      setAltList(prev => prev.filter(a => a.medicine.id !== altMedId));
      toast.success('Alternatif dihapus');
    } catch (err: unknown) {
      toast.error('Gagal menghapus: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    }
  };

  // CSV Import
  const handleCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const Papa = (await import("papaparse")).default;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) { toast.info("File CSV kosong"); return; }

        const validRows: object[] = [];
        const failedRows: string[] = [];

        // Validasi semua baris terlebih dahulu
        rows.forEach((row, idx) => {
          const rowNum = idx + 2; // header = baris 1
          const name      = row.name || row.nama || row.Nama;
          const buyPrice  = parseInt(row.buy_price  || row.harga_beli  || row['Harga Beli']  || '0');
          const sellPrice = parseInt(row.sell_price || row.harga_jual  || row['Harga Jual']  || '0');

          if (!name)                      { failedRows.push(`Baris ${rowNum}: kolom nama kosong`);                       return; }
          if (!buyPrice)                  { failedRows.push(`Baris ${rowNum}: harga beli tidak valid`);                  return; }
          if (!sellPrice)                 { failedRows.push(`Baris ${rowNum}: harga jual tidak valid`);                  return; }
          if (sellPrice < buyPrice)       { failedRows.push(`Baris ${rowNum} (${name}): harga jual < harga beli`);       return; }

          validRows.push({
            user_id:      effectiveUserId,
            name,
            category:     row.category || row.kategori || 'bebas',
            barcode:      row.barcode || null,
            buy_price:    buyPrice,
            sell_price:   sellPrice,
            stock:        parseInt(row.stock || row.stok || '0'),
            expiry_date:  row.expiry_date || row.kadaluarsa || new Date().toISOString().split('T')[0],
            unit:         row.unit || row.satuan || 'tablet',
            supplier:     row.supplier || null,
            batch_number: row.batch_number || row.batch || null,
            min_stock:    parseInt(row.min_stock || '5'),
          });
        });

        // Batch insert dalam chunk 100 baris agar tidak timeout
        const CHUNK = 100;
        let imported = 0;
        try {
          for (let i = 0; i < validRows.length; i += CHUNK) {
            const chunk = validRows.slice(i, i + CHUNK);
            const { error } = await supabase.from('medicines').insert(chunk);
            if (error) throw error;
            imported += chunk.length;
          }
        } catch (err: unknown) {
          failedRows.push(`Error batch insert: ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
        }

        if (imported > 0) {
          toast.success(`Import selesai: ${imported} obat berhasil diimpor`);
        }
        if (failedRows.length > 0) {
          const preview = failedRows.slice(0, 5).join('\n') +
            (failedRows.length > 5 ? `\n...dan ${failedRows.length - 5} baris lainnya` : '');
          toast.error(`${failedRows.length} baris gagal:\n${preview}`, { duration: 10000 });
        }
        if (imported === 0 && failedRows.length === 0) {
          toast.info('Tidak ada data yang diimpor');
        }
        fetchMedicines();
      },
      error: (err) => toast.error("Gagal membaca CSV: " + err.message),
    });
    e.target.value = '';
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('name, category, barcode, buy_price, sell_price, stock, unit, supplier, batch_number, min_stock, expiry_date')
        .eq('user_id', effectiveUserId)
        .order('name');

      if (error) throw error;
      if (!data || data.length === 0) { toast.info("Tidak ada data untuk di-export"); return; }

      const pharmacyName = profile?.pharmacy_name?.toUpperCase() || '';
      const exportTime = new Date().toLocaleString('id-ID');

      // Generate Styled HTML Table for Excel
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-family: Arial, sans-serif; font-size: 10pt; }
            th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
            .title { font-size: 14pt; font-weight: bold; border: none; text-align: left; }
            .header-info { font-size: 10pt; border: none; text-align: left; }
            .money { text-align: right; }
            .bold { font-weight: bold; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="11" class="title">DATA STOK OBAT - ${pharmacyName}</td></tr>
            <tr><td colspan="11" class="header-info">WAKTU EXPORT: ${exportTime}</td></tr>
            <tr><td colspan="11" style="border:none;">&nbsp;</td></tr>
            <thead>
              <tr>
                <th>Nama Obat</th>
                <th>Kategori</th>
                <th>Barcode</th>
                <th>Harga Beli</th>
                <th>Harga Jual</th>
                <th>Stok</th>
                <th>Satuan</th>
                <th>Supplier</th>
                <th>No. Batch</th>
                <th>Min Stok</th>
                <th>Kadaluwarsa</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(med => `
                <tr>
                  <td class="bold">${med.name}</td>
                  <td class="center uppercase">${med.category || 'bebas'}</td>
                  <td style="font-family: 'Courier New', monospace;">${med.barcode || '-'}</td>
                  <td class="money">${med.buy_price}</td>
                  <td class="money bold">${med.sell_price}</td>
                  <td class="money bold" style="${med.stock < (med.min_stock || 5) ? 'color: red;' : ''}">${med.stock}</td>
                  <td class="center">${med.unit || 'tablet'}</td>
                  <td>${med.supplier || '-'}</td>
                  <td>${med.batch_number || '-'}</td>
                  <td class="center">${med.min_stock || 5}</td>
                  <td class="center">${med.expiry_date}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Use .xls extension for styled HTML export
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stok_obat_${new Date().toISOString().slice(0, 10)}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Data obat berhasil di-export ke Excel!");
    } catch (error: unknown) {
      toast.error("Gagal export: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    }
  };

  const getCategoryBadge = (cat: string) => {
    const map: Record<string, string> = {
      bebas: "bg-emerald-50 text-emerald-700",
      keras: "bg-rose-50 text-rose-700",
      resep: "bg-purple-50 text-purple-700",
      alkes: "bg-cyan-50 text-cyan-700",
      vitamin: "bg-amber-50 text-amber-700",
    };
    return map[cat] || "bg-slate-100 text-slate-600";
  };

  return (
    <div className="font-sans text-slate-800 dark:text-slate-100 antialiased min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 pb-20 md:pb-0">

      <main className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Manajemen Stok Obat</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{totalCount} obat terdaftar</p>
          </div>
          <div className="flex items-center gap-3">
            {profile?.role === 'owner' && (
              <label className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm">
                <UploadSimple weight="bold" className="w-4 h-4" /> Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
              </label>
            )}
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm">
              <DownloadSimple weight="bold" className="w-4 h-4" /> Export CSV
            </button>
            {profile?.role === 'owner' && (
              <button onClick={openAddForm}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgba(59,130,246,0.3)]">
                <Plus weight="bold" className="w-4 h-4" /> Tambah Obat
              </button>
            )}
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama obat atau barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
            className="px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm text-slate-700"
          >
            <option value="all">Semua Kategori</option>
            <option value="bebas">Bebas</option>
            <option value="keras">Keras</option>
            <option value="resep">Resep Dokter</option>
            <option value="alkes">Alat Kesehatan</option>
            <option value="vitamin">Vitamin &amp; Suplemen</option>
          </select>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(0); }}
            className="px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm text-slate-700"
          >
            <option value="name_asc">Nama A-Z</option>
            <option value="stock_asc">Stok Terendah</option>
            <option value="expiry_asc">Kadaluarsa Terdekat</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-700 uppercase">
                  <th className="px-5 py-3.5 font-semibold">Nama Obat</th>
                  <th className="px-5 py-3.5 font-semibold">Kategori</th>
                  <th className="px-5 py-3.5 font-semibold">Satuan</th>
                  <th className="px-5 py-3.5 font-semibold">Supplier</th>
                  <th className="px-5 py-3.5 font-semibold">Harga Beli</th>
                  <th className="px-5 py-3.5 font-semibold">Harga Jual</th>
                  <th className="px-5 py-3.5 font-semibold">Stok / Min</th>
                  <th className="px-5 py-3.5 font-semibold">Kedaluwarsa</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" style={{ width: j % 3 === 0 ? '70%' : j % 3 === 1 ? '50%' : '40%' }} /></td>
                      ))}
                    </tr>
                  ))
                ) : medicines.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                    <Package className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                    <p>Belum ada data obat.</p>
                  </td></tr>
                ) : (
                  medicines.map(med => {
                    const expiryStatus = getExpiryStatus(med.expiry_date);
                    const isCriticalStock = med.stock < (med.min_stock || 5);
                    return (
                      <tr key={med.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-5 py-4">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{med.name}</span>
                            {med.barcode && <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{med.barcode}</p>}
                            {med.batch_number && <p className="text-[11px] text-slate-400 dark:text-slate-500">Batch: {med.batch_number}</p>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-md uppercase ${getCategoryBadge(med.category)}`}>{med.category || 'Umum'}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300 capitalize">{med.unit || 'tablet'}</td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">{med.supplier || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatRupiah(med.buy_price)}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(med.sell_price)}</td>
                        <td className="px-5 py-4">
                          <span className={`font-semibold ${isCriticalStock ? 'text-rose-600' : 'text-slate-800'}`}>
                            {med.stock}
                          </span>
                          {isCriticalStock && <Warning weight="fill" className="inline w-3.5 h-3.5 text-rose-500 ml-1" />}
                          {med.min_stock != null && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">min: {med.min_stock}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                            expiryStatus === 'expired' ? 'bg-rose-50 text-rose-600' :
                            expiryStatus === 'near-expiry' ? 'bg-amber-50 text-amber-600' :
                            'text-slate-600'
                          }`}>
                            {new Date(med.expiry_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {expiryStatus === 'expired' && ' (EXPIRED)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setRestockTarget(med)} title="Restock"
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <ArrowsClockwise weight="bold" className="w-4 h-4" />
                            </button>
                            <button onClick={() => openStockCard(med)} title="Riwayat Stok"
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <ClockCounterClockwise weight="bold" className="w-4 h-4" />
                            </button>
                            {profile?.role === 'owner' && (
                              <>
                                <button onClick={() => setBatchTarget(med)} title="Kelola Batch/Lot"
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                  <Archive weight="bold" className="w-4 h-4" />
                                </button>
                                <button onClick={() => openAlternatives(med)} title="Obat Alternatif"
                                  className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                                  <ArrowsLeftRight weight="bold" className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEditForm(med)} title="Edit"
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                  <PencilSimple weight="bold" className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteTarget(med)} title="Hapus"
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                  <TrashSimple weight="bold" className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
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
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Halaman {page + 1} dari {totalPages} ({totalCount} obat)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"><CaretLeft weight="bold" className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"><CaretRight weight="bold" className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ADD/EDIT FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowForm(false)}
          role="dialog" aria-modal="true" aria-label={editingId ? 'Edit Obat' : 'Tambah Obat'}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{editingId ? 'Edit Obat' : 'Tambah Obat Baru'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X weight="bold" className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Nama Obat *</label>
                <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Kategori</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="bebas">Bebas</option>
                    <option value="keras">Keras</option>
                    <option value="resep">Resep</option>
                    <option value="alkes">Alkes</option>
                    <option value="vitamin">Vitamin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Satuan</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Barcode</label>
                  <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Opsional" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">No. Batch</label>
                  <input type="text" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Opsional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Harga Beli (Rp) *</label>
                  <input required type="number" min="1" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Harga Jual (Rp) *</label>
                  <input required type="number" min="1" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Stok *</label>
                  <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Min Stok</label>
                  <input type="number" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Kadaluwarsa *</label>
                  <input required type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Supplier</label>
                <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Opsional" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-600 shadow-sm disabled:opacity-50">
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Obat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog" aria-modal="true" aria-label="Konfirmasi Hapus Obat">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><TrashSimple weight="fill" className="w-7 h-7" /></div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">Hapus Obat?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{deleteTarget.name}</span> akan dihapus permanen dan tidak bisa dikembalikan.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-500 rounded-xl hover:bg-rose-600 disabled:opacity-50">
                {deleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {restockTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setRestockTarget(null)}
          role="dialog" aria-modal="true" aria-label="Restock Obat">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <ArrowsClockwise weight="fill" className="w-5 h-5 text-emerald-500" /> Restock
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{restockTarget.name}</span> — Stok saat ini: <span className="font-bold">{restockTarget.stock} {restockTarget.unit || 'pcs'}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Jumlah Tambah ({restockTarget.unit || 'pcs'})</label>
              <input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} autoFocus
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="0" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Catatan (opsional)</label>
              <input type="text" value={restockNotes} onChange={(e) => setRestockNotes(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Contoh: dari PBF Kimia Farma" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setRestockTarget(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
              <button onClick={handleRestock} disabled={restocking || !restockQty}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 disabled:opacity-50">
                {restocking ? 'Memproses...' : 'Tambah Stok'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KARTU STOK MODAL (LEDGER) */}
      {historyTarget && (
        <StockCardModal
          medicine={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* MEDICINE ALTERNATIVES MODAL */}
      {altTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog" aria-modal="true" aria-labelledby="alt-modal-title"
          onClick={() => setAltTarget(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 id="alt-modal-title" className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ArrowsLeftRight weight="fill" className="w-5 h-5 text-violet-500" />
                  Obat Alternatif
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">untuk: <span className="font-semibold text-slate-700 dark:text-slate-200">{altTarget.name}</span></p>
              </div>
              <button onClick={() => setAltTarget(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Current alternatives list */}
              {loadingAlts ? (
                <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">Memuat...</p>
              ) : altList.length === 0 ? (
                <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Belum ada obat alternatif terdaftar</p>
              ) : (
                <div className="space-y-2">
                  {altList.map(({ rowId, medicine: alt }) => (
                    <div key={rowId} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{alt.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatRupiah(alt.sell_price)} · Stok: <span className={alt.stock <= (alt.min_stock || 5) ? 'text-rose-600 font-semibold' : ''}>{alt.stock} {alt.unit}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAlt(alt.id)}
                        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Hapus alternatif"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add alternative (owner only) */}
              {profile?.role === 'owner' && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Tambah Alternatif</p>
                  <div className="relative">
                    <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={altSearch}
                      onChange={e => setAltSearch(e.target.value)}
                      placeholder="Cari nama obat..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                  {altSearchResults.length > 0 && (
                    <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      {altSearchResults.map(med => (
                        <button
                          key={med.id}
                          onClick={() => handleAddAlt(med)}
                          disabled={addingAlt}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors disabled:opacity-50"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{med.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatRupiah(med.sell_price)} · Stok: {med.stock} {med.unit}</p>
                          </div>
                          <Plus weight="bold" className="w-4 h-4 text-violet-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  {altSearch && altSearchResults.length === 0 && !loadingAlts && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">Tidak ada obat ditemukan</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">{altList.length} obat alternatif terdaftar · Hubungan bersifat dua arah</p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Management Modal */}
      {batchTarget && effectiveUserId && (
        <BatchManagementModal
          medicineId={batchTarget.id}
          medicineName={batchTarget.name}
          userId={effectiveUserId}
          onClose={() => setBatchTarget(null)}
          onBatchesUpdated={() => {
            fetchMedicines();
            setBatchTarget(null);
          }}
        />
      )}
    </div>
  );
}
