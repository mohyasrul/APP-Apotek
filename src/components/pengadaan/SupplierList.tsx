import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { Plus, PencilSimple, Trash, Buildings, Phone, MapPin, Warning, X } from '@phosphor-icons/react';
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
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal memuat data PBF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const handleDelete = async (id: string, name: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success(`PBF "${name}" berhasil dihapus`);
      setSuppliers(suppliers.filter(s => s.id !== id));
      setDeleteTarget(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal menghapus PBF: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">Daftar Suplier (PBF)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola daftar Pedagang Besar Farmasi</p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(undefined);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus weight="bold" /> Tambah PBF
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          Memuat data PBF...
        </div>
      ) : suppliers.length === 0 ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
          <Buildings className="w-12 h-12 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">Belum ada PBF terdaftar</p>
          <p className="text-sm mb-4">Tambahkan PBF untuk membuat Surat Pesanan baru.</p>
          <button onClick={() => { setEditingSupplier(undefined); setShowModal(true); }} className="text-indigo-600 text-sm font-semibold hover:underline">Tambah PBF Sekarang</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 line-clamp-1">{supplier.name}</h3>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingSupplier(supplier); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-lg" aria-label="Edit PBF">
                    <PencilSimple className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(supplier)} className="p-1.5 text-gray-400 hover:text-rose-500 bg-gray-50 hover:bg-rose-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-lg" aria-label="Hapus PBF">
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-supplier-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center shrink-0">
                <Warning weight="fill" className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1">
                <h3 id="delete-supplier-title" className="font-semibold text-gray-900 dark:text-gray-100">Hapus PBF?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <strong>{deleteTarget.name}</strong> akan dihapus. Data Surat Pesanan terkait tidak akan terhapus namun nama PBF tidak akan tampil.
                </p>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg shrink-0">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id, deleteTarget.name)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
