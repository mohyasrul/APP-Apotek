import { useState, useEffect, useCallback } from 'react';
import {
  Warning, Plus, MagnifyingGlass, X, FloppyDisk, Printer,
  CheckCircle, Archive, ArrowClockwise, Info, Trash
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type RecallStatus = 'active' | 'quarantined' | 'reported' | 'resolved';

type DrugRecall = {
  id: string;
  user_id: string;
  recall_number: string;
  medicine_name: string;
  batch_numbers: string;
  manufacturer?: string | null;
  bpom_notice?: string | null;
  recall_date: string;
  reason: string;
  status: RecallStatus;
  stock_found: number;
  stock_unit?: string | null;
  action_taken?: string | null;
  resolved_at?: string | null;
  pic_name: string;
  notes?: string | null;
  created_at: string;
};

type DraftRecall = Omit<DrugRecall, 'id' | 'user_id' | 'created_at' | 'resolved_at'>;

const emptyDraft = (picName: string): DraftRecall => ({
  recall_number: '',
  medicine_name: '',
  batch_numbers: '',
  manufacturer: '',
  bpom_notice: '',
  recall_date: new Date().toISOString().split('T')[0],
  reason: '',
  status: 'active',
  stock_found: 0,
  stock_unit: '',
  action_taken: '',
  pic_name: picName,
  notes: '',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<RecallStatus, string> = {
  active:      'Aktif',
  quarantined: 'Dikarantina',
  reported:    'Dilaporkan',
  resolved:    'Selesai',
};

const STATUS_COLORS: Record<RecallStatus, string> = {
  active:      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  quarantined: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  reported:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

const STATUS_FLOW: Record<RecallStatus, RecallStatus | null> = {
  active:      'quarantined',
  quarantined: 'reported',
  reported:    'resolved',
  resolved:    null,
};

const STATUS_NEXT_LABEL: Record<RecallStatus, string> = {
  active:      'Karantina Obat',
  quarantined: 'Tandai Sudah Dilaporkan',
  reported:    'Tandai Selesai',
  resolved:    '',
};

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Print recall report ──────────────────────────────────────────────────────
function printRecallReport(recall: DrugRecall, pharmacyName: string) {
  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Laporan Recall Obat</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:20mm 20mm 20mm 25mm}
  h1{font-size:16px;text-align:center;margin-bottom:4px}
  h2{font-size:13px;text-align:center;margin-bottom:16px}
  .subtitle{text-align:center;font-size:11px;margin-bottom:16px;color:#555}
  table.info{width:100%;border-collapse:collapse;margin-bottom:16px}
  table.info td{padding:4px 6px;vertical-align:top}
  table.info td:first-child{width:40%;font-weight:bold;padding-right:8px}
  table.info td:first-child::after{content:":"}
  .section-title{font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin:12px 0 8px}
  .notice-box{border:1px solid #ccc;padding:8px;background:#fafafa;min-height:40px;margin-bottom:12px}
  .sign-row{display:flex;gap:40px;margin-top:24px}
  .sign-box{flex:1;text-align:center}
  .sign-box .sign-space{height:50px;border-bottom:1px solid #000;margin:8px 0}
  @media print{body{padding:15mm 15mm 15mm 20mm}}
</style></head><body>
<h1>${escapeHtml(pharmacyName)}</h1>
<h2>LAPORAN PENANGANAN RECALL OBAT</h2>
<p class="subtitle">Sesuai Permenkes & Per-BPOM tentang Penarikan Obat</p>

<div class="section-title">Informasi Recall</div>
<table class="info">
  <tr><td>Nomor Recall</td><td>${escapeHtml(recall.recall_number)}</td></tr>
  <tr><td>Nama Obat</td><td>${escapeHtml(recall.medicine_name)}</td></tr>
  <tr><td>No. Batch Terdampak</td><td>${escapeHtml(recall.batch_numbers)}</td></tr>
  <tr><td>Produsen / PBF</td><td>${escapeHtml(recall.manufacturer || '-')}</td></tr>
  <tr><td>Tanggal Informasi Diterima</td><td>${formatDate(recall.recall_date)}</td></tr>
  <tr><td>Alasan Recall</td><td>${escapeHtml(recall.reason)}</td></tr>
  <tr><td>Status Saat Ini</td><td>${STATUS_LABELS[recall.status]}</td></tr>
</table>

<div class="section-title">Stok Terdampak yang Ditemukan</div>
<table class="info">
  <tr><td>Jumlah Stok Ditemukan</td><td>${recall.stock_found} ${escapeHtml(recall.stock_unit || '')}</td></tr>
  <tr><td>Tindakan yang Diambil</td><td>${escapeHtml(recall.action_taken || '-')}</td></tr>
  ${recall.resolved_at ? `<tr><td>Tanggal Diselesaikan</td><td>${new Date(recall.resolved_at).toLocaleDateString('id-ID')}</td></tr>` : ''}
</table>

${recall.bpom_notice ? `<div class="section-title">Isi Pengumuman BPOM</div><div class="notice-box">${escapeHtml(recall.bpom_notice)}</div>` : ''}

${recall.notes ? `<div class="section-title">Catatan Tambahan</div><div class="notice-box">${escapeHtml(recall.notes)}</div>` : ''}

<div class="sign-row" style="margin-top:32px">
  <div class="sign-box">
    <div>Dibuat Oleh,</div>
    <div class="sign-space"></div>
    <div><strong>${escapeHtml(recall.pic_name)}</strong></div>
    <div>Apoteker Penanggung Jawab</div>
  </div>
  <div class="sign-box">
    <div>Diketahui Oleh,</div>
    <div class="sign-space"></div>
    <div>________________________</div>
    <div>Pimpinan Apotek</div>
  </div>
</div>
<p style="margin-top:20px;font-size:10px;color:#888">Dicetak: ${new Date().toLocaleString('id-ID')}</p>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) { toast.error('Popup diblokir browser'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RecallObat() {
  const { effectiveUserId, profile } = useAuth();

  const [records, setRecords] = useState<DrugRecall[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<RecallStatus | 'all'>('all');

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftRecall>(emptyDraft(profile?.apoteker_name || profile?.full_name || ''));
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<DrugRecall | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DrugRecall | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('drug_recalls')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Gagal memuat data recall');
    } else {
      setRecords((data as DrugRecall[]) || []);
    }
    setLoading(false);
  }, [effectiveUserId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Close form on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowForm(false); setSelected(null); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSave = async () => {
    if (!effectiveUserId) return;
    if (!draft.recall_number.trim()) { toast.error('Nomor recall wajib diisi'); return; }
    if (!draft.medicine_name.trim()) { toast.error('Nama obat wajib diisi'); return; }
    if (!draft.reason.trim()) { toast.error('Alasan recall wajib diisi'); return; }
    if (!draft.pic_name.trim()) { toast.error('Nama PIC wajib diisi'); return; }

    setSaving(true);
    // If user leaves batch_numbers blank, require explicit confirmation it applies to all batches
    const batchNums = draft.batch_numbers.trim();
    if (!batchNums) {
      toast.error('Nomor batch wajib diisi. Gunakan * jika berlaku untuk semua batch.');
      setSaving(false);
      return;
    }
    const payload = {
      ...draft,
      user_id: effectiveUserId,
      stock_found: Number(draft.stock_found) || 0,
      batch_numbers: batchNums,
    };
    const { error } = await supabase.from('drug_recalls').insert(payload);
    if (error) {
      toast.error('Gagal menyimpan data recall');
    } else {
      toast.success('Data recall berhasil disimpan');
      setShowForm(false);
      setDraft(emptyDraft(profile?.apoteker_name || profile?.full_name || ''));
      fetchRecords();
    }
    setSaving(false);
  };

  const advanceStatus = async (recall: DrugRecall) => {
    const next = STATUS_FLOW[recall.status];
    if (!next) return;
    const update: Partial<DrugRecall> = { status: next };
    if (next === 'resolved') update.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('drug_recalls').update(update).eq('id', recall.id);
    if (error) {
      toast.error('Gagal memperbarui status');
    } else {
      toast.success(`Status diperbarui: ${STATUS_LABELS[next]}`);
      setRecords(prev => prev.map(r => r.id === recall.id ? { ...r, ...update } : r));
      if (selected?.id === recall.id) setSelected(prev => prev ? { ...prev, ...update } : prev);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('drug_recalls').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Gagal menghapus data');
    } else {
      toast.success('Data recall dihapus');
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const filtered = records.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || r.medicine_name.toLowerCase().includes(q)
      || r.recall_number.toLowerCase().includes(q)
      || r.batch_numbers.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const countByStatus = (s: RecallStatus) => records.filter(r => r.status === s).length;

  return (
    <div className="flex-1 pb-20 lg:pb-0">
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Manajemen Recall Obat
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Penanganan penarikan obat dari BPOM / distributor
            </p>
          </div>
          <button
            onClick={() => { setDraft(emptyDraft(profile?.apoteker_name || profile?.full_name || '')); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all"
          >
            <Plus weight="bold" className="w-4 h-4" />
            Tambah Recall
          </button>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {(['active','quarantined','reported','resolved'] as RecallStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(prev => prev === s ? 'all' : s)}
              className={`rounded-xl border p-4 text-left transition-all ${filterStatus === s ? 'ring-2 ring-indigo-500 border-indigo-400' : 'border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700'} bg-white dark:bg-zinc-900`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{countByStatus(s)}</div>
              <div className={`text-xs font-medium mt-1.5 px-2 py-0.5 rounded-md inline-block ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}
              </div>
            </button>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex gap-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1 rounded-xl shadow-sm w-fit">
            {(['all', 'active', 'quarantined', 'reported', 'resolved'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === tab
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab === 'all' ? 'Semua' : STATUS_LABELS[tab]}
              </button>
            ))}
          </div>
          <div className="relative max-w-xs w-full">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="search"
              placeholder="Cari nama obat, nomor recall, batch..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:text-gray-200 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">Memuat data recall...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Warning weight="fill" className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {records.length === 0 ? 'Belum ada data recall obat' : 'Tidak ada data yang sesuai filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Nama Obat</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider hidden sm:table-cell">No. Recall / Batch</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider hidden md:table-cell">Tanggal</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(recall => (
                    <tr
                      key={recall.id}
                      className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50/60 dark:hover:bg-zinc-800/60 cursor-pointer"
                      onClick={() => setSelected(recall)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{recall.medicine_name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{recall.reason}</div>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <div className="font-mono text-xs text-gray-600 dark:text-gray-300">{recall.recall_number}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Batch: {recall.batch_numbers}</div>
                      </td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {formatDate(recall.recall_date)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_COLORS[recall.status]}`}>
                          {STATUS_LABELS[recall.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {STATUS_FLOW[recall.status] && (
                            <button
                              onClick={() => advanceStatus(recall)}
                              title={STATUS_NEXT_LABEL[recall.status]}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors"
                            >
                              <ArrowClockwise weight="bold" className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => printRecallReport(recall, profile?.pharmacy_name || 'Apotek')}
                            title="Cetak Laporan Recall"
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Printer weight="bold" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(recall)}
                            title="Hapus"
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                          >
                            <Trash weight="bold" className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          role="dialog"
          aria-modal
          aria-labelledby="recall-form-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h2 id="recall-form-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Tambah Recall Obat
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Nomor Recall / Pengumuman BPOM <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.recall_number}
                    onChange={e => setDraft(d => ({ ...d, recall_number: e.target.value }))}
                    placeholder="cth: BPOM/PP/20260310/001"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Tanggal Informasi Diterima <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={draft.recall_date}
                    onChange={e => setDraft(d => ({ ...d, recall_date: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Nama Obat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.medicine_name}
                    onChange={e => setDraft(d => ({ ...d, medicine_name: e.target.value }))}
                    placeholder="Nama obat yang di-recall"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    No. Batch Terdampak <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.batch_numbers}
                    onChange={e => setDraft(d => ({ ...d, batch_numbers: e.target.value }))}
                    placeholder="cth: BT2025001 atau * untuk semua batch"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Produsen / PBF
                  </label>
                  <input
                    type="text"
                    value={draft.manufacturer || ''}
                    onChange={e => setDraft(d => ({ ...d, manufacturer: e.target.value }))}
                    placeholder="Nama produsen atau distributor"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Stok Ditemukan
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={draft.stock_found}
                      onChange={e => setDraft(d => ({ ...d, stock_found: Number(e.target.value) }))}
                      className="w-24 px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                    <input
                      type="text"
                      value={draft.stock_unit || ''}
                      onChange={e => setDraft(d => ({ ...d, stock_unit: e.target.value }))}
                      placeholder="Satuan"
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Alasan Recall <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={draft.reason}
                  onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))}
                  placeholder="cth: Kontaminasi mikroba, kadar zat aktif tidak sesuai, kemasan rusak, dll."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                />
              </div>

              {/* BPOM notice */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Isi Pengumuman BPOM
                </label>
                <textarea
                  rows={3}
                  value={draft.bpom_notice || ''}
                  onChange={e => setDraft(d => ({ ...d, bpom_notice: e.target.value }))}
                  placeholder="Paste isi pengumuman/instruksi dari BPOM di sini..."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                />
              </div>

              {/* Action taken */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Tindakan yang Diambil
                </label>
                <input
                  type="text"
                  value={draft.action_taken || ''}
                  onChange={e => setDraft(d => ({ ...d, action_taken: e.target.value }))}
                  placeholder="cth: Dikarantina di gudang terpisah, dikembalikan ke PBF, dimusnahkan"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              {/* PIC + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Nama Penanggung Jawab (APJ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.pic_name}
                    onChange={e => setDraft(d => ({ ...d, pic_name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    value={draft.notes || ''}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <FloppyDisk weight="bold" className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          role="dialog"
          aria-modal
          aria-labelledby="recall-detail-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h2 id="recall-detail-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Detail Recall Obat
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{selected.recall_number}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{selected.medicine_name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mb-0.5">No. Batch</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selected.batch_numbers}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mb-0.5">Produsen / PBF</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selected.manufacturer || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mb-0.5">Tanggal Diterima</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(selected.recall_date)}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mb-0.5">Stok Ditemukan</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selected.stock_found} {selected.stock_unit || ''}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mb-0.5">Tindakan</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selected.action_taken || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mb-0.5">APJ</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selected.pic_name}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Alasan Recall</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2.5">{selected.reason}</p>
              </div>

              {selected.bpom_notice && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Isi Pengumuman BPOM</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2.5 whitespace-pre-wrap">{selected.bpom_notice}</p>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Catatan</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2.5">{selected.notes}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => printRecallReport(selected, profile?.pharmacy_name || 'Apotek')}
                className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Printer weight="bold" className="w-4 h-4" />
                Cetak Laporan
              </button>
              {STATUS_FLOW[selected.status] && (
                <button
                  onClick={() => advanceStatus(selected)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {selected.status === 'quarantined' ? <CheckCircle weight="bold" className="w-4 h-4" /> : <Archive weight="bold" className="w-4 h-4" />}
                  {STATUS_NEXT_LABEL[selected.status]}
                </button>
              )}
              <button
                onClick={() => setSelected(null)}
                className="ml-auto px-4 py-2.5 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="recall-delete-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <Warning weight="fill" className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 id="recall-delete-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Hapus Data Recall?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <strong>{deleteTarget.medicine_name}</strong> akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
