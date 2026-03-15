import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { BookBookmark, Plus, CheckCircle, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';

export type DefectaItem = {
  id: string;
  medicine_id: string;
  recorded_date: string;
  status: 'pending' | 'ordered';
  required_stock: number;
  current_stock: number;
  notes: string | null;
  medicines: { name: string; unit: string } | null;
};

export function DefectaList() {
  const { effectiveUserId } = useAuth();
  const [items, setItems] = useState<DefectaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDefecta = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('defecta_books')
        .select(`
          id, medicine_id, recorded_date, status, required_stock, current_stock, notes,
          medicines (name, unit)
        `)
        .eq('pharmacy_id', effectiveUserId)
        .order('status', { ascending: false }) // 'pending' > 'ordered' desc
        .order('recorded_date', { ascending: false });
      
      if (error) throw error;
      setItems(data as unknown as DefectaItem[] || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal memuat Buku Defecta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefecta();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const handleMarkOrdered = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('defecta_books')
        .update({ status: 'ordered' })
        .eq('id', id);
      
      if (error) throw error;
      toast.success(`${name} ditandai sudah dipesan`);
      setItems(items.map(i => i.id === id ? { ...i, status: 'ordered' } : i));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal update status: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">Buku Defecta</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Catatan stok obat yang perlu dipesan kembali</p>
        </div>
        <button
          onClick={() => toast.info('Fitur auto-generate Defecta segera hadir')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus weight="bold" /> Generate dari Stok Minimum
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          Memuat data...
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
          <BookBookmark className="w-12 h-12 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">Buku Defecta Kosong</p>
          <p className="text-sm mb-4">Semua stok obat masih dalam batas aman.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-5 py-4">Tanggal Dicatat</th>
                  <th className="px-5 py-4">Nama Obat</th>
                  <th className="px-5 py-4 text-center">Stok Sisa</th>
                  <th className="px-5 py-4 text-center">Rencana Pesan</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-5 py-4">
                      {new Date(item.recorded_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-gray-200">
                      {item.medicines?.name || 'Obat Dihapus'}
                    </td>
                    <td className="px-5 py-4 text-center text-rose-500 font-bold">
                      {item.current_stock}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                      {item.required_stock} <span className="text-xs text-gray-500 font-normal">{item.medicines?.unit}</span>
                    </td>
                    <td className="px-5 py-4">
                      {item.status === 'pending' ? (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1 w-fit">
                          <Clock weight="fill" /> Pending
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1 w-fit">
                          <CheckCircle weight="fill" /> Selesai Dipesan
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {item.status === 'pending' && (
                        <button 
                          onClick={() => handleMarkOrdered(item.id, item.medicines?.name || 'Obat')}
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Tandai Dipesan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
