import { useState, useEffect, useCallback } from 'react';
import {
  IdentificationCard, Plus, MagnifyingGlass, X, FloppyDisk, Printer,
  CheckCircle, ArrowClockwise, Trash, Warning, DownloadSimple, CaretDown
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────
type ClaimStatus = 'draft' | 'submitted' | 'verified' | 'rejected';
type ClaimType   = 'prb' | 'faskes1' | 'emergency' | 'other';

interface ClaimItem {
  medicine_name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface BpjsClaim {
  id: string;
  user_id: string;
  claim_number: string;
  claim_date: string;
  claim_month: string;
  patient_name: string;
  bpjs_number: string;
  patient_nik?: string | null;
  diagnosis_code?: string | null;
  diagnosis_name?: string | null;
  doctor_name?: string | null;
  faskes_name?: string | null;
  claim_type: ClaimType;
  items: ClaimItem[];
  total_amount: number;
  status: ClaimStatus;
  submitted_at?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  notes?: string | null;
  created_at: string;
}

type DraftClaim = Omit<BpjsClaim, 'id' | 'user_id' | 'created_at' | 'submitted_at' | 'verified_at'>;

const today = () => new Date().toISOString().split('T')[0];
const monthKey = (date: string) => date.slice(0, 7); // YYYY-MM

const emptyDraft = (): DraftClaim => ({
  claim_number: '',
  claim_date: today(),
  claim_month: monthKey(today()),
  patient_name: '',
  bpjs_number: '',
  patient_nik: '',
  diagnosis_code: '',
  diagnosis_name: '',
  doctor_name: '',
  faskes_name: '',
  claim_type: 'prb',
  items: [{ medicine_name: '', qty: 1, unit: 'tablet', unit_price: 0, total: 0 }],
  total_amount: 0,
  status: 'draft',
  rejection_reason: '',
  notes: '',
});

const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  prb:       'PRB (Program Rujuk Balik)',
  faskes1:   'Faskes Tingkat 1',
  emergency: 'Gawat Darurat',
  other:     'Lainnya',
};

const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft:     'Draft',
  submitted: 'Diklaim',
  verified:  'Lunas',
  rejected:  'Ditolak',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRp = (n: number) =>
  'Rp ' + n.toLocaleString('id-ID', { minimumFractionDigits: 0 });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function StatusBadge({ status }: { status: ClaimStatus }) {
  const cfg: Record<ClaimStatus, string> = {
    draft:     'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
    submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    verified:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    rejected:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', cfg[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function TypeBadge({ type }: { type: ClaimType }) {
  const cfg: Record<ClaimType, string> = {
    prb:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    faskes1:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    emergency: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    other:     'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
  const labels: Record<ClaimType, string> = { prb:'PRB', faskes1:'Faskes 1', emergency:'IGD', other:'Lainnya' };
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', cfg[type])}>
      {labels[type]}
    </span>
  );
}

// ─── Generate claim number ────────────────────────────────────────────────────
function genClaimNumber(date: string, seq: number): string {
  const [y, m] = date.split('-');
  return `BPJS/${y}/${m}/${String(seq).padStart(3, '0')}`;
}

// ─── Print helpers ─────────────────────────────────────────────────────────────
function printClaim(claim: BpjsClaim, pharmacyName: string, apotekerName: string): void {
  const esc = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const rows = claim.items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(it.medicine_name)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td>${esc(it.unit)}</td>
      <td style="text-align:right">${fmtRp(it.unit_price)}</td>
      <td style="text-align:right">${fmtRp(it.total)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Klaim BPJS ${esc(claim.claim_number)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:15mm 12mm}
    h2{font-size:14px;font-weight:bold}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
    .pharmacy{font-size:16px;font-weight:bold}
    .pharmacy-sub{font-size:10px;color:#555}
    .title-block{text-align:right}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
    .field label{font-weight:bold;font-size:10px;color:#666;display:block;margin-bottom:2px}
    .field p{font-size:11px;border-bottom:1px solid #bbb;min-height:18px;padding-bottom:2px}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th,td{border:1px solid #bbb;padding:4px 6px;font-size:10px}
    th{background:#f5f5f5;font-weight:bold;text-align:left}
    .total-row td{font-weight:bold;border-top:2px solid #000}
    .sigs{display:flex;justify-content:space-between;margin-top:40px}
    .sig{text-align:center;width:45%}
    .sig .role{font-size:10px;font-weight:bold;margin-bottom:50px}
    .sig .line{border-top:1px solid #000;padding-top:4px;font-size:10px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:bold;border:1px solid}
    @media print{body{padding:12mm 10mm}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="pharmacy">${esc(pharmacyName)}</div>
      <div class="pharmacy-sub">Apotek Mitra BPJS Kesehatan</div>
    </div>
    <div class="title-block">
      <h2>LEMBAR KLAIM BPJS</h2>
      <div style="font-size:11px;margin-top:4px">No: <b>${esc(claim.claim_number)}</b></div>
      <div style="font-size:11px">Tanggal: ${fmtDate(claim.claim_date)}</div>
      <div style="margin-top:4px"><span class="badge">${esc(CLAIM_TYPE_LABEL[claim.claim_type])}</span></div>
    </div>
  </div>
  <div class="grid2">
    <div>
      <div class="field"><label>NAMA PASIEN</label><p>${esc(claim.patient_name)}</p></div>
      <div class="field" style="margin-top:8px"><label>NO. KARTU BPJS</label><p>${esc(claim.bpjs_number)}</p></div>
      ${claim.patient_nik ? `<div class="field" style="margin-top:8px"><label>NIK</label><p>${esc(claim.patient_nik)}</p></div>` : ''}
    </div>
    <div>
      <div class="field"><label>DIAGNOSA</label><p>${esc(claim.diagnosis_code ? claim.diagnosis_code + ' – ' : '')}${esc(claim.diagnosis_name)}</p></div>
      <div class="field" style="margin-top:8px"><label>DOKTER</label><p>${esc(claim.doctor_name)}</p></div>
      <div class="field" style="margin-top:8px"><label>FASKES PERUJUK</label><p>${esc(claim.faskes_name)}</p></div>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:30px">No</th><th>Nama Obat / Item</th><th style="text-align:right">Jumlah</th><th>Satuan</th><th style="text-align:right">Harga Satuan</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td colspan="5" style="text-align:right;font-weight:bold">TOTAL KLAIM</td><td style="text-align:right;font-weight:bold">${fmtRp(claim.total_amount)}</td></tr></tfoot>
  </table>
  ${claim.notes ? `<p style="font-size:10px;margin-top:8px;color:#555">Catatan: ${esc(claim.notes)}</p>` : ''}
  <div class="sigs">
    <div class="sig"><div class="role">Petugas Apotek</div><div class="line">(....................)</div></div>
    <div class="sig"><div class="role">Apoteker Penanggung Jawab</div><div class="line">${esc(apotekerName)}</div></div>
  </div>
  <p style="font-size:9px;color:#888;margin-top:12px;border-top:1px solid #ddd;padding-top:6px">Dokumen ini dicetak oleh sistem MediSir. Klaim BPJS dapat diajukan melalui aplikasi PCare/Vedika BPJS Kesehatan.</p>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=820,height=700');
  if (!w) { toast.error('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ─── Export CSV monthly recap ─────────────────────────────────────────────────
function exportMonthlyCSV(claims: BpjsClaim[], month: string) {
  const rows = [
    ['No. Klaim','Tanggal','Pasien','No. BPJS','NIK','Jenis','Diagnosa','Dokter','Faskes','Total','Status'],
    ...claims.map(c => [
      c.claim_number, c.claim_date, c.patient_name, c.bpjs_number,
      c.patient_nik ?? '', CLAIM_TYPE_LABEL[c.claim_type],
      (c.diagnosis_code ? c.diagnosis_code + ' – ' : '') + (c.diagnosis_name ?? ''),
      c.doctor_name ?? '', c.faskes_name ?? '',
      c.total_amount.toFixed(2), STATUS_LABEL[c.status],
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Rekap_BPJS_${month}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Rekap BPJS ${month} berhasil diunduh`);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BpjsKlaim() {
  const { profile, effectiveUserId } = useAuth();

  const [claims, setClaims]       = useState<BpjsClaim[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<ClaimStatus | 'all'>('all');
  const [filterMonth, setFilterMonth]   = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [draft, setDraft]         = useState<DraftClaim>(emptyDraft());
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BpjsClaim | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BpjsClaim | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchClaims = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    let q = supabase.from('bpjs_claims').select('*').eq('user_id', effectiveUserId).order('claim_date', { ascending: false });
    if (filterMonth) q = q.eq('claim_month', filterMonth);
    const { data, error } = await q;
    if (error) toast.error('Gagal memuat data klaim BPJS');
    else setClaims((data ?? []) as BpjsClaim[]);
    setLoading(false);
  }, [effectiveUserId, filterMonth]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:     claims.length,
    draft:     claims.filter(c => c.status === 'draft').length,
    submitted: claims.filter(c => c.status === 'submitted').length,
    verified:  claims.filter(c => c.status === 'verified').length,
    rejected:  claims.filter(c => c.status === 'rejected').length,
    totalRp:   claims.filter(c => c.status !== 'rejected').reduce((s, c) => s + c.total_amount, 0),
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = claims.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.patient_name.toLowerCase().includes(q) ||
             c.bpjs_number.toLowerCase().includes(q) ||
             c.claim_number.toLowerCase().includes(q) ||
             (c.diagnosis_name ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  // ── Recalculate items total ────────────────────────────────────────────────
  const recalcTotal = (items: ClaimItem[]) =>
    items.reduce((s, it) => s + it.total, 0);

  // ── Open form ──────────────────────────────────────────────────────────────
  const openNew = async () => {
    // Generate sequence number for this month
    const d = emptyDraft();
    const { count } = await supabase
      .from('bpjs_claims')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId!)
      .eq('claim_month', monthKey(d.claim_date));
    const seq = (count ?? 0) + 1;
    d.claim_number = genClaimNumber(d.claim_date, seq);
    setDraft(d);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (c: BpjsClaim) => {
    const { id, user_id, created_at, submitted_at, verified_at, ...rest } = c;
    void id; void user_id; void created_at; void submitted_at; void verified_at;
    setDraft({ ...rest });
    setEditId(c.id);
    setShowForm(true);
  };

  // ── Item helpers ───────────────────────────────────────────────────────────
  const updateItem = (idx: number, field: keyof ClaimItem, value: string | number) => {
    setDraft(prev => {
      const items = prev.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };
        if (field === 'qty' || field === 'unit_price') {
          updated.total = Number(updated.qty) * Number(updated.unit_price);
        }
        if (field === 'total') {
          updated.total = Number(value);
        }
        return updated;
      });
      return { ...prev, items, total_amount: recalcTotal(items) };
    });
  };

  const addItem = () => setDraft(prev => ({
    ...prev,
    items: [...prev.items, { medicine_name: '', qty: 1, unit: 'tablet', unit_price: 0, total: 0 }],
  }));

  const removeItem = (idx: number) => setDraft(prev => {
    const items = prev.items.filter((_, i) => i !== idx);
    return { ...prev, items, total_amount: recalcTotal(items) };
  });

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft.patient_name.trim()) { toast.error('Nama pasien wajib diisi'); return; }
    if (!draft.bpjs_number.trim())  { toast.error('Nomor kartu BPJS wajib diisi'); return; }
    if (draft.items.length === 0)   { toast.error('Tambahkan minimal 1 item obat/layanan'); return; }
    if (draft.items.some(it => !it.medicine_name.trim())) {
      toast.error('Nama item obat wajib diisi pada semua baris'); return;
    }

    setSaving(true);
    const payload = {
      ...draft,
      user_id: effectiveUserId,
      claim_month: monthKey(draft.claim_date),
      total_amount: recalcTotal(draft.items),
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('bpjs_claims').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('bpjs_claims').insert(payload));
    }

    if (error) {
      toast.error('Gagal menyimpan klaim');
    } else {
      toast.success(editId ? 'Klaim berhasil diperbarui' : 'Klaim baru berhasil ditambahkan');
      setShowForm(false);
      fetchClaims();
    }
    setSaving(false);
  };

  // ── Advance status ─────────────────────────────────────────────────────────
  const advanceStatus = async (c: BpjsClaim) => {
    const next: Record<ClaimStatus, ClaimStatus | null> = {
      draft: 'submitted', submitted: 'verified', verified: null, rejected: null,
    };
    const nextStatus = next[c.status];
    if (!nextStatus) return;

    const patch: Partial<BpjsClaim> & Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'submitted') patch.submitted_at = new Date().toISOString();
    if (nextStatus === 'verified')  patch.verified_at  = new Date().toISOString();

    const { error } = await supabase.from('bpjs_claims').update(patch).eq('id', c.id);
    if (error) toast.error('Gagal memperbarui status');
    else { toast.success('Status diperbarui'); fetchClaims(); }
  };

  const rejectClaim = async (c: BpjsClaim) => {
    setRejectTarget(c);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const { error } = await supabase.from('bpjs_claims').update({
      status: 'rejected', rejection_reason: rejectReason,
    }).eq('id', rejectTarget.id);
    if (error) toast.error('Gagal memperbarui status');
    else { toast.success('Klaim ditandai ditolak'); fetchClaims(); }
    setRejectTarget(null);
  };

  const deleteClaim = async (id: string) => {
    const claim = claims.find(c => c.id === id);
    if (claim) setDeleteTarget(claim);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('bpjs_claims').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Gagal menghapus klaim');
    else { toast.success('Klaim dihapus'); fetchClaims(); }
    setDeleteTarget(null);
  };

  const advanceLabel: Record<ClaimStatus, string | null> = {
    draft: 'Ajukan Klaim', submitted: 'Tandai Lunas', verified: null, rejected: null,
  };

  // ─── Months dropdown for filter ────────────────────────────────────────────
  const availableMonths = Array.from(new Set(claims.map(c => c.claim_month))).sort().reverse();

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <IdentificationCard weight="duotone" className="w-6 h-6 text-indigo-600" />
            Klaim BPJS
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
            Manajemen klaim pasien BPJS — PRB, Faskes 1, dan Gawat Darurat
          </p>
        </div>
        <div className="flex gap-2">
          {filterMonth && filtered.length > 0 && (
            <button
              onClick={() => exportMonthlyCSV(filtered, filterMonth)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <DownloadSimple className="w-4 h-4" />
              Ekspor CSV
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Klaim
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Klaim',  value: stats.total,     color: 'text-gray-700 dark:text-zinc-300' },
          { label: 'Draft',        value: stats.draft,     color: 'text-gray-500 dark:text-zinc-400' },
          { label: 'Diklaim',      value: stats.submitted, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Lunas',        value: stats.verified,  color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Ditolak',      value: stats.rejected,  color: 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
            <div className={cn('text-2xl font-semibold', s.color)}>{s.value}</div>
            <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Total nilai klaim */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
        <IdentificationCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        <div>
          <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            Total Nilai Klaim (non-ditolak):
          </span>
          <span className="ml-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            {fmtRp(stats.totalRp)}
          </span>
          {filterMonth && <span className="ml-2 text-xs text-indigo-500">bulan {filterMonth}</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama pasien, no. BPJS, no. klaim..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as ClaimStatus | 'all')}
          className="text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Diklaim</option>
          <option value="verified">Lunas</option>
          <option value="rejected">Ditolak</option>
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Semua Bulan</option>
          {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400"><ArrowClockwise className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500">
          <IdentificationCard className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {claims.length === 0
              ? 'Belum ada klaim BPJS. Klik "Tambah Klaim" untuk memulai.'
              : 'Tidak ada klaim yang cocok dengan filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div
              key={c.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
            >
              {/* Row header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.patient_name}</span>
                    <StatusBadge status={c.status} />
                    <TypeBadge type={c.claim_type} />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1 flex flex-wrap gap-3">
                    <span>No. BPJS: <b>{c.bpjs_number}</b></span>
                    <span>Klaim: {c.claim_number}</span>
                    <span>{fmtDate(c.claim_date)}</span>
                    {c.diagnosis_name && <span>Diagnosa: {c.diagnosis_name}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{fmtRp(c.total_amount)}</div>
                  <div className="text-xs text-gray-400">{c.items.length} item</div>
                </div>
                <CaretDown className={cn('w-4 h-4 text-gray-400 transition-transform', expanded === c.id && 'rotate-180')} />
              </div>

              {/* Expanded detail */}
              {expanded === c.id && (
                <div className="border-t border-gray-100 dark:border-zinc-800 p-4 bg-gray-50 dark:bg-zinc-950/50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-4">
                    {c.patient_nik && <div><span className="text-gray-500">NIK:</span> <span className="font-medium">{c.patient_nik}</span></div>}
                    {c.doctor_name && <div><span className="text-gray-500">Dokter:</span> <span className="font-medium">{c.doctor_name}</span></div>}
                    {c.faskes_name && <div><span className="text-gray-500">Faskes:</span> <span className="font-medium">{c.faskes_name}</span></div>}
                    {c.diagnosis_code && <div><span className="text-gray-500">Kode ICD:</span> <span className="font-medium">{c.diagnosis_code}</span></div>}
                    {c.submitted_at && <div><span className="text-gray-500">Diklaim:</span> <span className="font-medium">{fmtDate(c.submitted_at)}</span></div>}
                    {c.verified_at && <div><span className="text-gray-500">Lunas:</span> <span className="font-medium">{fmtDate(c.verified_at)}</span></div>}
                    {c.rejection_reason && <div className="col-span-full"><span className="text-red-500">Alasan tolak:</span> <span className="font-medium">{c.rejection_reason}</span></div>}
                    {c.notes && <div className="col-span-full"><span className="text-gray-500">Catatan:</span> <span className="font-medium">{c.notes}</span></div>}
                  </div>

                  {/* Items table */}
                  <table className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden mb-4">
                    <thead className="bg-gray-100 dark:bg-zinc-800">
                      <tr>
                        <th className="text-left px-3 py-2">Nama Obat / Item</th>
                        <th className="text-right px-3 py-2">Jumlah</th>
                        <th className="px-3 py-2">Satuan</th>
                        <th className="text-right px-3 py-2">Harga</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.items.map((it, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-3 py-2">{it.medicine_name}</td>
                          <td className="px-3 py-2 text-right">{it.qty}</td>
                          <td className="px-3 py-2 text-center">{it.unit}</td>
                          <td className="px-3 py-2 text-right">{fmtRp(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmtRp(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900">
                        <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtRp(c.total_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => printClaim(c, profile?.pharmacy_name ?? '', profile?.apoteker_name ?? '')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak
                    </button>

                    {c.status === 'draft' && (
                      <button
                        onClick={() => openEdit(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        Edit
                      </button>
                    )}

                    {advanceLabel[c.status] && (
                      <button
                        onClick={() => advanceStatus(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {advanceLabel[c.status]}
                      </button>
                    )}

                    {(c.status === 'draft' || c.status === 'submitted') && (
                      <button
                        onClick={() => rejectClaim(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Warning className="w-3.5 h-3.5" /> Tolak
                      </button>
                    )}

                    {c.status === 'draft' && (
                      <button
                        onClick={() => deleteClaim(c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                      >
                        <Trash className="w-3.5 h-3.5" /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Form Modal ─────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="bpjs-form-title">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl my-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Form header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
              <h2 id="bpjs-form-title" className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <IdentificationCard className="w-5 h-5 text-indigo-600" />
                {editId ? 'Edit Klaim BPJS' : 'Tambah Klaim BPJS Baru'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Tutup form"
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Claim number + date + type row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">No. Klaim</label>
                  <input
                    value={draft.claim_number}
                    onChange={e => setDraft(p => ({ ...p, claim_number: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Tanggal Klaim</label>
                  <input
                    type="date"
                    value={draft.claim_date}
                    onChange={e => setDraft(p => ({ ...p, claim_date: e.target.value, claim_month: monthKey(e.target.value) }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Jenis Klaim</label>
                  <select
                    value={draft.claim_type}
                    onChange={e => setDraft(p => ({ ...p, claim_type: e.target.value as ClaimType }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    <option value="prb">PRB — Program Rujuk Balik</option>
                    <option value="faskes1">Faskes Tingkat 1</option>
                    <option value="emergency">Gawat Darurat</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Patient info */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Data Pasien</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'patient_name', label: 'Nama Pasien *', placeholder: 'Budi Santoso', required: true },
                    { key: 'bpjs_number',  label: 'No. Kartu BPJS *', placeholder: '0001234567890', required: true },
                    { key: 'patient_nik',  label: 'NIK (opsional)', placeholder: '3171...' },
                  ].map(f => (
                    <div key={f.key} className={f.key === 'patient_name' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">{f.label}</label>
                      <input
                        value={(draft[f.key as keyof DraftClaim] as string) ?? ''}
                        onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Medical info */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Info Medis</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'diagnosis_code', label: 'Kode ICD-10', placeholder: 'J06.9' },
                    { key: 'diagnosis_name', label: 'Nama Diagnosa', placeholder: 'ISPA' },
                    { key: 'doctor_name',    label: 'Nama Dokter', placeholder: 'dr. Ahmad' },
                    { key: 'faskes_name',    label: 'Faskes Perujuk', placeholder: 'Puskesmas Maju' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">{f.label}</label>
                      <input
                        value={(draft[f.key as keyof DraftClaim] as string) ?? ''}
                        onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Obat / Item</h3>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Item
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        value={it.medicine_name}
                        onChange={e => updateItem(idx, 'medicine_name', e.target.value)}
                        placeholder="Nama obat / item"
                        className="col-span-4 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                        className="col-span-2 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        placeholder="Qty"
                      />
                      <input
                        value={it.unit}
                        onChange={e => updateItem(idx, 'unit', e.target.value)}
                        placeholder="Sat."
                        className="col-span-2 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                      <input
                        type="number"
                        min={0}
                        value={it.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                        className="col-span-3 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        placeholder="Harga/sat."
                      />
                      {draft.items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          aria-label="Hapus item"
                          className="col-span-1 flex justify-center p-1 text-red-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Total: {fmtRp(recalcTotal(draft.items))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Catatan (opsional)</label>
                <textarea
                  rows={2}
                  value={draft.notes ?? ''}
                  onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Catatan tambahan..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                />
              </div>
            </div>

            {/* Form footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-zinc-800">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60"
              >
                <FloppyDisk className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Klaim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 id="del-title" className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Hapus Klaim?</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-5">
              Klaim <b>{deleteTarget.claim_number}</b> atas nama <b>{deleteTarget.patient_name}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Confirmation Modal ─────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rej-title">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 id="rej-title" className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Tolak Klaim?</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
              Klaim <b>{rejectTarget.claim_number}</b> akan ditandai sebagai ditolak.
            </p>
            <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Alasan penolakan (opsional)</label>
            <input
              type="text"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="mis. Tidak sesuai formularium..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 mb-5"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Tolak Klaim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
