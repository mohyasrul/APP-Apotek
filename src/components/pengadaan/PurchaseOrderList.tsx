import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { Plus, Eye, Printer, Truck, FileText, CheckCircle, XCircle, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRupiah } from '../../lib/types';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { printSuratPesanan } from '../../lib/receipt';

export type PurchaseOrder = {
  id: string;
  order_number: string;
  order_date: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  order_type: 'reguler' | 'prekursor' | 'oot' | 'narkotika' | 'psikotropika';
  total_amount: number;
  suppliers: { name: string; address?: string | null } | null;
  created_at: string;
};

type POItem = {
  id: string;
  medicine_id: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  medicines: { name: string } | null;
};

export function PurchaseOrderList() {
  const { effectiveUserId, profile } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Detail modal
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [selectedItems, setSelectedItems] = useState<POItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchOrders = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, order_number, order_date, status, order_type, total_amount, created_at,
          suppliers (name, address)
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

  const fetchItems = async (poId: string): Promise<POItem[]> => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('id, medicine_id, quantity, unit, estimated_price, medicines(name)')
        .eq('po_id', poId);
      if (error) throw error;
      const items = (data as unknown as POItem[]) || [];
      setSelectedItems(items);
      return items;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal memuat item SP: ' + err.message);
      return [];
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const openDetail = (po: PurchaseOrder) => {
    setSelected(po);
    setSelectedItems([]);
    fetchItems(po.id);
  };

  const handlePrint = async (po: PurchaseOrder) => {
    let items: POItem[];
    if (selected?.id === po.id && selectedItems.length > 0) {
      items = selectedItems;
    } else {
      items = await fetchItems(po.id);
    }
    printSuratPesanan({
      order_number: po.order_number,
      order_date: po.order_date,
      order_type: po.order_type,
      supplier_name: po.suppliers?.name || '-',
      supplier_address: po.suppliers?.address ?? null,
      pharmacy_name: profile?.pharmacy_name || '-',
      pharmacy_address: profile?.pharmacy_address ?? null,
      sia_number: profile?.sia_number ?? null,
      apoteker_name: profile?.apoteker_name ?? null,
      sipa_number: profile?.sipa_number ?? null,
      items: items.map((item, idx) => ({
        no: idx + 1,
        medicine_name: item.medicines?.name || '-',
        quantity: item.quantity,
        unit: item.unit,
        estimated_price: item.estimated_price,
      })),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-medium">Draft</span>;
      case 'sent':  return <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1"><Truck weight="fill" /> Dikirim</span>;
      case 'received': return <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1"><CheckCircle weight="fill" /> Diterima</span>;
      case 'cancelled': return <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1"><XCircle weight="fill" /> Dibatalkan</span>;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'reguler':     return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Reguler</span>;
      case 'narkotika':   return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-rose-200">Narkotika</span>;
      case 'psikotropika':return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-rose-200">Psikotropika</span>;
      case 'prekursor':   return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-amber-200">Prekursor</span>;
      case 'oot':         return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-amber-200">OOT</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">Daftar Surat Pesanan (SP)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola riwayat pesanan ke PBF</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus weight="bold" /> Buat SP Baru
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          Memuat data...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
          <FileText className="w-12 h-12 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">Belum ada Surat Pesanan</p>
          <p className="text-sm mb-4">Buat Surat Pesanan pertama Anda ke PBF.</p>
          <button onClick={() => setShowModal(true)} className="text-indigo-600 text-sm font-semibold hover:underline">Buat SP Sekarang</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-5 py-4">Nomor SP &amp; Tanggal</th>
                  <th className="px-5 py-4">Suplier (PBF)</th>
                  <th className="px-5 py-4">Tipe SP</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Total (Estimasi)</th>
                  <th className="px-5 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {orders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900 dark:text-gray-100">{po.order_number}</p>
                      <p className="text-xs">{new Date(po.order_date).toLocaleDateString('id-ID')}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-gray-200">
                      {po.suppliers?.name || '-'}
                    </td>
                    <td className="px-5 py-4">
                      {getTypeBadge(po.order_type)}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900 dark:text-gray-200">
                      {formatRupiah(po.total_amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openDetail(po)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                          title="Lihat Detail"
                          aria-label="Lihat detail SP"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(po)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                          title="Cetak SP"
                          aria-label="Cetak Surat Pesanan"
                        >
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

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sp-detail-title"
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h3 id="sp-detail-title" className="font-bold text-gray-900 dark:text-gray-100">{selected.order_number}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selected.order_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                aria-label="Tutup detail"
              >
                <X weight="bold" className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(selected.status)}
                {getTypeBadge(selected.order_type)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Supplier (PBF)</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{selected.suppliers?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Total Estimasi</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{formatRupiah(selected.total_amount)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Daftar Item {loadingItems ? '(memuat…)' : `(${selectedItems.length})`}
                </h4>
                {loadingItems ? (
                  <div className="py-4 text-center">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item, i) => (
                      <div key={item.id} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                        <div>
                          <span className="text-xs text-gray-400 mr-1">{i + 1}.</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.medicines?.name || '-'}</span>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{item.quantity} {item.unit}</span>
                          {item.estimated_price > 0 && (
                            <p className="text-xs text-gray-400">{formatRupiah(item.estimated_price)}/unit</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => handlePrint(selected)}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                <Printer weight="bold" className="w-4 h-4" />
                Cetak SP
              </button>
            </div>
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
