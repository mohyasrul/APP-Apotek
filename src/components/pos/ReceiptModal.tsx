import { useState } from 'react';
import { formatRupiah } from '../../lib/types';
import type { ReceiptData, ReceiptItem } from '../../lib/receipt';
import { printReceipt, generateWhatsAppText, printEtiket } from '../../lib/receipt';
import {
  CheckCircle, Printer, WhatsappLogo, Tag
} from '@phosphor-icons/react';

type Props = {
  receipt: ReceiptData;
  defaultWANumber: string;
  onClose: () => void;
};

export function ReceiptModal({ receipt, defaultWANumber, onClose }: Props) {
  const [showWAModal, setShowWAModal] = useState(false);
  const [waNumber, setWaNumber] = useState(defaultWANumber || '62');

  const handlePrint = () => printReceipt(receipt);
  const handlePrintEtiket = (item: ReceiptItem) => printEtiket(item, receipt);

  const itemsWithSigna = receipt.items.filter(item => item.signa && item.signa.trim().length > 0);

  const handleSendWhatsApp = () => {
    if (!waNumber || waNumber.length < 6) return;
    const text = generateWhatsAppText(receipt);
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, '_blank');
    setShowWAModal(false);
  };

  if (showWAModal) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        role="dialog" aria-modal="true" aria-label="Kirim Struk WhatsApp">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><WhatsappLogo weight="fill" className="w-5 h-5 text-emerald-500" /> Kirim Struk via WhatsApp</h3>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Nomor WhatsApp Pelanggan</label>
          <input type="tel" value={waNumber} onChange={(e) => setWaNumber(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 mb-2"
            placeholder="628123456789" autoFocus />
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Format: 628xxx (tanpa +)</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowWAModal(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button onClick={handleSendWhatsApp} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 shadow-sm">Kirim</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Struk Transaksi">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><CheckCircle weight="fill" className="w-8 h-8" /></div>
          <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-1">Transaksi Berhasil!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">No: {receipt.transactionNumber}</p>
          <p className="text-2xl font-bold text-emerald-600 mb-2">{formatRupiah(receipt.total)}</p>
          {receipt.cashReceived && receipt.cashReceived > receipt.total && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Kembalian: <span className="font-bold text-emerald-600">{formatRupiah(receipt.cashReceived - receipt.total)}</span></p>
          )}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={handlePrint} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Printer weight="fill" className="w-6 h-6 text-slate-600 dark:text-slate-300" /><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cetak Struk</span>
            </button>
            <button onClick={() => setShowWAModal(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-colors">
              <WhatsappLogo weight="fill" className="w-6 h-6 text-emerald-600" /><span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Kirim WA</span>
            </button>
          </div>

          {itemsWithSigna.length > 0 && (
            <div className="mb-4 text-left border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
                <Tag weight="fill" className="text-blue-500" /> Cetak Label Etiket Obat
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {itemsWithSigna.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg">
                    <div className="truncate pr-2">
                       <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                       <p className="text-slate-500 dark:text-slate-400 truncate">{item.signa}</p>
                    </div>
                    <button onClick={() => handlePrintEtiket(item)} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-md transition-colors shrink-0" title="Cetak Etiket">
                      <Printer weight="fill" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={onClose} className="w-full py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Selesai</button>
        </div>
      </div>
    </div>
  );
}
