import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { 
  Plus, Eye, Receipt, 
  CheckCircle, Clock, Warning, Calendar,
  ListNumbers, HandCoins
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRupiah, type PBFInvoice } from '../../lib/types';
import { InvoiceModal } from './InvoiceModal';
import { InvoicePaymentModal } from './InvoicePaymentModal';

export function InvoiceList() {
  const { effectiveUserId } = useAuth();
  const [invoices, setInvoices] = useState<PBFInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PBFInvoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchInvoices = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pbf_invoices')
        .select(`
          *,
          suppliers (name),
          purchase_orders (order_number)
        `)
        .eq('pharmacy_id', effectiveUserId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInvoices(data as unknown as PBFInvoice[] || []);
    } catch (err: any) {
      toast.error('Gagal memuat Faktur PBF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [effectiveUserId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': 
        return <span className="bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit"><CheckCircle weight="fill" /> Lunas</span>;
      case 'partial': 
        return <span className="bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit"><Clock weight="fill" /> Sebagian</span>;
      case 'unpaid': 
        return <span className="bg-rose-100 text-rose-600 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit"><Warning weight="fill" /> Belum Bayar</span>;
      default: return null;
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'paid') return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 gap-4">
        <div>
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Receipt weight="fill" className="text-blue-500" />
            Daftar Faktur PBF & A/P
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pencatatan tagihan masuk dari Suplier dan jatuh tempo pembayaran</p>
        </div>
        <button
          onClick={() => setShowInvoiceModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
        >
          <Plus weight="bold" /> Catat Faktur Baru
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-medium">Menyinkronkan data faktur...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
          <Receipt className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-4" />
          <p className="font-bold text-slate-600 dark:text-slate-300 text-lg">Belum Ada Faktur Tercatat</p>
          <p className="text-sm max-w-xs mx-auto mb-6">Mulai dengan mencatat faktur pembelian yang Anda terima dari PBF (Suplier) untuk melacak hutang dagang.</p>
          <button onClick={() => setShowInvoiceModal(true)} className="bg-white dark:bg-slate-800 border border-blue-200 text-blue-600 px-6 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50 transition-colors">
            Catat Faktur Sekarang
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Nomor Faktur</th>
                  <th className="px-6 py-4">Suplier</th>
                  <th className="px-6 py-4">Tgl Faktur & Jatuh Tempo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Total Tagihan</th>
                  <th className="px-6 py-4 text-right">Sisa Hutang</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {invoices.map((inv) => {
                  const overdue = isOverdue(inv.due_date, inv.status);
                  const remaining = inv.total_amount - inv.amount_paid;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            <Receipt className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{inv.invoice_number}</p>
                            {inv.purchase_orders?.order_number && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <ListNumbers className="w-3 h-3" /> SP: {inv.purchase_orders.order_number}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{inv.suppliers?.name || '-'}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> {new Date(inv.invoice_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className={`text-xs flex items-center gap-1.5 font-medium ${overdue ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                            <Clock className="w-3.5 h-3.5" /> 
                            Jatuh Tempo: {new Date(inv.due_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {overdue && ' (TERLAMBAT)'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-slate-800 dark:text-slate-100">
                        {formatRupiah(inv.total_amount)}
                      </td>
                      <td className="px-6 py-5 text-right font-bold">
                        <span className={remaining > 0 ? (overdue ? 'text-rose-600' : 'text-amber-600') : 'text-emerald-600'}>
                          {formatRupiah(remaining)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setShowPaymentModal(true);
                            }}
                            disabled={inv.status === 'paid'}
                            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                              inv.status === 'paid' 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 shadow-sm'
                            }`}
                            title="Bayar Hutang"
                          >
                            <HandCoins weight="bold" className="w-4 h-4" />
                            Bayar
                          </button>
                          <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <InvoiceModal 
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={() => {
            setShowInvoiceModal(false);
            fetchInvoices();
          }}
        />
      )}

      {showPaymentModal && selectedInvoice && (
        <InvoicePaymentModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}
