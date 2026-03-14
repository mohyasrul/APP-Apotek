import { formatRupiah, getExpiryStatus } from '../../lib/types';
import type { CartItem } from '../../lib/store';
import {
  ShoppingCart, Trash, Plus, Minus, Keyboard, Warning, Percent, Tag, LockKey
} from '@phosphor-icons/react';

type Props = {
  cart: CartItem[];
  globalDiscount: number;
  totalAmount: number;
  subtotal: number;
  onRemove: (item: CartItem) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateItemDiscount: (id: string, discount: number) => void;
  onUpdateItemSigna: (id: string, signa: string) => void;
  onSetGlobalDiscount: (discount: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onCloseShift?: () => void;
  isMobileSheet?: boolean;
  onClose?: () => void;
  allocations?: Record<string, any[]>;
};

export function CartPanel({
  cart, globalDiscount, totalAmount, subtotal,
  onRemove, onUpdateQuantity, onUpdateItemDiscount, onUpdateItemSigna,
  onSetGlobalDiscount, onClearCart, onCheckout, onCloseShift,
  isMobileSheet, onClose, allocations = {},
}: Props) {
  const itemDiscountTotal = cart.reduce((s, i) => s + i.discount, 0);

  const panelContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-500" />
          <h2 className="font-bold text-slate-800">Keranjang</h2>
          <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {onCloseShift && (
            <button onClick={onCloseShift} className="text-xs font-semibold text-amber-600 hover:text-amber-700 px-2 py-1 flex items-center gap-1 rounded-md hover:bg-amber-50 transition-colors">
              <LockKey weight="fill" /> Tutup Shift
            </button>
          )}
          {cart.length > 0 && (
            <button onClick={onClearCart} className="text-xs font-semibold text-rose-500 hover:text-rose-600 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors">Kosongkan</button>
          )}
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
            <ShoppingCart className="w-12 h-12 text-slate-200 mb-2" />
            <p className="text-sm font-medium">Keranjang masih kosong</p>
            <p className="text-xs text-center max-w-[200px]">Cari obat atau scan barcode untuk menambahkan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => {
              const expiryStatus = getExpiryStatus(item.expiry_date);
              const isFEFO = expiryStatus === 'near-expiry' || expiryStatus === 'expired';
              return (
                <div key={item.id} className={`p-3 rounded-xl border ${isFEFO ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 bg-slate-50/50'} flex flex-col gap-2`}>
                  <div className="flex justify-between items-start">
                    <div className="pr-3">
                      <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-1">{item.name}</h4>
                      <p className="text-blue-600 font-bold text-sm">{formatRupiah(item.price)} <span className="text-slate-400 font-normal text-xs">/ {item.unit}</span></p>
                    </div>
                    <button onClick={() => onRemove(item)} className="text-slate-400 hover:text-rose-500 transition-colors p-1"><Trash className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    {isFEFO ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                        <Warning weight="fill" /> {expiryStatus === 'expired' ? 'EXPIRED!' : 'PRIORITASKAN!'}
                      </div>
                    ) : <div />}
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1">
                      <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md"><Minus className="w-3 h-3" /></button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>

                  {/* FEFO Batch Allocations */}
                  {allocations[item.id] && allocations[item.id].length > 0 && (
                    <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/50 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Tag weight="fill" className="w-2.5 h-2.5 text-indigo-400" /> Alokasi FEFO:
                      </p>
                      {allocations[item.id].map((alloc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-1 rounded-md border border-indigo-100/50 dark:border-indigo-800/20">
                          <span className="font-semibold">{alloc.batch_number}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-600 dark:text-indigo-400 font-black">{alloc.qty} {item.unit}</span>
                            <span className="text-[9px] text-slate-400">ED: {new Date(alloc.expiry_date).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Per-item discount input */}
                  <div className="flex items-center gap-2 mt-1">
                    <Tag weight="bold" className="w-3 h-3 text-slate-400 shrink-0" />
                    <input
                      type="number"
                      min="0"
                      max={item.price * item.quantity}
                      value={item.discount || ''}
                      onChange={(e) => onUpdateItemDiscount(item.id, parseInt(e.target.value) || 0)}
                      className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500/20 font-medium shrink-0"
                      placeholder="Diskon (Rp)"
                    />
                    {item.discount > 0 && (
                      <span className="text-[10px] text-blue-500 font-semibold whitespace-nowrap">
                        -{formatRupiah(item.discount)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={item.signa || ''}
                      onChange={(e) => onUpdateItemSigna(item.id, e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                      placeholder="Aturan Pakai (opsional)"
                    />
                  </div>
                </div>
              );
            })}

            {/* Global Discount */}
            <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/30">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-2">
                <Percent weight="bold" className="w-3 h-3" /> Diskon Total (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={globalDiscount || ''}
                onChange={(e) => onSetGlobalDiscount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right font-semibold"
                placeholder="0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Checkout Footer */}
      <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
        {(globalDiscount > 0 || itemDiscountTotal > 0) && (
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-slate-400">Subtotal</span>
            <span className="text-slate-500">{formatRupiah(subtotal + itemDiscountTotal)}</span>
          </div>
        )}
        {itemDiscountTotal > 0 && (
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-amber-500">Diskon Item</span>
            <span className="text-amber-500">-{formatRupiah(itemDiscountTotal)}</span>
          </div>
        )}
        {globalDiscount > 0 && (
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-blue-500">Diskon Total</span>
            <span className="text-blue-500">-{formatRupiah(globalDiscount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <span className="text-slate-500 font-medium">Total</span>
          <span className="text-2xl font-bold text-slate-800">{formatRupiah(totalAmount)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:shadow-none"
        >
          Bayar Sekarang
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-normal bg-white/20 px-2 py-0.5 rounded-md ml-2">
            <Keyboard className="w-3 h-3" /> F8
          </div>
        </button>
      </div>
    </>
  );

  if (isMobileSheet) {
    return (
      <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={onClose}>
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>
          {panelContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border-l border-slate-200 bg-white flex flex-col h-full shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
      {panelContent}
    </div>
  );
}
