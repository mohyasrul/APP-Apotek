import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { Plus, PencilSimple, Trash, Buildings, Phone, MapPin } from '@phosphor-icons/react';
import { toast } from 'sonner';

import { SupplierModal } from './SupplierModal';

export type Supplier = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export function SupplierList() {
  const { effectiveUserId } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();

  const fetchSuppliers = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('pharmacy_id', effectiveUserId)
        .order('name');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat data PBF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [effectiveUserId]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus PBF "${name}"? Data Surat Pesanan terkait tidak akan terhapus namun akses nama PBF mungkin hilang.`)) return;
    
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('PBF berhasil dihapus');
      setSuppliers(suppliers.filter(s => s.id !== id));
    } catch (err: any) {
      toast.error('Gagal menghapus PBF: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Daftar Suplier (PBF)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kelola daftar Pedagang Besar Farmasi</p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(undefined);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus weight="bold" /> Tambah PBF
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          Memuat data PBF...
        </div>
      ) : suppliers.length === 0 ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Buildings className="w-12 h-12 text-slate-200 mb-3" />
          <p className="font-semibold text-slate-500">Belum ada PBF terdaftar</p>
          <p className="text-sm mb-4">Tambahkan PBF untuk membuat Surat Pesanan baru.</p>
          <button onClick={() => { setEditingSupplier(undefined); setShowModal(true); }} className="text-blue-500 text-sm font-semibold hover:underline">Tambah PBF Sekarang</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1">{supplier.name}</h3>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingSupplier(supplier); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg">
                    <PencilSimple className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(supplier.id, supplier.name)} className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg">
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex gap-2 items-start">
                  <Phone className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{supplier.phone || '-'}</span>
                </div>
                <div className="flex gap-2 items-start">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-2 leading-tight">{supplier.address || '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchSuppliers();
          }}
        />
      )}
    </div>
  );
}
