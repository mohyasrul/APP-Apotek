import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { BookBookmark, Plus, CheckCircle, Clock, Trash, ArrowsClockwise, MagnifyingGlass, FunnelSimple, NotePencil } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Modal } from '../ui';

export type DefectaItem = {
  id: string;
  medicine_id: string;
  recorded_date: string;
  status: 'pending' | 'ordered';
  required_stock: number;
  current_stock: number;
  notes: string | null;
  medicines: { name: string; unit: string } | null;
};

type Medicine = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
};

type FilterStatus = 'all' | 'pending' | 'ordered';

export function DefectaList() {
  const { effectiveUserId } = useAuth();
  const [items, setItems] = useState<DefectaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [addForm, setAddForm] = useState({
    medicine_id: '',
    required_stock: '',
    notes: '',
    recorded_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchDefecta = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('defecta_books')
        .select(`
          id, medicine_id, recorded_date, status, required_stock, current_stock, notes,
          medicines (name, unit)
        `)
        .eq('pharmacy_id', effectiveUserId)
        .order('recorded_date', { ascending: false });

      if (error) throw error;
      setItems(data as unknown as DefectaItem[] || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal memuat Buku Defecta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicines = async () => {
    if (!effectiveUserId) return;
    setLoadingMedicines(true);
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('id, name, unit, stock, min_stock')
        .eq('user_id', effectiveUserId)
        .order('name');
      if (error) throw error;
      setMedicines((data as Medicine[]) || []);
    } finally {
      setLoadingMedicines(false);
    }
  };

  useEffect(() => {
    fetchDefecta();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const handleMarkOrdered = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('defecta_books')
        .update({ status: 'ordered', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`${name} ditandai sudah dipesan`);
      setItems(items.map(i => i.id === id ? { ...i, status: 'ordered' } : i));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal update status: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('defecta_books').delete().eq('id', id);
      if (error) throw error;
      toast.success('Entri defecta dihapus');
      setItems(items.filter(i => i.id !== id));
      setConfirmDeleteId(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal menghapus: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateFromMinStock = async () => {
    if (!effectiveUserId) return;
    setGenerating(true);
    try {
      // Fetch all medicines; filter client-side since Supabase can't compare columns
      const { data: allMeds, error: allErr } = await supabase
        .from('medicines')
        .select('id, name, unit, stock, min_stock')
        .eq('user_id', effectiveUserId);
      if (allErr) throw allErr;

      const criticalMeds = ((allMeds as Medicine[]) || []).filter(
        m => m.stock < (m.min_stock ?? 0)
      );

      if (criticalMeds.length === 0) {
        toast.info('Semua stok obat masih di atas batas minimum. Tidak ada yang perlu dicatat.');
        return;
      }

      // Get existing pending defecta medicine IDs to avoid duplicates
      const { data: existingPending } = await supabase
        .from('defecta_books')
        .select('medicine_id')
        .eq('pharmacy_id', effectiveUserId)
        .eq('status', 'pending');

      type PendingEntry = { medicine_id: string };
      const existingIds = new Set(((existingPending || []) as PendingEntry[]).map(e => e.medicine_id));
      const newMeds = criticalMeds.filter(m => !existingIds.has(m.id));

      if (newMeds.length === 0) {
        toast.info('Semua obat kritis sudah ada di daftar defecta pending.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const rows = newMeds.map(m => ({
        pharmacy_id: effectiveUserId,
        medicine_id: m.id,
        recorded_date: today,
        status: 'pending',
        current_stock: m.stock,
        required_stock: Math.max(m.min_stock - m.stock, 1),
        notes: `Auto-generate: stok ${m.stock} < minimum ${m.min_stock}`,
      }));

      const { error: insertErr } = await supabase.from('defecta_books').insert(rows);
      if (insertErr) throw insertErr;

      toast.success(`${newMeds.length} obat berhasil ditambahkan ke Buku Defecta`);
      fetchDefecta();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal generate defecta: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenAddModal = async () => {
    setAddForm({
      medicine_id: '',
      required_stock: '',
      notes: '',
      recorded_date: new Date().toISOString().split('T')[0],
    });
    setShowAddModal(true);
    await fetchMedicines();
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId || !addForm.medicine_id) return;
    setSaving(true);
    try {
      const med = medicines.find(m => m.id === addForm.medicine_id);
      const { error } = await supabase.from('defecta_books').insert({
        pharmacy_id: effectiveUserId,
        medicine_id: addForm.medicine_id,
        recorded_date: addForm.recorded_date,
        status: 'pending',
        current_stock: med?.stock ?? 0,
        required_stock: parseInt(addForm.required_stock) || 0,
        notes: addForm.notes || null,
      });
      if (error) throw error;
      toast.success('Entri defecta berhasil ditambahkan');
      setShowAddModal(false);
      fetchDefecta();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedMed = medicines.find(m => m.id === addForm.medicine_id);

  const filteredItems = items.filter(item => {
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchSearch = searchQuery === '' ||
      (item.medicines?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookBookmark weight="fill" className="w-5 h-5 text-indigo-600" />
            Buku Defecta
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Catatan stok obat yang perlu dipesan kembali</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGenerateFromMinStock}
            disabled={generating}
            className="flex items-center gap-2 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {generating
              ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              : <ArrowsClockwise weight="bold" className="w-4 h-4 text-indigo-600" />
            }
            Generate Otomatis
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus weight="bold" className="w-4 h-4" /> Tambah Manual
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama obat..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
          <FunnelSimple className="w-3.5 h-3.5 text-gray-400 ml-1.5 mr-0.5 flex-shrink-0" />
          {(['all', 'pending', 'ordered'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterStatus === s
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {s === 'all' ? 'Semua' : s === 'pending' ? 'Pending' : 'Sudah Dipesan'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-gray-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          Memuat data...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center border border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">
          <BookBookmark className="w-12 h-12 text-gray-200 dark:text-zinc-700 mb-3" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">
            {items.length === 0 ? 'Buku Defecta Kosong' : 'Tidak ada hasil'}
          </p>
          <p className="text-sm mt-1">
            {items.length === 0
              ? 'Klik "Generate Otomatis" untuk mengisi dari stok minimum, atau "Tambah Manual".'
              : 'Coba ubah filter atau kata pencarian.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-zinc-800/80 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5">Nama Obat</th>
                  <th className="px-5 py-3.5 text-center">Stok Sisa</th>
                  <th className="px-5 py-3.5 text-center">Rencana Pesan</th>
                  <th className="px-5 py-3.5">Keterangan</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-700/50">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {new Date(item.recorded_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-gray-200">
                      {item.medicines?.name || <span className="text-gray-400 italic">Obat Dihapus</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{item.current_stock}</span>
                      <span className="text-xs text-gray-400 ml-1">{item.medicines?.unit}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{item.required_stock}</span>
                      <span className="text-xs text-gray-400 ml-1">{item.medicines?.unit}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <span className="text-xs text-gray-400 truncate block">{item.notes || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md text-xs font-semibold">
                          <Clock weight="fill" className="w-3 h-3" /> Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md text-xs font-semibold">
                          <CheckCircle weight="fill" className="w-3 h-3" /> Dipesan
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.status === 'pending' && (
                          <button
                            onClick={() => handleMarkOrdered(item.id, item.medicines?.name || 'Obat')}
                            className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            title="Tandai sudah dipesan"
                          >
                            <CheckCircle weight="bold" className="w-3.5 h-3.5" />
                            Dipesan
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="Hapus entri"
                        >
                          <Trash weight="bold" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-700 text-xs text-gray-400">
            Menampilkan {filteredItems.length} dari {items.length} entri
          </div>
        </div>
      )}

      {/* Modal: Tambah Manual */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={<span className="flex items-center gap-2"><NotePencil weight="fill" className="w-5 h-5 text-indigo-600" /> Tambah Entri Defecta</span>}
        description="Catat obat yang stoknya perlu dipesan kembali."
        size="md"
      >
        <form onSubmit={handleAddManual} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Tanggal Dicatat</label>
            <input
              type="date"
              required
              value={addForm.recorded_date}
              onChange={e => setAddForm(f => ({ ...f, recorded_date: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Nama Obat</label>
            {loadingMedicines ? (
              <div className="text-sm text-gray-400 py-2">Memuat daftar obat...</div>
            ) : (
              <select
                required
                value={addForm.medicine_id}
                onChange={e => setAddForm(f => ({ ...f, medicine_id: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              >
                <option value="">-- Pilih obat --</option>
                {medicines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} (stok: {m.stock} {m.unit})
                  </option>
                ))}
              </select>
            )}
            {selectedMed && (
              <p className="text-xs text-gray-400 mt-1.5">
                Stok saat ini: <span className={`font-semibold ${selectedMed.stock < (selectedMed.min_stock ?? 0) ? 'text-rose-500' : 'text-emerald-600'}`}>{selectedMed.stock} {selectedMed.unit}</span>
                {selectedMed.min_stock > 0 && ` · Minimum: ${selectedMed.min_stock} ${selectedMed.unit}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Jumlah Rencana Pemesanan</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                min="1"
                value={addForm.required_stock}
                onChange={e => setAddForm(f => ({ ...f, required_stock: e.target.value }))}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                placeholder="misal: 100"
              />
              {selectedMed && <span className="text-sm text-gray-400 flex-shrink-0">{selectedMed.unit}</span>}
            </div>
            {selectedMed && selectedMed.min_stock > 0 && (() => {
              const shortfall = Math.max(selectedMed.min_stock - selectedMed.stock, 1);
              return (
                <button
                  type="button"
                  onClick={() => setAddForm(f => ({ ...f, required_stock: String(shortfall) }))}
                  className="text-xs text-indigo-600 font-semibold mt-1.5 hover:underline"
                >
                  Isi otomatis dari selisih stok minimum ({shortfall} {selectedMed.unit})
                </button>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Keterangan <span className="font-normal text-gray-400">(opsional)</span></label>
            <textarea
              value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
              placeholder="Catatan tambahan..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Konfirmasi Hapus */}
      <Modal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        size="sm"
      >
        <div className="text-center py-2">
          <Trash weight="fill" className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Hapus Entri?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Entri ini akan dihapus dari Buku Defecta. Tindakan ini tidak bisa dibatalkan.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={deletingId !== null}
              className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {deletingId ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
