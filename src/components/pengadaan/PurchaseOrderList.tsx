import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { Plus, Eye, Printer, Truck, FileText, CheckCircle, XCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRupiah } from '../../lib/types';
import { PurchaseOrderModal } from './PurchaseOrderModal';

export type PurchaseOrder = {
  id: string;
  order_number: string;
  order_date: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  order_type: 'reguler' | 'prekursor' | 'oot' | 'narkotika' | 'psikotropika';
  total_amount: number;
  suppliers: { name: string } | null;
  created_at: string;
};

export function PurchaseOrderList() {
  const { effectiveUserId } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchOrders = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, order_number, order_date, status, order_type, total_amount, created_at,
          suppliers (name)
        `)
        .eq('pharmacy_id', effectiveUserId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data as unknown as PurchaseOrder[] || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal memuat Surat Pesanan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-semibold">Draft</span>;
      case 'sent': return <span className="bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><Truck weight="fill" /> Dikirim</span>;
      case 'received': return <span className="bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle weight="fill" /> Diterima</span>;
      case 'cancelled': return <span className="bg-rose-100 text-rose-600 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle weight="fill" /> Dibatalkan</span>;
      default: return null;
    }
  };
  
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'reguler': return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Reguler</span>;
      case 'narkotika': return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-rose-200">Narkotika</span>;
      case 'psikotropika': return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-rose-200">Psikotropika</span>;
      case 'prekursor': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-amber-200">Prekursor</span>;
      case 'oot': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-amber-200">OOT</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Daftar Surat Pesanan (SP)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kelola riwayat pesanan ke PBF</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus weight="bold" /> Buat SP Baru
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          Memuat data...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-200 mb-3" />
          <p className="font-semibold text-slate-500">Belum ada Surat Pesanan</p>
          <p className="text-sm mb-4">Buat Surat Pesanan pertama Anda ke PBF.</p>
          <button onClick={() => setShowModal(true)} className="text-blue-500 text-sm font-semibold hover:underline">Buat SP Sekarang</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-5 py-4">Nomor SP & Tanggal</th>
                  <th className="px-5 py-4">Suplier (PBF)</th>
                  <th className="px-5 py-4">Tipe SP</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Total (Estimasi)</th>
                  <th className="px-5 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{po.order_number}</p>
                      <p className="text-xs">{new Date(po.order_date).toLocaleDateString('id-ID')}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">
                      {po.suppliers?.name || '-'}
                    </td>
                    <td className="px-5 py-4">
                      {getTypeBadge(po.order_type)}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {formatRupiah(po.total_amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-100 hover:bg-blue-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors" title="Lihat Detail">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-100 hover:bg-blue-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors" title="Cetak SP">
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <PurchaseOrderModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
