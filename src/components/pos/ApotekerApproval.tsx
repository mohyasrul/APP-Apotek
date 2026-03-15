import { useState } from 'react';
import { Warning, ShieldCheck, X, Pill } from '@phosphor-icons/react';
import type { CartItem } from '../../lib/store';
import { RESTRICTED_CATEGORIES } from '../../lib/constants';

type ApotekerApprovalProps = {
  restrictedItems: CartItem[];
  onApprove: () => void;
  onCancel: () => void;
  apotekerName?: string;
};

/**
 * Modal for apoteker approval of restricted medicines (narkotika, psikotropika).
 * Required by PMK 73/2016 for dispensing of controlled substances.
 */
export function ApotekerApprovalModal({ restrictedItems, onApprove, onCancel, apotekerName }: ApotekerApprovalProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleApprove = () => {
    if (!confirmed) return;
    onApprove();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ShieldCheck weight="fill" className="w-5 h-5" />
            </div>
            <div>
              <h2 id="approval-title" className="font-bold">Persetujuan Apoteker</h2>
              <p className="text-sm text-rose-100">Diperlukan untuk obat kategori khusus</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 dark:bg-slate-900">
          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Warning weight="fill" className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Obat Kategori Terbatas</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Transaksi ini mengandung obat yang termasuk kategori narkotika/psikotropika.
                  Sesuai PMK 73/2016, diperlukan persetujuan Apoteker Penanggung Jawab.
                </p>
              </div>
            </div>
          </div>

          {/* List of restricted items */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Obat yang memerlukan persetujuan:
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
              {restrictedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                    <Pill weight="fill" className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Qty: {item.quantity} {item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apoteker info */}
          {apotekerName && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Apoteker Penanggung Jawab:
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{apotekerName}</p>
            </div>
          )}

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-6">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-rose-500 mt-0.5 dark:bg-slate-800"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Saya <span className="font-semibold">{apotekerName || 'Apoteker'}</span> menyetujui dispensing
              obat-obatan di atas sesuai dengan resep dokter yang telah divalidasi.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleApprove}
            disabled={!confirmed}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-rose-500 rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <ShieldCheck weight="bold" className="w-4 h-4" />
            Setujui Dispensing
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if cart contains restricted medicines
 */
// eslint-disable-next-line react-refresh/only-export-components
export function hasRestrictedMedicines(cart: CartItem[], medicineCategories: Record<string, string>): CartItem[] {
  return cart.filter(item => {
    const category = medicineCategories[item.id];
    return category && RESTRICTED_CATEGORIES.includes(category as typeof RESTRICTED_CATEGORIES[number]);
  });
}
