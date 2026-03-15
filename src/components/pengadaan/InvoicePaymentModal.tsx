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
      toast.warning(`Jumlah pembayaran (${formatRupiah(payAmount)}) melebih sisa hutang (${formatRupiah(remaining)})`);
      // Keep going, maybe they are overpaying or something? Actually usually better to cap it or ask confirm.
      if (!confirm('Jumlah bayar melebihi sisa hutang. Lanjutkan?')) return;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
              <HandCoins weight="fill" className="text-white w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Catat Pembayaran</h3>
              <p className="text-xs text-slate-500">Bayar hutang faktur ke suplier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Invoice Info */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 uppercase font-bold tracking-wider">Nomor Faktur</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 uppercase font-bold tracking-wider">Suplier</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{invoice.suppliers?.name}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Sisa Hutang:</span>
              <span className="text-lg font-black text-rose-500">{formatRupiah(remaining)}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                Jumlah Bayar (Rp) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">Rp</div>
                <input
                  required
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-2xl text-lg font-black outline-none transition-all dark:text-slate-100"
                />
              </div>
            </div>

            {/* Date & Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Tgl Bayar *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Metode *</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    required
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
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
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Catatan</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                placeholder="Misal: Bukti transfer terlampir..."
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 text-xs leading-relaxed">
              <Info weight="fill" className="shrink-0 w-4 h-4" />
              <p>Pembayaran akan otomatis mengurangi sisa hutang pada faktur ini dan memperbarui statusnya.</p>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
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
