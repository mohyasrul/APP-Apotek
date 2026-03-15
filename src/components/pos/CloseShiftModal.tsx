import { useState, useEffect } from 'react';
import { Coins, LockKey, X, Calculator } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { formatRupiah } from '../../lib/types';

type Props = {
  shiftId: string;
  onClosed: () => void;
  onClose: () => void;
};

export function CloseShiftModal({ shiftId, onClose, onClosed }: Props) {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [startingCash, setStartingCash] = useState(0);
  const [cashSales, setCashSales] = useState(0);
  const [qrisSales, setQrisSales] = useState(0);
  const [transferSales, setTransferSales] = useState(0);
  
  const [actualCash, setActualCash] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchShiftData = async () => {
      try {
        // Fetch shift details
        const { data: shift, error: errShift } = await supabase
          .from('cashier_shifts')
          .select('starting_cash')
          .eq('id', shiftId)
          .single();
        if (errShift) throw errShift;

        // Fetch transactions for this shift
        const { data: trx, error: errTrx } = await supabase
          .from('transactions')
          .select('total_amount, payment_method')
          .eq('shift_id', shiftId);
        if (errTrx) throw errTrx;

        let cSales = 0, qSales = 0, tSales = 0;
        trx?.forEach(t => {
          if (t.payment_method === 'cash') cSales += Number(t.total_amount);
          else if (t.payment_method === 'qris') qSales += Number(t.total_amount);
          else if (t.payment_method === 'transfer') tSales += Number(t.total_amount);
        });

        setStartingCash(Number(shift.starting_cash));
        setCashSales(cSales);
        setQrisSales(qSales);
        setTransferSales(tSales);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        toast.error('Gagal memuat data shift: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchShiftData();
  }, [shiftId]);

  const expectedCash = startingCash + cashSales;
  const actualValue = typeof actualCash === 'number' ? actualCash : 0;
  const difference = actualValue - expectedCash;

  const handleCloseShift = async () => {
    if (typeof actualCash !== 'number') return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('cashier_shifts')
        .update({
          status: 'closed',
          end_time: new Date().toISOString(),
          expected_ending_cash: expectedCash,
          actual_ending_cash: actualCash,
          notes: notes
        })
        .eq('id', shiftId);

      if (error) throw error;
      toast.success('Shift kasir berhasil ditutup!');
      onClosed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal menutup shift: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[24px] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
              <LockKey weight="fill" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tutup Shift Kasir</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Rekonsiliasi pencatatan kas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-500">Merekap transaksi shift...</p>
            </div>
          ) : (
            <>
              {/* Ringkasan Sistem */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                  <Calculator weight="fill" className="text-slate-400" /> Ringkasan Sistem
                </h3>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Modal Awal</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatRupiah(startingCash)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Penjualan Tunai</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">+{formatRupiah(cashSales)}</span>
                </div>
                
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Total Uang Fisik Seharusnya</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{formatRupiah(expectedCash)}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 border-dashed dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Pendapatan Non-Tunai</p>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-500">QRIS</span>
                    <span className="font-medium">{formatRupiah(qrisSales)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Transfer</span>
                    <span className="font-medium">{formatRupiah(transferSales)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-2 font-bold text-slate-600">
                    <span>Total Pendapatan (Semua)</span>
                    <span>{formatRupiah(cashSales + qrisSales + transferSales)}</span>
                  </div>
                </div>
              </div>

              {/* Form Input Kasir */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Hitungan Uang Fisik Kasir (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Coins weight="fill" className="text-slate-400 w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value === '' ? '' : parseInt(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-bold text-lg text-slate-800 dark:text-slate-100"
                      placeholder="Masukkan total uang fisik di laci"
                      autoFocus
                    />
                  </div>
                </div>

                {typeof actualCash === 'number' && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${difference === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                    <span className="text-sm font-semibold">Selisih:</span>
                    <span className="font-bold text-lg">
                      {difference > 0 ? '+' : ''}{formatRupiah(difference)}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Catatan Kasir (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm placeholder-slate-400 resize-none"
                    placeholder={difference !== 0 ? "Jelaskan alasan selisih kas..." : "Tulis catatan shift di sini..."}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleCloseShift}
            disabled={isSubmitting || typeof actualCash !== 'number' || actualCash < 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-full shadow-lg shadow-amber-500/30 transition-all active:scale-95"
          >
            {isSubmitting ? 'Menyimpan...' : 'Tutup Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
