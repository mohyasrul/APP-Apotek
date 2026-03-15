import { useState } from 'react';
import { X, Buildings, Phone, MapPin } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import type { Supplier } from './SupplierList';

type Props = {
  supplier?: Supplier;
  onClose: () => void;
  onSuccess: () => void;
};

export function SupplierModal({ supplier, onClose, onSuccess }: Props) {
  const { effectiveUserId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [name, setName] = useState(supplier?.name || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const email = supplier?.email || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Nama PBF wajib diisi');
    
    setIsSubmitting(true);
    try {
      const payload = {
        pharmacy_id: effectiveUserId,
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      };

      let error;
      if (supplier) {
        ({ error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id));
      } else {
        ({ error } = await supabase.from('suppliers').insert([payload]));
      }

      if (error) throw error;
      
      toast.success(supplier ? 'PBF berhasil diperbarui' : 'PBF berhasil ditambahkan');
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Gagal menyimpan PBF: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Buildings className="w-5 h-5 text-indigo-600" />
            {supplier ? 'Edit PBF' : 'Tambah PBF Baru'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nama PBF *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Buildings className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-gray-900 dark:text-gray-100 text-sm"
                placeholder="PT Pedagang Besar Farmasi"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">No. Telepon / WA</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-gray-900 dark:text-gray-100 text-sm"
                placeholder="0812xxxxxx"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Alamat Lengkap</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 pointer-events-none">
                <MapPin className="text-gray-400 w-5 h-5" />
              </div>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-gray-900 dark:text-gray-100 text-sm resize-none"
                placeholder="Jl. Raya Farma No. 123..."
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan PBF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
