import { useState, useEffect } from 'react';
import {
  Warning, Plus, MagnifyingGlass, X, FloppyDisk,
  User, Calendar, Pill, Info, Trash, FirstAidKit
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type MesoRecord = {
  id: string;
  user_id: string;
  tanggal: string;
  patient_name: string;
  patient_age?: string | null;
  patient_gender?: string | null;
  medicine_name: string;       // nama obat yang dicurigai
  batch_number?: string | null;
  indication: string;          // indikasi penggunaan obat
  reaction: string;            // efek samping yang dilaporkan
  severity: 'ringan' | 'sedang' | 'berat' | 'mengancam_jiwa';
  onset: string;               // kapan efek samping muncul
  action_taken: string;        // tindakan yang diambil
  outcome: string;             // kondisi pasien setelah penanganan
  reported_to_bpom: boolean;
  reporter_name: string;
  catatan?: string | null;
  created_at: string;
};

type DraftMeso = Omit<MesoRecord, 'id' | 'user_id' | 'created_at'>;

const emptyDraft = (): DraftMeso => ({
  tanggal: new Date().toISOString().split('T')[0],
  patient_name: '',
  patient_age: '',
  patient_gender: 'laki-laki',
  medicine_name: '',
  batch_number: '',
  indication: '',
  reaction: '',
  severity: 'ringan',
  onset: '',
  action_taken: '',
  outcome: '',
  reported_to_bpom: false,
  reporter_name: '',
  catatan: '',
});

const SEVERITY_LABELS: Record<string, string> = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
  mengancam_jiwa: 'Mengancam Jiwa',
};

const SEVERITY_COLORS: Record<string, string> = {
  ringan: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  sedang: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  berat: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  mengancam_jiwa: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Meso() {
  const { effectiveUserId, profile } = useAuth();
  const [records, setRecords] = useState<MesoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftMeso>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MesoRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meso_reports')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('tanggal', { ascending: false });
      if (error) throw error;
      setRecords(data as MesoRecord[] || []);
    } catch (err: unknown) {
      toast.error('Gagal memuat data MESO: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [effectiveUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.patient_name.trim()) return toast.error('Nama pasien wajib diisi');
    if (!draft.medicine_name.trim()) return toast.error('Nama obat wajib diisi');
    if (!draft.reaction.trim()) return toast.error('Deskripsi efek samping wajib diisi');
    if (!draft.reporter_name.trim()) return toast.error('Nama pelapor wajib diisi');

    setSaving(true);
    try {
      const { error } = await supabase.from('meso_reports').insert([{
        ...draft,
        user_id: effectiveUserId,
      }]);
      if (error) throw error;
      toast.success('Laporan MESO berhasil disimpan');
      setShowForm(false);
      setDraft(emptyDraft());
      fetchRecords();
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
      const { error } = await supabase.from('meso_reports').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Laporan MESO dihapus');
      setDeleteTarget(null);
      fetchRecords();
    } catch (err: unknown) {
      toast.error('Gagal menghapus: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setDeleting(false);
    }
  };

  const set = (field: keyof DraftMeso, value: string | boolean) =>
    setDraft(prev => ({ ...prev, [field]: value }));

  const filtered = records.filter(r =>
    r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.reaction.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inputClass = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';
  const labelClass = 'block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full pb-20 lg:pb-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FirstAidKit weight="fill" className="w-6 h-6 text-rose-500" />
            Monitoring Efek Samping Obat (MESO)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Dokumentasi dan pelaporan efek samping obat sesuai PMK 73/2016 & Per-BPOM No. 24/2017
          </p>
        </div>
        <button
          onClick={() => { setDraft(emptyDraft()); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all"
        >
          <Plus weight="bold" className="w-4 h-4" />
          Laporkan MESO
        </button>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 flex gap-3">
        <Info weight="fill" className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-300">
          <p className="font-semibold mb-1">Kewajiban Farmakovigilans</p>
          <p>Apotek berperan aktif dalam Farmakovigilans sesuai PMK 73/2016. Setiap MESO yang serius atau baru harus dilaporkan ke BPOM melalui <strong>e-MESO</strong> (<a href="https://e-meso.pom.go.id" target="_blank" rel="noopener noreferrer" className="underline">e-meso.pom.go.id</a>).</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <MagnifyingGlass weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Cari pasien, obat, atau efek samping..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Records */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-rose-400 border-t-transparent rounded-full animate-spin mb-3" />
          Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <FirstAidKit className="w-12 h-12 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-500">Belum ada laporan MESO</p>
          <p className="text-sm text-slate-400 mb-4">Dokumen laporan efek samping obat akan ditampilkan di sini.</p>
          <button onClick={() => { setDraft(emptyDraft()); setShowForm(true); }} className="text-rose-500 text-sm font-semibold hover:underline">
            Buat Laporan Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${SEVERITY_COLORS[r.severity]}`}>
                    {SEVERITY_LABELS[r.severity]}
                  </span>
                  {r.reported_to_bpom && (
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      ✓ Dilaporkan ke BPOM
                    </span>
                  )}
                </div>
                {profile?.role === 'owner' && (
                  <button onClick={() => setDeleteTarget(r)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                    <Trash weight="bold" className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="flex gap-2">
                  <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Pasien</p>
                    <p className="text-slate-800 dark:text-slate-100 font-semibold">{r.patient_name}</p>
                    {r.patient_age && <p className="text-xs text-slate-500">{r.patient_age} th, {r.patient_gender}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Pill className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Obat yang Dicurigai</p>
                    <p className="text-slate-800 dark:text-slate-100 font-semibold">{r.medicine_name}</p>
                    {r.batch_number && <p className="text-xs text-slate-500">Batch: {r.batch_number}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Tanggal Lapor</p>
                    <p className="text-slate-800 dark:text-slate-100 font-semibold">
                      {new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500">Pelapor: {r.reporter_name}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Efek Samping yang Dilaporkan</p>
                <p className="text-slate-700 dark:text-slate-200">{r.reaction}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
                <div><span className="font-semibold">Indikasi:</span> {r.indication}</div>
                <div><span className="font-semibold">Onset:</span> {r.onset}</div>
                <div><span className="font-semibold">Tindakan:</span> {r.action_taken}</div>
                <div><span className="font-semibold">Outcome:</span> {r.outcome}</div>
              </div>
              {r.catatan && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">{r.catatan}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="meso-form-title" className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Warning weight="fill" className="w-5 h-5 text-rose-500" />
                <h2 id="meso-form-title" className="text-base font-bold text-slate-800 dark:text-slate-100">Laporan MESO Baru</h2>
              </div>
              <button onClick={() => setShowForm(false)} aria-label="Tutup form" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Tanggal + Pelapor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tanggal Laporan</label>
                  <input type="date" value={draft.tanggal} onChange={e => set('tanggal', e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Nama Pelapor (Apoteker)</label>
                  <input type="text" value={draft.reporter_name} onChange={e => set('reporter_name', e.target.value)} className={inputClass} placeholder="Nama apoteker" required />
                </div>
              </div>

              {/* Pasien */}
              <fieldset className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">Data Pasien</legend>
                <div>
                  <label className={labelClass}>Nama Pasien</label>
                  <input type="text" value={draft.patient_name} onChange={e => set('patient_name', e.target.value)} className={inputClass} placeholder="Nama pasien" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Usia (tahun)</label>
                    <input type="number" value={draft.patient_age ?? ''} onChange={e => set('patient_age', e.target.value)} className={inputClass} placeholder="Usia" min={0} />
                  </div>
                  <div>
                    <label className={labelClass}>Jenis Kelamin</label>
                    <select value={draft.patient_gender ?? 'laki-laki'} onChange={e => set('patient_gender', e.target.value)} className={inputClass}>
                      <option value="laki-laki">Laki-laki</option>
                      <option value="perempuan">Perempuan</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Obat */}
              <fieldset className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">Obat yang Dicurigai</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Nama Obat</label>
                    <input type="text" value={draft.medicine_name} onChange={e => set('medicine_name', e.target.value)} className={inputClass} placeholder="Nama obat" required />
                  </div>
                  <div>
                    <label className={labelClass}>No. Batch (opsional)</label>
                    <input type="text" value={draft.batch_number ?? ''} onChange={e => set('batch_number', e.target.value)} className={inputClass} placeholder="No. batch" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Indikasi Penggunaan</label>
                  <input type="text" value={draft.indication} onChange={e => set('indication', e.target.value)} className={inputClass} placeholder="Misal: Hipertensi" />
                </div>
              </fieldset>

              {/* Efek Samping */}
              <fieldset className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">Efek Samping</legend>
                <div>
                  <label className={labelClass}>Deskripsi Efek Samping <span className="text-rose-500">*</span></label>
                  <textarea value={draft.reaction} onChange={e => set('reaction', e.target.value)} className={inputClass + ' resize-none'} rows={3} placeholder="Deskripsikan efek samping yang dialami pasien..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Tingkat Keparahan</label>
                    <select value={draft.severity} onChange={e => set('severity', e.target.value)} className={inputClass}>
                      <option value="ringan">Ringan</option>
                      <option value="sedang">Sedang</option>
                      <option value="berat">Berat</option>
                      <option value="mengancam_jiwa">Mengancam Jiwa</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Kapan Muncul (Onset)</label>
                    <input type="text" value={draft.onset} onChange={e => set('onset', e.target.value)} className={inputClass} placeholder="Misal: 30 menit setelah minum" />
                  </div>
                </div>
              </fieldset>

              {/* Penanganan */}
              <fieldset className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">Penanganan & Hasil</legend>
                <div>
                  <label className={labelClass}>Tindakan yang Diambil</label>
                  <input type="text" value={draft.action_taken} onChange={e => set('action_taken', e.target.value)} className={inputClass} placeholder="Misal: Obat dihentikan, rujuk ke dokter" />
                </div>
                <div>
                  <label className={labelClass}>Kondisi Pasien (Outcome)</label>
                  <input type="text" value={draft.outcome} onChange={e => set('outcome', e.target.value)} className={inputClass} placeholder="Misal: Pulih setelah obat dihentikan" />
                </div>
              </fieldset>

              {/* Pelaporan BPOM */}
              <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <input
                  type="checkbox"
                  id="reported_to_bpom"
                  checked={draft.reported_to_bpom}
                  onChange={e => set('reported_to_bpom', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-blue-300"
                />
                <label htmlFor="reported_to_bpom" className="text-sm text-blue-700 dark:text-blue-300">
                  Sudah dilaporkan ke portal e-MESO BPOM (<a href="https://e-meso.pom.go.id" target="_blank" rel="noopener noreferrer" className="underline font-semibold">e-meso.pom.go.id</a>)
                </label>
              </div>

              {/* Catatan */}
              <div>
                <label className={labelClass}>Catatan Tambahan (opsional)</label>
                <textarea value={draft.catatan ?? ''} onChange={e => set('catatan', e.target.value)} className={inputClass + ' resize-none'} rows={2} placeholder="Catatan tambahan..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
                  <FloppyDisk weight="bold" className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Laporan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="meso-delete-title" className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/40 rounded-xl flex items-center justify-center">
                <Trash weight="fill" className="w-5 h-5 text-rose-500" />
              </div>
              <h3 id="meso-delete-title" className="font-bold text-slate-800 dark:text-slate-100">Hapus Laporan MESO?</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Laporan MESO untuk pasien <strong>{deleteTarget.patient_name}</strong> akan dihapus permanen.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
