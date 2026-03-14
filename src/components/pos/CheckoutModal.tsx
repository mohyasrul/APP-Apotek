import { useState } from 'react';
import { formatRupiah } from '../../lib/types';
import type { CartItem } from '../../lib/store';
import type { PaymentMethod } from '../../lib/types';
import { CustomerAutocomplete } from './CustomerAutocomplete';
import {
  CreditCard, X, Money, QrCode, Bank, CheckCircle
} from '@phosphor-icons/react';

type Props = {
  cart: CartItem[];
  totalAmount: number;
  globalDiscount: number;
  effectiveUserId: string | null;
  isProcessing: boolean;
  onCheckout: (paymentMethod: PaymentMethod, cashReceived: number, customerName: string, customerPhone: string) => void;
  onClose: () => void;
};

const paymentMethods = [
  { value: 'cash' as PaymentMethod, label: 'Tunai', icon: Money, color: 'emerald' },
  { value: 'qris' as PaymentMethod, label: 'QRIS', icon: QrCode, color: 'blue' },
  { value: 'transfer' as PaymentMethod, label: 'Transfer', icon: Bank, color: 'purple' },
];

export function CheckoutModal({ cart, totalAmount, globalDiscount, effectiveUserId, isProcessing, onCheckout, onClose }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const changeAmount = paymentMethod === 'cash' && cashReceived > totalAmount ? cashReceived - totalAmount : 0;

  const handleSubmit = () => {
    onCheckout(paymentMethod, cashReceived, customerName, customerPhone);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2"><CreditCard weight="fill" className="w-5 h-5 text-blue-500" /><h3 id="checkout-title" className="font-bold text-lg text-slate-800 dark:text-slate-100">Checkout</h3></div>
          <button onClick={onClose} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X weight="bold" className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {/* Order summary */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Ringkasan</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{item.name} x{item.quantity}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {(globalDiscount > 0) && (
              <div className="border-t border-slate-200 dark:border-slate-700 mt-3 pt-2 flex justify-between text-sm">
                <span className="text-blue-500">Diskon</span>
                <span className="text-blue-500">-{formatRupiah(globalDiscount)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-3 flex justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-100">Total</span>
              <span className="text-xl font-bold text-blue-600">{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          {/* Payment method */}
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Metode Pembayaran</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {paymentMethods.map(pm => (
              <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === pm.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-sm' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                <pm.icon weight="fill" className={`w-6 h-6 ${paymentMethod === pm.value ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className={`text-xs font-semibold ${paymentMethod === pm.value ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}>{pm.label}</span>
              </button>
            ))}
          </div>

          {/* Cash input */}
          {paymentMethod === 'cash' && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Uang Diterima (Rp)</label>
              <input type="number" min="0" value={cashReceived || ''} onChange={(e) => setCashReceived(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                placeholder={totalAmount.toString()} />
              {changeAmount > 0 && (
                <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-lg flex justify-between">
                  <span className="text-sm text-emerald-600 font-medium">Kembalian</span>
                  <span className="text-lg font-bold text-emerald-600">{formatRupiah(changeAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Customer info with autocomplete */}
          <div className="mb-6">
            <CustomerAutocomplete
              effectiveUserId={effectiveUserId}
              customerName={customerName}
              customerPhone={customerPhone}
              onSelectCustomer={(name, phone) => {
                setCustomerName(name);
                setCustomerPhone(phone);
              }}
            />
          </div>

          <button onClick={handleSubmit} disabled={isProcessing || (paymentMethod === 'cash' && cashReceived < totalAmount && cashReceived > 0)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center justify-center gap-2">
            {isProcessing ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</>
            ) : (
              <><CheckCircle weight="fill" className="w-5 h-5" /> Konfirmasi Pembayaran</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
