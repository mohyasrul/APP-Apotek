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
    } catch (err: any) {
      toast.error('Gagal menyimpan PBF: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Buildings className="w-5 h-5 text-blue-500" />
            {supplier ? 'Edit PBF' : 'Tambah PBF Baru'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama PBF *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Buildings className="text-slate-400 w-5 h-5" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 text-sm"
                placeholder="PT Pedagang Besar Farmasi"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">No. Telepon / WA</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="text-slate-400 w-5 h-5" />
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 text-sm"
                placeholder="0812xxxxxx"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Alamat Lengkap</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 pointer-events-none">
                <MapPin className="text-slate-400 w-5 h-5" />
              </div>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100 text-sm resize-none"
                placeholder="Jl. Raya Farma No. 123..."
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan PBF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
