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
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Warning weight="fill" className="w-7 h-7 text-rose-500" />
            Manajemen Recall Obat
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Penanganan penarikan obat dari BPOM / distributor
          </p>
        </div>
        <button
          onClick={() => { setDraft(emptyDraft(profile?.apoteker_name || profile?.full_name || '')); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus weight="bold" className="w-4 h-4" />
          Tambah Recall
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['active','quarantined','reported','resolved'] as RecallStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(prev => prev === s ? 'all' : s)}
            className={`rounded-xl border p-3 text-left transition-all ${filterStatus === s ? 'ring-2 ring-indigo-500 border-indigo-400' : 'border-gray-200 dark:border-zinc-700 hover:border-indigo-300'} bg-white dark:bg-zinc-900`}
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{countByStatus(s)}</div>
            <div className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${STATUS_COLORS[s]}`}>
              {STATUS_LABELS[s]}
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama obat, nomor recall, atau batch..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {records.length === 0 ? 'Belum ada data recall obat' : 'Tidak ada data yang sesuai filter'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(recall => (
            <div
              key={recall.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 cursor-pointer hover:border-indigo-300 transition-colors"
              onClick={() => setSelected(recall)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{recall.medicine_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[recall.status]}`}>
                      {STATUS_LABELS[recall.status]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-3">
                    <span>No. Recall: <b>{recall.recall_number}</b></span>
                    <span>Batch: <b>{recall.batch_numbers}</b></span>
                    <span>Tanggal: {formatDate(recall.recall_date)}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{recall.reason}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {STATUS_FLOW[recall.status] && (
                    <button
                      onClick={() => advanceStatus(recall)}
                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      title={STATUS_NEXT_LABEL[recall.status]}
                    >
                      <ArrowClockwise weight="bold" className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => printRecallReport(recall, profile?.pharmacy_name || 'Apotek')}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    title="Cetak Laporan Recall"
                  >
                    <Printer weight="bold" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(recall)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    title="Hapus"
                  >
                    <Trash weight="bold" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          role="dialog"
          aria-modal
          aria-labelledby="recall-form-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <h2 id="recall-form-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Tambah Recall Obat
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nomor Recall / Pengumuman BPOM <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.recall_number}
                    onChange={e => setDraft(d => ({ ...d, recall_number: e.target.value }))}
                    placeholder="cth: BPOM/PP/20260310/001"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Informasi Diterima <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={draft.recall_date}
                    onChange={e => setDraft(d => ({ ...d, recall_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Obat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.medicine_name}
                    onChange={e => setDraft(d => ({ ...d, medicine_name: e.target.value }))}
                    placeholder="Nama obat yang di-recall"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    No. Batch Terdampak <span className="text-xs text-gray-400">(atau * untuk semua batch)</span>
                  </label>
                  <input
                    type="text"
                    value={draft.batch_numbers}
                    onChange={e => setDraft(d => ({ ...d, batch_numbers: e.target.value }))}
                    placeholder="cth: BT2025001 atau *"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Produsen / PBF
                  </label>
                  <input
                    type="text"
                    value={draft.manufacturer || ''}
                    onChange={e => setDraft(d => ({ ...d, manufacturer: e.target.value }))}
                    placeholder="Nama produsen atau distributor"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stok Ditemukan
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={draft.stock_found}
                      onChange={e => setDraft(d => ({ ...d, stock_found: Number(e.target.value) }))}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                    <input
                      type="text"
                      value={draft.stock_unit || ''}
                      onChange={e => setDraft(d => ({ ...d, stock_unit: e.target.value }))}
                      placeholder="Satuan"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alasan Recall <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={draft.reason}
                  onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))}
                  placeholder="cth: Kontaminasi mikroba, kadar zat aktif tidak sesuai, kemasan rusak, dll."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                />
              </div>

              {/* BPOM notice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Isi Pengumuman BPOM
                </label>
                <textarea
                  rows={3}
                  value={draft.bpom_notice || ''}
                  onChange={e => setDraft(d => ({ ...d, bpom_notice: e.target.value }))}
                  placeholder="Paste isi pengumuman/instruksi dari BPOM di sini..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                />
              </div>

              {/* Action taken */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tindakan yang Diambil
                </label>
                <input
                  type="text"
                  value={draft.action_taken || ''}
                  onChange={e => setDraft(d => ({ ...d, action_taken: e.target.value }))}
                  placeholder="cth: Dikarantina di gudang terpisah, dikembalikan ke PBF, dimusnahkan"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              {/* PIC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Penanggung Jawab (APJ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.pic_name}
                    onChange={e => setDraft(d => ({ ...d, pic_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    value={draft.notes || ''}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
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
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          role="dialog"
          aria-modal
          aria-labelledby="recall-detail-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <h2 id="recall-detail-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Info weight="fill" className="w-5 h-5 text-indigo-600" />
                Detail Recall Obat
              </h2>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">{selected.medicine_name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-gray-500 dark:text-gray-400">No. Recall</div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.recall_number}</div>
                <div className="text-gray-500 dark:text-gray-400">No. Batch</div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.batch_numbers}</div>
                <div className="text-gray-500 dark:text-gray-400">Produsen / PBF</div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.manufacturer || '-'}</div>
                <div className="text-gray-500 dark:text-gray-400">Tanggal Diterima</div>
                <div className="font-medium text-gray-900 dark:text-white">{formatDate(selected.recall_date)}</div>
                <div className="text-gray-500 dark:text-gray-400">Stok Ditemukan</div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.stock_found} {selected.stock_unit || ''}</div>
                <div className="text-gray-500 dark:text-gray-400">Tindakan</div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.action_taken || '-'}</div>
                <div className="text-gray-500 dark:text-gray-400">APJ</div>
                <div className="font-medium text-gray-900 dark:text-white">{selected.pic_name}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Alasan Recall</div>
                <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">{selected.reason}</p>
              </div>

              {selected.bpom_notice && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Isi Pengumuman BPOM</div>
                  <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 whitespace-pre-wrap">{selected.bpom_notice}</p>
                </div>
              )}

              {selected.notes && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Catatan</div>
                  <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">{selected.notes}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => printRecallReport(selected, profile?.pharmacy_name || 'Apotek')}
                className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Printer weight="bold" className="w-4 h-4" />
                Cetak Laporan
              </button>
              {STATUS_FLOW[selected.status] && (
                <button
                  onClick={() => advanceStatus(selected)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  {selected.status === 'quarantined' ? <CheckCircle weight="bold" className="w-4 h-4" /> : <Archive weight="bold" className="w-4 h-4" />}
                  {STATUS_NEXT_LABEL[selected.status]}
                </button>
              )}
              <button
                onClick={() => setSelected(null)}
                className="ml-auto px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
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
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal
          aria-labelledby="recall-delete-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash weight="fill" className="w-6 h-6 text-rose-500" />
            </div>
            <h3 id="recall-delete-title" className="font-semibold text-gray-900 dark:text-white mb-2">Hapus Data Recall?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Yakin hapus recall <b>{deleteTarget.medicine_name}</b>? Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
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
