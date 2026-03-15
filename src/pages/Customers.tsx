import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { formatRupiah, isValidPhone } from "../lib/types";
import type { Customer } from "../lib/types";
import {
  Plus, MagnifyingGlass, PencilSimple, TrashSimple, X,
  User, Phone, Receipt, Warning, UsersFour, WhatsappLogo
} from "@phosphor-icons/react";

type CustomerWithStats = Customer & {
  transaction_count?: number;
  total_spend?: number;
};

export default function Customers() {
  const { user, profile, effectiveUserId } = useAuth();

  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name');
      if (error) throw error;

      // Ambil statistik transaksi per customer
      const customerIds = (data || []).map(c => c.id);
      const statsMap: Record<string, { count: number; total: number }> = {};

      if (customerIds.length > 0) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('customer_id, total_amount')
          .in('customer_id', customerIds)
          .eq('status', 'active');

        (txData || []).forEach(tx => {
          if (!tx.customer_id) return;
          if (!statsMap[tx.customer_id]) statsMap[tx.customer_id] = { count: 0, total: 0 };
          statsMap[tx.customer_id].count++;
          statsMap[tx.customer_id].total += tx.total_amount;
        });
      }

      setCustomers((data || []).map(c => ({
        ...c,
        transaction_count: statsMap[c.id]?.count || 0,
        total_spend: statsMap[c.id]?.total || 0,
      })));
    } catch (err: unknown) {
      toast.error('Gagal memuat data pelanggan: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveUserId]);

  useEffect(() => {
    if (user) fetchCustomers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveUserId]);

  const resetForm = () => {
    setForm({ name: '', phone: '', notes: '' });
    setEditingId(null);
  };

  const openEdit = (c: Customer) => {
    setForm({ name: c.name, phone: c.phone || '', notes: c.notes || '' });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    // Validate phone format
    if (form.phone && !isValidPhone(form.phone)) {
      toast.warning('Format nomor HP tidak valid. Gunakan format 628xxx atau 08xxx');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: effectiveUserId,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Data pelanggan diperbarui');
      } else {
        const { error } = await supabase.from('customers').insert([payload]);
        if (error) throw error;
        toast.success('Pelanggan baru ditambahkan');
      }
      setShowForm(false);
      resetForm();
      fetchCustomers();
    } catch (err: unknown) {
      toast.error('Gagal menyimpan: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`${deleteTarget.name} dihapus dari daftar pelanggan`);
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err: unknown) {
      toast.error('Gagal menghapus: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setDeleting(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="font-sans text-slate-800 dark:text-slate-100 antialiased min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 pb-20 md:pb-0">

      <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <UsersFour weight="fill" className="w-6 h-6 text-blue-500" />
              Pelanggan
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola data pelanggan dan lihat riwayat transaksi mereka.
            </p>
          </div>
          {profile?.role === 'owner' && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-[0_4px_12px_rgba(59,130,246,0.3)] transition-all"
            >
              <Plus weight="bold" className="w-4 h-4" />
              Tambah Pelanggan
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlass weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="search"
            placeholder="Cari nama atau nomor HP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Total Pelanggan</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{customers.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Dengan Nomor HP</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{customers.filter(c => c.phone).length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Total Transaksi</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {customers.reduce((s, c) => s + (c.transaction_count || 0), 0)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">Memuat data pelanggan...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 text-center">
              <UsersFour className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {searchQuery ? 'Tidak ada pelanggan yang cocok' : 'Belum ada data pelanggan'}
              </p>
              {!searchQuery && profile?.role === 'owner' && (
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="mt-3 text-blue-500 text-sm font-semibold hover:underline"
                >
                  Tambah pelanggan pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Pelanggan</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Nomor HP</th>
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Transaksi</th>
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Total Belanja</th>
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Catatan</th>
                    {profile?.role === 'owner' && (
                      <th className="px-5 py-3.5 text-right font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 font-bold text-sm">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span>{c.phone}</span>
                            <a
                              href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-md transition-colors"
                              title="Chat WhatsApp"
                            >
                              <WhatsappLogo weight="fill" className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {c.transaction_count ? (
                          <div className="flex items-center justify-end gap-1 text-slate-600 dark:text-slate-300">
                            <Receipt className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <span className="font-semibold">{c.transaction_count}</span>
                          </div>
                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {c.total_spend ? formatRupiah(c.total_spend) : <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-400 dark:text-slate-500 text-xs max-w-[160px] truncate">
                        {c.notes || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      {profile?.role === 'owner' && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(c)} title="Edit"
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors">
                              <PencilSimple weight="bold" className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(c)} title="Hapus"
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors">
                              <TrashSimple weight="bold" className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 id="customer-form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editingId ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <User className="inline w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  Nama Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama lengkap pelanggan"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <Phone className="inline w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="628123456789"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Format: 628xxx (tanpa +). Untuk kirim WhatsApp struk.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Catatan</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Alergi obat, kondisi khusus, dll."
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving || !form.name.trim()}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Tambah')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog" aria-modal="true" aria-labelledby="delete-customer-title">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <Warning weight="fill" className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 id="delete-customer-title" className="text-lg font-bold mb-2">Hapus Pelanggan?</h2>
            <p className="text-sm text-slate-500 mb-6">
              <strong>{deleteTarget.name}</strong> akan dihapus dari daftar. Data transaksi yang sudah ada tidak terpengaruh.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
