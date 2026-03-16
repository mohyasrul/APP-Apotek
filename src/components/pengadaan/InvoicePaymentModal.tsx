import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { X, HandCoins, Calendar, CreditCard, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRupiah, type PBFInvoice } from '../../lib/types';

type Props = {
  invoice: PBFInvoice;
  onClose: () => void;
  onSuccess: () => void;
};

export function InvoicePaymentModal({ invoice, onClose, onSuccess }: Props) {
  const { effectiveUserId } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const remaining = invoice.total_amount - invoice.amount_paid;
  
  const [form, setForm] = useState({
    amount: remaining.toString(),
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'transfer',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;
    
    const payAmount = parseFloat(form.amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      toast.error('Jumlah pembayaran tidak valid');
      return;
    }

    if (payAmount > remaining) {
      toast.error(`Jumlah pembayaran (${formatRupiah(payAmount)}) melebihi sisa hutang (${formatRupiah(remaining)}). Sesuaikan jumlah pembayaran.`);
      return;
    }

    setLoading(true);
    try {
      // 1. Insert payment record
      const { error: pError } = await supabase.from('pbf_invoice_payments').insert([{
        invoice_id: invoice.id,
        amount: payAmount,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        notes: form.notes || null,
        created_by: effectiveUserId
      }]);

      if (pError) throw pError;

      // Note: Trigger in DB will automatically update the invoice total_paid and status.
      
      toast.success('Pembayaran berhasil dicatat');
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pembayaran');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
              <HandCoins weight="fill" className="text-white w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Catat Pembayaran</h3>
              <p className="text-xs text-gray-500">Bayar hutang faktur ke suplier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Invoice Info */}
          <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 uppercase font-bold tracking-wider">Nomor Faktur</span>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 uppercase font-bold tracking-wider">Suplier</span>
              <span className="font-bold text-gray-700 dark:text-gray-200">{invoice.suppliers?.name}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Sisa Hutang:</span>
              <span className="text-lg font-black text-rose-500">{formatRupiah(remaining)}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                Jumlah Bayar (Rp) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-300">Rp</div>
                <input
                  required
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 focus:border-emerald-500 rounded-xl text-lg font-black outline-none transition-all dark:text-gray-100"
                />
              </div>
            </div>

            {/* Date & Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Tgl Bayar *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    required
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Metode *</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    required
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="transfer">Transfer</option>
                    <option value="cash">Tunai</option>
                    <option value="check">Cek/BG</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Catatan</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                placeholder="Misal: Bukti transfer terlampir..."
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs leading-relaxed">
              <Info weight="fill" className="shrink-0 w-4 h-4" />
              <p>Pembayaran akan otomatis mengurangi sisa hutang pada faktur ini dan memperbarui statusnya.</p>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Konfirmasi Bayar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
