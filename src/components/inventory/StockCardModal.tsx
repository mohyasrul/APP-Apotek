import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  X, ClockCounterClockwise, ArrowUpRight, ArrowDownLeft, 
  Tag, Info, Warning, Flask
} from '@phosphor-icons/react';
import { type Medicine, type StockMovement } from '../../lib/types';

type Props = {
  medicine: Medicine;
  onClose: () => void;
};

type StockCardEntry = StockMovement & {
  balance?: number;
  batch?: {
    batch_number: string;
    expiry_date: string;
  };
};

export function StockCardModal({ medicine, onClose }: Props) {
  const [entries, setEntries] = useState<StockCardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockCard();
  }, [medicine.id]);

  const fetchStockCard = async () => {
    setLoading(true);
    try {
      // Fetch movements with batch details
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          medicine_batches (batch_number, expiry_date)
        `)
        .eq('medicine_id', medicine.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Map data and calculate running balance (simplified for the visible list)
      // Note: In a real "Kartu Stok", we'd need to fetch the balance at the start of the period.
      // For now, we'll just show the increments/decrements.
      
      const mappedEntries = (data || []).map(entry => ({
        ...entry,
        batch: entry.medicine_batches
      }));

      setEntries(mappedEntries);
    } catch (err) {
      console.error('Error fetching stock card:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'restock': return <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><ArrowDownLeft weight="bold" /></div>;
      case 'sale': return <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><ArrowUpRight weight="bold" /></div>;
      case 'adjustment': return <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Warning weight="bold" /></div>;
      case 'expired_removal': return <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><Flask weight="bold" /></div>;
      case 'void_return': return <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><ArrowDownLeft weight="bold" /></div>;
      default: return <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Info weight="bold" /></div>;
    }
  };

  const getMovementLabel = (type: string) => {
    const labels: Record<string, string> = {
      restock: 'Barang Masuk',
      sale: 'Penjualan',
      adjustment: 'Penyesuaian Stok',
      expired_removal: 'Pemusnahan ED',
      void_return: 'Void (Retur)',
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
              <ClockCounterClockwise weight="fill" className="text-white w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">Kartu Stok (Ledger)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {medicine.name} · Stok: <span className="font-bold text-slate-700 dark:text-slate-200">{medicine.stock} {medicine.unit}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X weight="bold" className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-medium">Menyusun riwayat pergerakan stok...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center">
              <ClockCounterClockwise className="w-16 h-16 text-slate-200 mb-4" />
              <p className="font-bold text-slate-600 text-lg">Hening...</p>
              <p className="text-sm">Belum ada pergerakan stok untuk obat ini.</p>
            </div>
          ) : (
            <div className="px-4 pb-6">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 text-slate-500 uppercase text-[10px] tracking-wider font-black py-4 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-4">Waktu & Tipe</th>
                    <th className="py-4">Batch / Keterangan</th>
                    <th className="py-4 text-center">Masuk</th>
                    <th className="py-4 text-center">Keluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          {getMovementIcon(entry.type)}
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 uppercase text-[11px] tracking-tight">{getMovementLabel(entry.type)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {new Date(entry.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="space-y-1">
                          {entry.batch && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded-md w-fit">
                              <Tag weight="fill" className="w-3 h-3" />
                              LOT: {entry.batch.batch_number}
                            </div>
                          )}
                          <p className="text-xs text-slate-500 italic max-w-xs">{entry.notes || <span className="text-slate-300">—</span>}</p>
                          {entry.reference_id && (
                            <p className="text-[9px] text-slate-400 font-mono">REF: {entry.reference_id.slice(0, 8)}...</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        {entry.quantity > 0 ? (
                          <span className="font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">+{entry.quantity}</span>
                        ) : null}
                      </td>
                      <td className="py-4 text-center">
                        {entry.quantity < 0 ? (
                          <span className="font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-lg">{entry.quantity}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-3xl border-t border-slate-100 dark:border-slate-800">
           <div className="flex items-center gap-3 text-xs text-slate-500">
             <Info weight="fill" className="w-4 h-4 text-blue-500" />
             <p>Data ini mencatat setiap perubahan stok manual, hasil penjualan POS, maupun pemusnahan barang kedaluwarsa.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
