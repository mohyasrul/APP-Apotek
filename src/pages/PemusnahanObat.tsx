import { useState, useEffect } from 'react';
import {
  Trash, Plus, Printer, X, FloppyDisk,
  ClipboardText, CheckCircle
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { Medicine, DrugDestruction, DrugDestructionItem, DrugDestructionStatus } from '../lib/types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type StatusFilter = 'all' | DrugDestructionStatus;

function StatusBadge({ status }: { status: DrugDestructionStatus }) {
  const map = {
    draft: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400',
    scheduled: 'bg-amber-50 text-amber-700',
    completed: 'bg-emerald-50 text-emerald-700',
  };
  const label = { draft: 'Draft', scheduled: 'Dijadwalkan', completed: 'Selesai' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function generateDestructionNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `BAP/${y}/${m}/${rand}`;
}

export default function PemusnahanObat() {
  const { profile, effectiveUserId } = useAuth();

  const [records, setRecords] = useState<DrugDestruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    destruction_date: new Date().toISOString().split('T')[0],
    penanggung_jawab: profile?.apoteker_name || profile?.full_name || '',
    saksi_1: '',
    saksi_2: '',
    metode: 'dibakar',
    notes: '',
  });
  const [draftItems, setDraftItems] = useState<DrugDestructionItem[]>([{
    medicine_id: '', medicine_name: '', batch_number: '', expiry_date: '', quantity: 0, unit: '', alasan: 'kadaluarsa'
  }]);

  // Medicine search for items
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  // Detail view
  const [selected, setSelected] = useState<DrugDestruction | null>(null);

  // Load records from localStorage (simulated - no real DB table for this yet)
  useEffect(() => {
    if (!effectiveUserId) return;
    const stored = localStorage.getItem(`pemusnahan_${effectiveUserId}`);
    if (stored) {
      try {
        setRecords(JSON.parse(stored));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, [effectiveUserId]);

  // Load medicines for item picker
  useEffect(() => {
    if (!effectiveUserId || !showCreate) return;
    (async () => {
      const { data } = await supabase
        .from('medicines')
        .select('id, name, unit, batch_number, expiry_date, stock, category')
        .eq('user_id', effectiveUserId)
        .order('name');
      setMedicines((data as Medicine[]) || []);
    })();
  }, [effectiveUserId, showCreate]);

  const saveRecords = (updated: DrugDestruction[]) => {
    setRecords(updated);
    if (effectiveUserId) {
      localStorage.setItem(`pemusnahan_${effectiveUserId}`, JSON.stringify(updated));
    }
  };

  const handleSave = () => {
    if (!form.penanggung_jawab.trim()) { toast.error('Penanggung jawab wajib diisi'); return; }
    if (!form.saksi_1.trim()) { toast.error('Saksi 1 wajib diisi'); return; }
    if (!form.saksi_2.trim()) { toast.error('Saksi 2 wajib diisi'); return; }
    const validItems = draftItems.filter(i => i.medicine_name.trim() && i.quantity > 0);
    if (validItems.length === 0) { toast.error('Tambahkan minimal 1 obat'); return; }

    setSaving(true);

    // Check if any narcotic items
    const hasNarcotic = validItems.some(item => {
      const med = medicines.find(m => m.id === item.medicine_id);
      return med?.category === 'narkotika' || med?.category === 'psikotropika';
    });

    const record: DrugDestruction = {
      id: crypto.randomUUID(),
      user_id: effectiveUserId || '',
      destruction_number: generateDestructionNumber(),
      destruction_date: form.destruction_date,
      status: 'draft',
      penanggung_jawab: form.penanggung_jawab,
      saksi_1: form.saksi_1,
      saksi_2: form.saksi_2,
      metode: form.metode,
      items: validItems,
      notes: hasNarcotic
        ? `PERHATIAN: Mengandung narkotika/psikotropika — pemusnahan WAJIB disaksikan petugas BPOM.${form.notes ? ' ' + form.notes : ''}`
        : form.notes,
      created_at: new Date().toISOString(),
    };

    saveRecords([record, ...records]);
    setSaving(false);
    setShowCreate(false);
    setDraftItems([{ medicine_id: '', medicine_name: '', batch_number: '', expiry_date: '', quantity: 0, unit: '', alasan: 'kadaluarsa' }]);
    toast.success('Berita Acara Pemusnahan berhasil dibuat');
  };

  const markCompleted = (id: string) => {
    const updated = records.map(r => r.id === id ? { ...r, status: 'completed' as const } : r);
    saveRecords(updated);
    setSelected(null);
    toast.success('Pemusnahan ditandai selesai');
  };

  const markScheduled = (id: string) => {
    const updated = records.map(r => r.id === id ? { ...r, status: 'scheduled' as const } : r);
    saveRecords(updated);
    setSelected(null);
    toast.success('Pemusnahan dijadwalkan');
  };

  const deleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    saveRecords(updated);
    setSelected(null);
    toast.success('Record dihapus');
  };

  // Print BAP
  const handlePrintBAP = (record: DrugDestruction) => {
    const pharmacyName = escapeHtml(profile?.pharmacy_name || '-');
    const pharmacyAddr = escapeHtml(profile?.pharmacy_address || '-');
    const siaNumber = escapeHtml(profile?.sia_number || '-');

    const rows = record.items.map((item, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(item.medicine_name)}</td>
        <td style="text-align:center">${escapeHtml(item.batch_number || '-')}</td>
        <td style="text-align:center">${escapeHtml(item.expiry_date || '-')}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:center">${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.alasan)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>BAP ${record.destruction_number}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12px; padding: 20mm; }
        h2 { text-align: center; text-decoration: underline; margin-bottom: 4px; }
        h3 { text-align: center; margin-top: 2px; font-weight: normal; }
        p { margin: 6px 0; line-height: 1.6; }
        table.items { width: 100%; border-collapse: collapse; margin: 10px 0; }
        table.items th, table.items td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
        table.items th { background: #f0f0f0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
        .sig-box { text-align: center; width: 30%; }
        .sig-box .line { margin-top: 60px; border-top: 1px solid #000; padding-top: 4px; }
        @media print { body { padding: 15mm; } }
      </style>
    </head><body>
      <h2>BERITA ACARA PEMUSNAHAN OBAT</h2>
      <h3>Nomor: ${escapeHtml(record.destruction_number)}</h3>
      <p>Pada hari ini, tanggal <b>${new Date(record.destruction_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</b>,
      bertempat di <b>${pharmacyName}</b> (${pharmacyAddr}), No. SIA: <b>${siaNumber}</b>,
      telah dilakukan pemusnahan obat-obatan sebagai berikut:</p>
      <table class="items">
        <thead>
          <tr>
            <th>No</th><th>Nama Obat</th><th>No. Batch</th><th>Kadaluarsa</th>
            <th>Jumlah</th><th>Satuan</th><th>Alasan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p><b>Metode pemusnahan:</b> ${escapeHtml(record.metode)}</p>
      ${record.notes ? `<p><b>Catatan:</b> ${escapeHtml(record.notes)}</p>` : ''}
      <p>Demikian Berita Acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
      <div class="signatures">
        <div class="sig-box">
          <p>Penanggung Jawab</p>
          <div class="line">${escapeHtml(record.penanggung_jawab)}</div>
        </div>
        <div class="sig-box">
          <p>Saksi I</p>
          <div class="line">${escapeHtml(record.saksi_1)}</div>
        </div>
        <div class="sig-box">
          <p>Saksi II</p>
          <div class="line">${escapeHtml(record.saksi_2)}</div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 400);
    }
  };

  const filteredRecords = records.filter(r => statusFilter === 'all' || r.status === statusFilter);

  // Add/remove item from draft
  const addItem = () => setDraftItems([...draftItems, { medicine_id: '', medicine_name: '', batch_number: '', expiry_date: '', quantity: 0, unit: '', alasan: 'kadaluarsa' }]);
  const removeItem = (idx: number) => {
    if (draftItems.length <= 1) return;
    setDraftItems(draftItems.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof DrugDestructionItem, value: string | number) => {
    const updated = [...draftItems];
    (updated[idx] as Record<string, unknown>)[field] = value;
    // auto-fill from medicine
    if (field === 'medicine_id' && typeof value === 'string') {
      const med = medicines.find(m => m.id === value);
      if (med) {
        updated[idx].medicine_name = med.name;
        updated[idx].unit = med.unit;
        updated[idx].batch_number = med.batch_number || '';
        updated[idx].expiry_date = med.expiry_date || '';
      }
    }
    setDraftItems(updated);
  };

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1400px] mx-auto w-full pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
            <Trash weight="duotone" className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Pemusnahan Obat</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Berita Acara Pemusnahan (BAP) — PMK 73/2016 & PMK 3/2015</p>
          </div>
        </div>
        <button
          onClick={() => {
            setForm({
              destruction_date: new Date().toISOString().split('T')[0],
              penanggung_jawab: profile?.apoteker_name || profile?.full_name || '',
              saksi_1: '', saksi_2: '', metode: 'dibakar', notes: '',
            });
            setShowCreate(true);
          }}
          className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          <Plus weight="bold" className="w-4 h-4" />
          Buat BAP Baru
        </button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['all', 'draft', 'scheduled', 'completed'] as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              statusFilter === f
                ? 'bg-zinc-800 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'draft' ? 'Draft' : f === 'scheduled' ? 'Dijadwalkan' : 'Selesai'}
          </button>
        ))}
      </div>

      {/* Records List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardText weight="duotone" className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada catatan pemusnahan obat</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredRecords.map(record => (
              <div
                key={record.id}
                onClick={() => setSelected(record)}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-200 text-sm">{record.destruction_number}</span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(record.destruction_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                    &nbsp;• {record.items.length} obat • PJ: {record.penanggung_jawab}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); handlePrintBAP(record); }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Cetak BAP"
                  >
                    <Printer weight="bold" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-200 mb-2">⚠️ Ketentuan Pemusnahan Obat</h4>
        <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
          <li>• Obat rusak, kadaluarsa, atau sisa racikan <b>harus dimusnahkan</b> sesuai prosedur (PMK 73/2016 Pasal 15)</li>
          <li>• BAP ditandatangani Apoteker dan minimal <b>2 saksi</b></li>
          <li>• Untuk <b>narkotika/psikotropika</b>: pemusnahan WAJIB disaksikan petugas BPOM/Dinas Kesehatan (PMK 3/2015)</li>
          <li>• BAP disimpan minimal <b>5 tahun</b></li>
        </ul>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">{selected.destruction_number}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selected.destruction_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <X weight="bold" className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2"><StatusBadge status={selected.status} /></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">PJ:</span> <span className="text-gray-700 dark:text-gray-200 ml-1">{selected.penanggung_jawab}</span></div>
                <div><span className="text-gray-400">Metode:</span> <span className="text-gray-700 dark:text-gray-200 ml-1">{selected.metode}</span></div>
                <div><span className="text-gray-400">Saksi 1:</span> <span className="text-gray-700 dark:text-gray-200 ml-1">{selected.saksi_1}</span></div>
                <div><span className="text-gray-400">Saksi 2:</span> <span className="text-gray-700 dark:text-gray-200 ml-1">{selected.saksi_2}</span></div>
              </div>
              {selected.notes && <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg">{selected.notes}</p>}

              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 pt-2">Daftar Obat ({selected.items.length})</h4>
              <div className="space-y-2">
                {selected.items.map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{item.medicine_name}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} {item.unit} • Batch: {item.batch_number || '-'} • ED: {item.expiry_date || '-'} • {item.alasan}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-zinc-800">
              {selected.status === 'draft' && (
                <>
                  <button onClick={() => markScheduled(selected.id!)} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold">
                    Jadwalkan
                  </button>
                  <button onClick={() => deleteRecord(selected.id!)} className="py-2 px-4 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-sm font-semibold">
                    Hapus
                  </button>
                </>
              )}
              {selected.status === 'scheduled' && (
                <button onClick={() => markCompleted(selected.id!)} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  <CheckCircle weight="bold" className="w-4 h-4" />
                  Tandai Selesai
                </button>
              )}
              <button onClick={() => handlePrintBAP(selected)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Printer weight="bold" className="w-4 h-4" />
                Cetak BAP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Buat Berita Acara Pemusnahan</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <X weight="bold" className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Form fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Tanggal Pemusnahan *</label>
                  <input type="date" value={form.destruction_date} onChange={e => setForm({ ...form, destruction_date: e.target.value })}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Metode *</label>
                  <select value={form.metode} onChange={e => setForm({ ...form, metode: e.target.value })}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="dibakar">Dibakar</option>
                    <option value="diblender">Diblender/Dihancurkan</option>
                    <option value="dilarutkan">Dilarutkan</option>
                    <option value="dikubur">Dikubur</option>
                    <option value="dikembalikan">Dikembalikan ke Distributor</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Apoteker Penanggung Jawab *</label>
                <input type="text" value={form.penanggung_jawab} onChange={e => setForm({ ...form, penanggung_jawab: e.target.value })}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Saksi 1 *</label>
                  <input type="text" value={form.saksi_1} onChange={e => setForm({ ...form, saksi_1: e.target.value })}
                    placeholder="Nama saksi 1" className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Saksi 2 *</label>
                  <input type="text" value={form.saksi_2} onChange={e => setForm({ ...form, saksi_2: e.target.value })}
                    placeholder="Nama saksi 2" className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Daftar Obat yang Dimusnahkan</label>
                  <button onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-600 font-semibold flex items-center gap-1">
                    <Plus weight="bold" className="w-3 h-3" /> Tambah
                  </button>
                </div>
                <div className="space-y-2">
                  {draftItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <select value={item.medicine_id} onChange={e => updateItem(idx, 'medicine_id', e.target.value)}
                          className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-2 py-1.5 text-xs">
                          <option value="">— Pilih obat —</option>
                          {medicines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit}) - stok: {m.stock}</option>)}
                        </select>
                        <input type="number" min={1} value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Math.max(0, Number(e.target.value)))}
                          placeholder="Jml" className="w-20 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-2 py-1.5 text-xs text-center" />
                        <button onClick={() => removeItem(idx)} disabled={draftItems.length === 1} className="text-gray-300 hover:text-red-400 disabled:opacity-30">
                          <Trash weight="bold" className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <select value={item.alasan} onChange={e => updateItem(idx, 'alasan', e.target.value)}
                          className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-2 py-1.5 text-xs">
                          <option value="kadaluarsa">Kadaluarsa</option>
                          <option value="rusak">Rusak</option>
                          <option value="recall">Recall BPOM</option>
                          <option value="sisa_racikan">Sisa Racikan</option>
                          <option value="lainnya">Lainnya</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Catatan</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-zinc-800 shrink-0">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                <FloppyDisk weight="bold" className="w-4 h-4" />
                Simpan BAP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
