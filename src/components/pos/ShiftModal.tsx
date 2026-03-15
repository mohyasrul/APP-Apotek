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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[24px] shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockKeyOpen weight="fill" className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Buka Shift Kasir</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Anda harus membuka shift sebelum dapat memulai transaksi penjualan.</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Modal Awal Kasir (Rp) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Coins weight="fill" className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="number"
                min="0"
                value={startingCash || ''}
                onChange={(e) => setStartingCash(parseInt(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold text-lg text-gray-900 dark:text-gray-100"
                placeholder="0"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Masukkan jumlah uang tunai yang ada di laci kasir saat ini sebagai modal awal kembalian.
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <button
            onClick={handleOpenShift}
            disabled={isSubmitting || startingCash < 0}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-full shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
          >
            {isSubmitting ? 'Membuka...' : 'Buka Shift Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
}
