import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  ClipboardText, Plus, Check, X, Warning, MagnifyingGlass,
  CaretLeft, CaretRight, Eye, CheckCircle, Clock, Trash
} from '@phosphor-icons/react';
import type { StockOpname as StockOpnameType, StockOpnameItem, Medicine } from '../lib/types';

const PAGE_SIZE = 20;

type OpnameWithItems = StockOpnameType & {
  items_count?: number;
  difference_count?: number;
};

export default function StockOpname() {
  const { profile, effectiveUserId } = useAuth();
  const { checkFeature } = useSubscription();

  const [opnames, setOpnames] = useState<OpnameWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Detail modal
  const [selectedOpname, setSelectedOpname] = useState<StockOpnameType | null>(null);
  const [opnameItems, setOpnameItems] = useState<StockOpnameItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Edit mode
  const [editingItems, setEditingItems] = useState<Record<string, number>>({});
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const hasFeature = checkFeature('stock_opname');

  const fetchOpnames = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { count } = await supabase
        .from('stock_opnames')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      setTotalCount(count || 0);

      const { data, error } = await supabase
        .from('stock_opnames')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setOpnames((data as OpnameWithItems[]) || []);
    } catch (err: unknown) {
      toast.error('Gagal memuat data: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, page]);

  useEffect(() => {
    fetchOpnames();
  }, [fetchOpnames]);

  const handleCreate = async () => {
    if (!effectiveUserId || !profile) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('stock_opnames')
        .insert({
          user_id: effectiveUserId,
          status: 'draft',
          notes: createNotes.trim() || null,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Stock opname berhasil dibuat');
      setShowCreateModal(false);
      setCreateNotes('');
      fetchOpnames();
      // Open the newly created opname
      setSelectedOpname(data as StockOpnameType);
      loadOpnameItems(data.id);
      loadMedicines();
    } catch (err: unknown) {
      toast.error('Gagal membuat stock opname: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setCreating(false);
    }
  };

  const loadOpnameItems = async (opnameId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('stock_opname_items')
        .select('*, medicines(name, unit)')
        .eq('opname_id', opnameId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const items = (data || []).map(item => ({
        ...item,
        medicines: item.medicines as unknown as { name: string; unit: string } | undefined,
      })) as StockOpnameItem[];

      setOpnameItems(items);

      // Pre-fill editing state
      const edits: Record<string, number> = {};
      items.forEach(item => {
        edits[item.medicine_id] = item.physical_stock;
      });
      setEditingItems(edits);
    } catch (err: unknown) {
      toast.error('Gagal memuat item: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadMedicines = async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('id, name, stock, unit')
        .eq('user_id', effectiveUserId)
        .order('name');

      if (error) throw error;
      setMedicines((data as Medicine[]) || []);
    } catch {
      // Silent fail
    }
  };

  const handleAddMedicine = async (med: Medicine) => {
    if (!selectedOpname) return;

    // Check if already added
    if (opnameItems.some(item => item.medicine_id === med.id)) {
      toast.info('Obat sudah ada dalam daftar');
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_opname_items')
        .insert({
          opname_id: selectedOpname.id,
          medicine_id: med.id,
          system_stock: med.stock,
          physical_stock: med.stock, // Default sama dengan sistem
        });

      if (error) throw error;

      // Refresh items
      loadOpnameItems(selectedOpname.id);
      setSearchQuery('');
    } catch (err: unknown) {
      toast.error('Gagal menambah obat: ' + (err instanceof Error ? err.message : 'Error'));
    }
  };

  const handleUpdatePhysicalStock = (medicineId: string, value: number) => {
    setEditingItems(prev => ({
      ...prev,
      [medicineId]: Math.max(0, value),
    }));
  };

  const handleSaveItems = async () => {
    if (!selectedOpname) return;
    setSaving(true);
    try {
      // Update each item
      for (const item of opnameItems) {
        const newPhysical = editingItems[item.medicine_id];
        if (newPhysical !== undefined && newPhysical !== item.physical_stock) {
          await supabase
            .from('stock_opname_items')
            .update({ physical_stock: newPhysical })
            .eq('id', item.id);
        }
      }

      // Update status to in_progress if still draft
      if (selectedOpname.status === 'draft') {
        await supabase
          .from('stock_opnames')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', selectedOpname.id);
      }

      toast.success('Perubahan disimpan');
      loadOpnameItems(selectedOpname.id);
      fetchOpnames();
    } catch (err: unknown) {
      toast.error('Gagal menyimpan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedOpname || profile?.role !== 'owner') return;
    setApproving(true);
    try {
      const { error } = await supabase.rpc('approve_stock_opname', {
        p_opname_id: selectedOpname.id,
      });

      if (error) throw error;

      toast.success('Stock opname disetujui. Stok telah disesuaikan.');
      setSelectedOpname(null);
      fetchOpnames();
    } catch (err: unknown) {
      toast.error('Gagal menyetujui: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async (opnameId: string) => {
    if (!confirm('Hapus stock opname ini?')) return;
    try {
      const { error } = await supabase
        .from('stock_opnames')
        .delete()
        .eq('id', opnameId);

      if (error) throw error;
      toast.success('Stock opname dihapus');
      fetchOpnames();
    } catch (err: unknown) {
      toast.error('Gagal menghapus: ' + (err instanceof Error ? err.message : 'Error'));
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: <Clock className="w-3 h-3" /> },
      in_progress: { label: 'Sedang Berjalan', color: 'bg-blue-100 text-blue-600', icon: <ClipboardText className="w-3 h-3" /> },
      completed: { label: 'Selesai', color: 'bg-amber-100 text-amber-600', icon: <Check className="w-3 h-3" /> },
      approved: { label: 'Disetujui', color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle className="w-3 h-3" /> },
    };
    const c = config[status] || config.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${c.color}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const filteredMedicines = medicines.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !opnameItems.some(item => item.medicine_id === m.id)
  );

  if (!hasFeature) {
    return (
      <div className="font-sans text-slate-800 antialiased min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-0">
        <main className="flex-1 p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <Warning weight="fill" className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Fitur Stock Opname</h2>
            <p className="text-slate-500 mb-6">
              Upgrade ke paket Professional atau Enterprise untuk menggunakan fitur Stock Opname.
            </p>
            <a href="/billing" className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              Lihat Paket Langganan
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-800 antialiased min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-0">
      <main className="flex-1 p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Stock Opname</h1>
            <p className="text-sm text-slate-500">Hitung fisik stok untuk memastikan akurasi inventaris.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus weight="bold" className="w-4 h-4" />
            Buat Stock Opname Baru
          </button>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold">TANGGAL</th>
                  <th className="px-6 py-4 font-semibold">STATUS</th>
                  <th className="px-6 py-4 font-semibold">CATATAN</th>
                  <th className="px-6 py-4 font-semibold text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-32" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                    </tr>
                  ))
                ) : opnames.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <ClipboardText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                      <p>Belum ada stock opname.</p>
                      <p className="text-xs mt-1">Klik tombol "Buat Stock Opname Baru" untuk memulai.</p>
                    </td>
                  </tr>
                ) : (
                  opnames.map(opname => (
                    <tr key={opname.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(opname.opname_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(opname.status)}</td>
                      <td className="px-6 py-4 text-slate-500 truncate max-w-xs">{opname.notes || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedOpname(opname);
                              loadOpnameItems(opname.id);
                              loadMedicines();
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Lihat Detail"
                          >
                            <Eye weight="bold" className="w-4 h-4" />
                          </button>
                          {opname.status === 'draft' && (
                            <button
                              onClick={() => handleDelete(opname.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash weight="bold" className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
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
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  <CaretLeft weight="bold" className="w-4 h-4 text-slate-600" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  <CaretRight weight="bold" className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Buat Stock Opname Baru</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan (opsional)</label>
              <textarea
                value={createNotes}
                onChange={e => setCreateNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                placeholder="Contoh: Stock opname bulanan Maret 2026"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus weight="bold" className="w-4 h-4" />}
                Buat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOpname && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Detail Stock Opname</h2>
                <p className="text-sm text-slate-500">
                  {new Date(selectedOpname.opname_date).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedOpname.status)}
                <button onClick={() => setSelectedOpname(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Add medicine search */}
              {selectedOpname.status !== 'approved' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tambah Obat</label>
                  <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Cari obat untuk ditambahkan..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  {searchQuery && filteredMedicines.length > 0 && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredMedicines.slice(0, 10).map(med => (
                        <button
                          key={med.id}
                          onClick={() => handleAddMedicine(med)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between text-sm border-b border-slate-50 last:border-0"
                        >
                          <span className="font-medium text-slate-700">{med.name}</span>
                          <span className="text-slate-400">Stok: {med.stock} {med.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Items table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                      <th className="px-4 py-3 font-semibold">NAMA OBAT</th>
                      <th className="px-4 py-3 font-semibold text-center">STOK SISTEM</th>
                      <th className="px-4 py-3 font-semibold text-center">STOK FISIK</th>
                      <th className="px-4 py-3 font-semibold text-center">SELISIH</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loadingItems ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Memuat...</td></tr>
                    ) : opnameItems.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Belum ada obat. Gunakan pencarian di atas untuk menambah obat.
                      </td></tr>
                    ) : (
                      opnameItems.map(item => {
                        const physical = editingItems[item.medicine_id] ?? item.physical_stock;
                        const diff = physical - item.system_stock;
                        return (
                          <tr key={item.id} className="border-b border-slate-50">
                            <td className="px-4 py-3">
                              <span className="font-medium text-slate-700">{item.medicines?.name || 'Unknown'}</span>
                              <span className="text-slate-400 text-xs ml-2">{item.medicines?.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">{item.system_stock}</td>
                            <td className="px-4 py-3 text-center">
                              {selectedOpname.status === 'approved' ? (
                                <span className="text-slate-600">{item.physical_stock}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={physical}
                                  onChange={e => handleUpdatePhysicalStock(item.medicine_id, parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              {opnameItems.length > 0 && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Total Item</p>
                      <p className="text-lg font-bold text-slate-800">{opnameItems.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Item Selisih</p>
                      <p className="text-lg font-bold text-amber-600">
                        {opnameItems.filter(i => (editingItems[i.medicine_id] ?? i.physical_stock) !== i.system_stock).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Total Selisih</p>
                      <p className="text-lg font-bold text-slate-800">
                        {opnameItems.reduce((sum, i) => sum + ((editingItems[i.medicine_id] ?? i.physical_stock) - i.system_stock), 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {selectedOpname.status !== 'approved' && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                {opnameItems.length > 0 && (
                  <button
                    onClick={handleSaveItems}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {saving && <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                    Simpan Progress
                  </button>
                )}
                {profile?.role === 'owner' && opnameItems.length > 0 && (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {approving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle weight="bold" className="w-4 h-4" />}
                    Setujui & Terapkan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
