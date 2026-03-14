import { getExpiryStatus, formatRupiah } from '../../lib/types';
import type { Medicine } from '../../lib/types';
import { MagnifyingGlass, Barcode, Warning } from '@phosphor-icons/react';

type Props = {
  medicines: Medicine[];
  loading: boolean;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSearchChange: (query: string) => void;
  onAddToCart: (med: Medicine) => void;
  onStartScanner: () => void;
};

export function MedicineCatalog({
  medicines, loading, searchQuery, searchInputRef,
  onSearchChange, onAddToCart, onStartScanner,
}: Props) {
  const filteredMedicines = medicines.filter(med =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (med.barcode && med.barcode.includes(searchQuery))
  );

  return (
    <div className="w-full lg:w-2/3 p-4 flex flex-col h-full bg-slate-50">
      {/* Search bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={searchInputRef as React.RefObject<HTMLInputElement>}
              type="text"
              placeholder="Cari obat atau scan barcode... (F2)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              autoFocus
            />
          </div>
          <button onClick={onStartScanner} className="p-3 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-xl transition-colors border border-slate-200" title="Scan Barcode">
            <Barcode className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Medicine grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 animate-pulse">
                <div className="flex justify-between mb-3"><div className="h-4 w-12 bg-slate-100 rounded" /><div className="h-4 w-10 bg-slate-100 rounded" /></div>
                <div className="h-5 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-6 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="pt-3 border-t border-slate-100/80 flex justify-between"><div className="h-3 w-14 bg-slate-100 rounded" /><div className="h-3 w-14 bg-slate-100 rounded" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {filteredMedicines.map((med) => (
              <MedicineCard key={med.id} med={med} onAdd={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MedicineCard({ med, onAdd }: { med: Medicine; onAdd: (m: Medicine) => void }) {
  const outOfStock = med.stock <= 0;
  const expiryStatus = getExpiryStatus(med.expiry_date);
  const disabled = outOfStock || expiryStatus === 'expired';

  return (
    <div
      onClick={() => {
        if (disabled) {
          if (expiryStatus === 'expired') toast_expired(med.name);
          return;
        }
        onAdd(med);
      }}
      className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden
        ${disabled ? 'opacity-50 grayscale border-slate-100 cursor-not-allowed' : 'border-slate-100 hover:border-blue-300 shadow-sm hover:shadow-md'}
        ${expiryStatus === 'expired' && !outOfStock ? 'border-rose-300 bg-rose-50/30' : ''}
        ${expiryStatus === 'near-expiry' && !outOfStock ? 'border-amber-200 bg-amber-50/20' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">{med.category || 'Umum'}</span>
        {expiryStatus === 'expired' && !outOfStock && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-600 flex items-center gap-1"><Warning weight="fill" /> EXPIRED</span>
        )}
        {expiryStatus === 'near-expiry' && !outOfStock && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-600 flex items-center gap-1"><Warning weight="fill" /> FEFO</span>
        )}
      </div>
      <h3 className="font-bold text-slate-800 text-sm line-clamp-2 mb-1 min-h-[40px] leading-tight">{med.name}</h3>
      <p className="font-bold text-blue-600 text-base mb-1">{formatRupiah(med.sell_price)}</p>
      <p className="text-[10px] text-slate-400 mb-3">/ {med.unit || 'pcs'}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100/80">
        <span className={outOfStock ? 'text-rose-500 font-bold' : med.stock < (med.min_stock || 5) ? 'text-amber-500 font-semibold' : ''}>
          Stok: {med.stock}
        </span>
        <span className={expiryStatus === 'expired' ? 'text-rose-500 font-bold' : expiryStatus === 'near-expiry' ? 'text-amber-500 font-bold' : ''}>
          ED: {med.expiry_date ? new Date(med.expiry_date).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }) : '-'}
        </span>
      </div>
    </div>
  );
}

// Extracted to avoid importing toast in the component (keep it pure-ish, but pragmatic)
import { toast } from 'sonner';
function toast_expired(name: string) {
  toast.error(`${name} sudah EXPIRED, tidak bisa dijual.`);
}
