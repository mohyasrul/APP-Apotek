import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { X, Receipt, Calendar, Storefront, ListNumbers, Info, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export function InvoiceModal({ onClose, onSuccess }: Props) {
  const { effectiveUserId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<{ id: string; order_number: string; total_amount: number }[]>([]);
  
  const [form, setForm] = useState({
    supplier_id: '',
    po_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // default 30 days
    total_amount: '',
    notes: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, [effectiveUserId]);

  const fetchSuppliers = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('pharmacy_id', effectiveUserId)
      .order('name');
    setSuppliers(data || []);
  };

  const fetchPOs = async (supplierId: string) => {
    if (!effectiveUserId || !supplierId) {
      setPurchaseOrders([]);
      return;
    }
    // Fetch POs that are 'sent' or 'received' and don't have an invoice yet (simplified)
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, order_number, total_amount')
      .eq('pharmacy_id', effectiveUserId)
      .eq('supplier_id', supplierId)
      .in('status', ['sent', 'received'])
      .order('created_at', { ascending: false });
    setPurchaseOrders(data || []);
  };

  const handleSupplierChange = (id: string) => {
    setForm(prev => ({ ...prev, supplier_id: id, po_id: '' }));
    fetchPOs(id);
  };

  const handlePOChange = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    setForm(prev => ({ 
      ...prev, 
      po_id: poId,
      total_amount: po ? po.total_amount.toString() : prev.total_amount
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;
    if (!form.supplier_id || !form.invoice_number || !form.total_amount) {
      toast.error('Mohon lengkapi data wajib (*)');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('pbf_invoices').insert([{
        pharmacy_id: effectiveUserId,
        supplier_id: form.supplier_id,
        po_id: form.po_id || null,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        due_date: form.due_date,
        total_amount: parseFloat(form.total_amount),
        notes: form.notes || null,
        status: 'unpaid'
      }]);

      if (error) {
        if (error.code === '23505') throw new Error('Nomor faktur sudah terdaftar untuk suplier ini');
        throw error;
      }

      toast.success('Faktur berhasil dicatat');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan faktur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
              <Receipt weight="fill" className="text-white w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Catat Faktur PBF Baru</h3>
              <p className="text-xs text-slate-500">Record tagihan masuk dari suplier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5">
            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                <Storefront className="w-4 h-4 text-blue-500" /> Suplier (PBF) *
              </label>
              <select
                required
                value={form.supplier_id}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Pilih Suplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* PO Link (Optional) */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                <ListNumbers className="w-4 h-4 text-emerald-500" /> Hubungkan ke Surat Pesanan (Opsional)
              </label>
              <select
                disabled={!form.supplier_id}
                value={form.po_id}
                onChange={(e) => handlePOChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
              >
                <option value="">-- Tanpa Hubungan SP --</option>
                {purchaseOrders.map(po => <option key={po.id} value={po.id}>{po.order_number}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 px-1">
                <Info className="w-3 h-3" /> Hanya menampilkan SP dengan status 'Dikirim' atau 'Diterima'
              </p>
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" /> Nomor Faktur / Invoice *
              </label>
              <input
                required
                type="text"
                placeholder="Contoh: INV/2026/00123"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" /> Tgl Faktur *
                </label>
                <input
                  required
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2 text-rose-500">
                  <Clock className="w-4 h-4" /> Jatuh Tempo *
                </label>
                <input
                  required
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-rose-100 rounded-2xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                Total Nilai Faktur (Rp) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</div>
                <input
                  required
                  type="number"
                  placeholder="0"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Catatan Tambahan</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Misal: Barang datang bertahap..."
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Simpan Faktur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
