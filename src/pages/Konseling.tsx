import { useState, useEffect } from 'react';
import {
  ChatCircleText, Plus, MagnifyingGlass, X, FloppyDisk,
  Printer, User, Calendar, Pill, Info, Trash
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type KonselingRecord = {
  id: string;
  user_id: string;
  tanggal: string;
  patient_name: string;
  patient_phone?: string | null;
  prescription_number?: string | null;
  medicines: string;          // daftar obat yang dikonseling, comma-separated
  informasi: string;          // informasi yang disampaikan
  catatan?: string | null;    // catatan tambahan
  petugas: string;            // nama apoteker/petugas yang konseling
  created_at: string;
};

type DraftKonseling = Omit<KonselingRecord, 'id' | 'user_id' | 'created_at'>;

const emptyDraft = (): DraftKonseling => ({
  tanggal: new Date().toISOString().split('T')[0],
  patient_name: '',
  patient_phone: '',
  prescription_number: '',
  medicines: '',
  informasi: '',
  catatan: '',
  petugas: '',
});

// Panduan informasi yang biasa disampaikan
const INFORMASI_TEMPLATES = [
  'Cara penggunaan obat yang benar',
  'Dosis dan frekuensi pemberian',
  'Efek samping yang mungkin terjadi',
  'Interaksi obat dengan makanan/minuman',
  'Cara penyimpanan obat yang tepat',
  'Pentingnya kepatuhan minum obat',
  'Tanda-tanda efek samping serius yang perlu diwaspadai',
  'Cara penanganan jika lupa minum obat',
];

export default function Konseling() {
  const { user, profile, effectiveUserId } = useAuth();
  const [records, setRecords] = useState<KonselingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<KonselingRecord | null>(null);
  const [draft, setDraft] = useState<DraftKonseling>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const TABLE_NAME = 'konseling_pio';

  const fetchRecords = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords((data as KonselingRecord[]) || []);
    } catch {
      // Table might not exist yet — show graceful empty state
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveUserId) fetchRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Pre-fill petugas from profile
  useEffect(() => {
    if (profile?.apoteker_name) {
      setDraft(d => ({ ...d, petugas: profile.apoteker_name! }));
    }
  }, [profile]);

  const openNew = () => {
    setDraft({
      ...emptyDraft(),
      petugas: profile?.apoteker_name || '',
    });
    setSelected(null);
    setShowForm(true);
  };

  const openEdit = (rec: KonselingRecord) => {
    setDraft({
      tanggal: rec.tanggal,
      patient_name: rec.patient_name,
      patient_phone: rec.patient_phone || '',
      prescription_number: rec.prescription_number || '',
      medicines: rec.medicines,
      informasi: rec.informasi,
      catatan: rec.catatan || '',
      petugas: rec.petugas,
    });
    setSelected(rec);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!draft.patient_name.trim()) return toast.error('Nama pasien wajib diisi');
    if (!draft.medicines.trim()) return toast.error('Obat yang dikonseling wajib diisi');
    if (!draft.informasi.trim()) return toast.error('Informasi yang disampaikan wajib diisi');
    if (!draft.petugas.trim()) return toast.error('Nama petugas konseling wajib diisi');

    setSaving(true);
    try {
      const payload = {
        user_id: effectiveUserId,
        ...draft,
        patient_phone: draft.patient_phone || null,
        prescription_number: draft.prescription_number || null,
        catatan: draft.catatan || null,
      };

      if (selected) {
        const { error } = await supabase
          .from(TABLE_NAME)
          .update(payload)
          .eq('id', selected.id);
        if (error) throw error;
        toast.success('Catatan konseling diperbarui');
      } else {
        const { error } = await supabase
          .from(TABLE_NAME)
          .insert(payload);
        if (error) throw error;
        toast.success('Catatan konseling disimpan');
      }

      setShowForm(false);
      fetchRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec: KonselingRecord) => {
    if (!confirm(`Hapus catatan konseling untuk ${rec.patient_name}?`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('id', rec.id);
      if (error) throw error;
      toast.success('Catatan dihapus');
      if (selected?.id === rec.id) setSelected(null);
      fetchRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menghapus: ' + msg);
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = (rec: KonselingRecord) => {
    if (!profile) return;
    const safeStr = (s?: string | null) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<html><head><meta charset="UTF-8"/><style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 20mm; }
      h1 { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
      .pharmacy { text-align: center; margin-bottom: 16px; }
      .pharmacy .name { font-size: 16px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      td { padding: 6px 4px; vertical-align: top; }
      td:first-child { width: 180px; font-weight: 500; }
      .section { font-weight: bold; margin-top: 16px; margin-bottom: 6px; border-bottom: 1px solid #666; padding-bottom: 4px; }
      .info-box { border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-top: 8px; white-space: pre-wrap; }
      .signature { margin-top: 60px; text-align: right; }
      .signature-line { display: inline-block; width: 180px; border-bottom: 1px solid #000; }
    </style></head><body>
      <div class="pharmacy">
        <div class="name">${safeStr(profile.pharmacy_name)}</div>
        ${profile.pharmacy_address ? `<div>${safeStr(profile.pharmacy_address)}</div>` : ''}
        ${profile.phone ? `<div>Telp: ${safeStr(profile.phone)}</div>` : ''}
      </div>
      <h1>Catatan Konseling & PIO</h1>
      <table>
        <tr><td>Tanggal</td><td>: ${new Date(rec.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
        <tr><td>Nama Pasien</td><td>: <b>${safeStr(rec.patient_name)}</b></td></tr>
        ${rec.patient_phone ? `<tr><td>Telepon</td><td>: ${safeStr(rec.patient_phone)}</td></tr>` : ''}
        ${rec.prescription_number ? `<tr><td>No. Resep</td><td>: ${safeStr(rec.prescription_number)}</td></tr>` : ''}
        <tr><td>Obat yang Dikonseling</td><td>: ${safeStr(rec.medicines)}</td></tr>
        <tr><td>Petugas Konseling</td><td>: ${safeStr(rec.petugas)}</td></tr>
      </table>
      <div class="section">Informasi yang Disampaikan</div>
      <div class="info-box">${safeStr(rec.informasi)}</div>
      ${rec.catatan ? `<div class="section">Catatan Tambahan</div><div class="info-box">${safeStr(rec.catatan)}</div>` : ''}
      <div class="signature">
        <div>${new Date(rec.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        <br/>
        <div class="signature-line"></div>
        <div style="font-size:11px; margin-top:4px;">${safeStr(rec.petugas)}</div>
        <div style="font-size:10px; color:#555;">Apoteker</div>
      </div>
    </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.contains(iframe) && document.body.removeChild(iframe), 60000);
  };

  const filtered = records.filter(r =>
    r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    r.medicines.toLowerCase().includes(search.toLowerCase()) ||
    r.petugas.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  if (!user) return null;

  return (
    <div className="flex-1 overflow-x-hidden p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ChatCircleText weight="fill" className="w-8 h-8 text-blue-500" />
            Konseling & PIO
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Catatan Pelayanan Informasi Obat dan konseling pasien sesuai PMK 73/2016
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus weight="bold" className="w-4 h-4" />
          Tambah Catatan
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari nama pasien, obat, atau petugas..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 mb-6 flex gap-3">
        <Info weight="fill" className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-semibold">PMK 73/2016 Pasal 6-8:</span> Apotek wajib menyediakan Pelayanan Informasi Obat (PIO) dan
          konseling. Konseling wajib didokumentasikan untuk narkotika, psikotropika, dan obat risiko tinggi.
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <ChatCircleText className="w-14 h-14 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500 mb-1">
            {search ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan konseling'}
          </p>
          <p className="text-sm mb-4">
            {search ? 'Coba kata kunci berbeda' : 'Mulai dokumentasikan konseling pasien Anda'}
          </p>
          {!search && (
            <button onClick={openNew} className="text-blue-500 text-sm font-semibold hover:underline">
              Tambah Catatan Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(rec => (
            <div
              key={rec.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex gap-4 hover:shadow-sm transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <User weight="fill" className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{rec.patient_name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(rec.tanggal)}
                      {rec.prescription_number && (
                        <span className="ml-2 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                          Resep: {rec.prescription_number}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handlePrint(rec)}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                      title="Cetak catatan konseling"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(rec)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FloppyDisk className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rec)}
                      disabled={deleting}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Pill weight="fill" className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate">{rec.medicines}</p>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{rec.informasi}</p>
                <p className="text-xs text-slate-400 mt-1">Petugas: {rec.petugas}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {selected ? 'Edit Catatan Konseling' : 'Catatan Konseling Baru'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Tanggal + Petugas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={draft.tanggal}
                    onChange={e => setDraft(d => ({ ...d, tanggal: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Petugas Konseling <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={draft.petugas}
                    onChange={e => setDraft(d => ({ ...d, petugas: e.target.value }))}
                    placeholder="Nama apoteker"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Pasien */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Pasien <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={draft.patient_name}
                    onChange={e => setDraft(d => ({ ...d, patient_name: e.target.value }))}
                    placeholder="Nama lengkap pasien"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">No. Telepon</label>
                  <input
                    type="tel"
                    value={draft.patient_phone || ''}
                    onChange={e => setDraft(d => ({ ...d, patient_phone: e.target.value }))}
                    placeholder="08xx-xxxx-xxxx"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* No Resep + Obat */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">No. Resep (opsional)</label>
                <input
                  type="text"
                  value={draft.prescription_number || ''}
                  onChange={e => setDraft(d => ({ ...d, prescription_number: e.target.value }))}
                  placeholder="Mis: RX/2026/03/0001"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Obat yang Dikonseling <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={draft.medicines}
                  onChange={e => setDraft(d => ({ ...d, medicines: e.target.value }))}
                  placeholder="Mis: Amoxicillin 500mg, Paracetamol 500mg"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Informasi */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Informasi yang Disampaikan <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {INFORMASI_TEMPLATES.map(tmpl => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => setDraft(d => ({
                        ...d,
                        informasi: d.informasi ? d.informasi + '\n' + tmpl : tmpl
                      }))}
                      className="text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      + {tmpl}
                    </button>
                  ))}
                </div>
                <textarea
                  value={draft.informasi}
                  onChange={e => setDraft(d => ({ ...d, informasi: e.target.value }))}
                  placeholder="Informasi yang disampaikan kepada pasien..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Tambahan</label>
                <textarea
                  value={draft.catatan || ''}
                  onChange={e => setDraft(d => ({ ...d, catatan: e.target.value }))}
                  placeholder="Catatan lain yang relevan (opsional)..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <FloppyDisk weight="bold" className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Catatan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
