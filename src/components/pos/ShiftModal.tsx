import { useState } from 'react';
import { Coins, LockKeyOpen } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type Props = {
  effectiveUserId: string;
  onShiftOpened: (shiftId: string) => void;
};

export function ShiftModal({ effectiveUserId, onShiftOpened }: Props) {
  const [startingCash, setStartingCash] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenShift = async () => {
    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('cashier_shifts')
        .insert({
          pharmacy_id: effectiveUserId,
          cashier_id: userData.user.id,
          starting_cash: startingCash,
          status: 'open'
        })
        .select('id')
        .single();

      if (error) throw error;
      toast.success('Shift kasir berhasil dibuka!');
      onShiftOpened(data.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuka shift kasir');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockKeyOpen weight="fill" className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Buka Shift Kasir</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Anda harus membuka shift sebelum dapat memulai transaksi penjualan.</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Modal Awal Kasir (Rp) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Coins weight="fill" className="text-slate-400 w-5 h-5" />
              </div>
              <input
                type="number"
                min="0"
                value={startingCash || ''}
                onChange={(e) => setStartingCash(parseInt(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-lg text-slate-800 dark:text-slate-100"
                placeholder="0"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Masukkan jumlah uang tunai yang ada di laci kasir saat ini sebagai modal awal kembalian.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={handleOpenShift}
            disabled={isSubmitting || startingCash < 0}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-full shadow-lg shadow-blue-500/30 transition-all active:scale-95"
          >
            {isSubmitting ? 'Membuka...' : 'Buka Shift Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
}
