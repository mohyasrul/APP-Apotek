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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-2"><CreditCard weight="fill" className="w-5 h-5 text-indigo-600" /><h3 id="checkout-title" className="font-bold text-lg text-gray-900 dark:text-gray-100">Checkout</h3></div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"><X weight="bold" className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {/* Order summary */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Ringkasan</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{item.name} x{item.quantity}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {(globalDiscount > 0) && (
              <div className="border-t border-gray-200 dark:border-zinc-700 mt-3 pt-2 flex justify-between text-sm">
                <span className="text-indigo-600">Diskon</span>
                <span className="text-indigo-600">-{formatRupiah(globalDiscount)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 dark:border-zinc-700 mt-2 pt-3 flex justify-between">
              <span className="font-bold text-gray-900 dark:text-gray-100">Total</span>
              <span className="text-lg font-semibold text-indigo-600">{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          {/* Payment method */}
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Metode Pembayaran</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {paymentMethods.map(pm => (
              <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === pm.value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm' : 'border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700'}`}>
                <pm.icon weight="fill" className={`w-6 h-6 ${paymentMethod === pm.value ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className={`text-xs font-semibold ${paymentMethod === pm.value ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400'}`}>{pm.label}</span>
              </button>
            ))}
          </div>

          {/* Cash input */}
          {paymentMethod === 'cash' && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Uang Diterima (Rp)</label>
              <input type="number" min="0" value={cashReceived || ''} onChange={(e) => setCashReceived(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl text-base font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500"
                placeholder={totalAmount.toString()} />
              {changeAmount > 0 && (
                <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-lg flex justify-between">
                  <span className="text-sm text-emerald-600 font-medium">Kembalian</span>
                  <span className="text-base font-semibold text-emerald-600">{formatRupiah(changeAmount)}</span>
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
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center justify-center gap-2">
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
