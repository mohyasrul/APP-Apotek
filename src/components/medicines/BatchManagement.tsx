import { useState, useEffect } from 'react';
import { X, Plus, Package, Calendar, CurrencyDollarSimple, Truck } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { MedicineBatch } from '../../lib/types';

type BatchManagementProps = {
  medicineId: string;
  medicineName: string;
  userId: string;
  onClose: () => void;
  onBatchesUpdated: () => void;
};

export function BatchManagementModal({ medicineId, medicineName, userId, onClose, onBatchesUpdated }: BatchManagementProps) {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState({
    batch_number: '',
    quantity: 0,
    buy_price: 0,
    expiry_date: '',
    supplier: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('medicine_batches')
        .select('*')
        .eq('medicine_id', medicineId)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      setBatches((data as MedicineBatch[]) || []);
    } catch (err: unknown) {
      toast.error('Gagal memuat batch: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicineId]);

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batch_number || !form.expiry_date || form.quantity <= 0) {
      toast.warning('Batch number, tanggal kadaluarsa, dan quantity wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('medicine_batches')
        .insert({
          medicine_id: medicineId,
          user_id: userId,
          batch_number: form.batch_number,
          quantity: form.quantity,
          buy_price: form.buy_price,
          expiry_date: form.expiry_date,
          supplier: form.supplier || null,
          notes: form.notes || null,
        });

      if (error) throw error;

      // Update main medicine stock
      const totalQty = batches.reduce((sum, b) => sum + b.quantity, 0) + form.quantity;
      await supabase
        .from('medicines')
        .update({ stock: totalQty, updated_at: new Date().toISOString() })
        .eq('id', medicineId);

      toast.success('Batch berhasil ditambahkan');
      setForm({
        batch_number: '',
        quantity: 0,
        buy_price: 0,
        expiry_date: '',
        supplier: '',
        notes: '',
      });
      setShowAddForm(false);
      fetchBatches();
      onBatchesUpdated();
    } catch (err: unknown) {
      toast.error('Gagal menambah batch: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
  const expiringSoon = batches.filter(b => {
    const daysUntilExpiry = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  }).length;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Manajemen Batch/Lot</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{medicineName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Batch</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{batches.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Stok</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{totalStock}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Akan Kadaluarsa</p>
              <p className={`text-xl font-bold ${expiringSoon > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {expiringSoon}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Form */}
          {showAddForm ? (
            <form onSubmit={handleAddBatch} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-4">Tambah Batch Baru</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Batch Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.batch_number}
                    onChange={e => setForm({ ...form, batch_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-200"
                    placeholder="LOT2024001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Jumlah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.quantity || ''}
                    onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Tanggal Kadaluarsa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expiry_date}
                    onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Harga Beli</label>
                  <input
                    type="number"
                    min="0"
                    value={form.buy_price || ''}
                    onChange={e => setForm({ ...form, buy_price: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={form.supplier}
                    onChange={e => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-200"
                    placeholder="PT. Supplier"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus weight="bold" className="w-4 h-4" />}
                  Simpan Batch
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 mb-6 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Plus weight="bold" className="w-4 h-4" />
              Tambah Batch Baru
            </button>
          )}

          {/* Batch List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">Memuat batch...</div>
          ) : batches.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">Belum ada batch.</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs">Klik tombol di atas untuk menambah batch baru.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map(batch => {
                const daysUntilExpiry = Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const isExpired = daysUntilExpiry <= 0;
                const isExpiringSoon = daysUntilExpiry <= 90 && daysUntilExpiry > 0;

                return (
                  <div
                    key={batch.id}
                    className={`border rounded-xl p-4 ${
                      isExpired ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
                      isExpiringSoon ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                      'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{batch.batch_number}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {batch.quantity} unit
                          </span>
                          {batch.supplier && (
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {batch.supplier}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        isExpired ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' :
                        isExpiringSoon ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {isExpired ? 'EXPIRED' : isExpiringSoon ? `${daysUntilExpiry} hari lagi` : 'Normal'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Calendar className="w-3 h-3" />
                        <span>Exp: {new Date(batch.expiry_date).toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <CurrencyDollarSimple className="w-3 h-3" />
                        <span>Rp {batch.buy_price.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    {batch.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">{batch.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
