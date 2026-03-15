import { useState, useEffect } from 'react';
import {
  Flask, Plus, MagnifyingGlass, X, FloppyDisk,
  Printer, Trash, Tag, Warning, Info
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { printEtiketObat, type EtiketItem } from '../lib/receipt';
import type { Medicine } from '../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────
type RacikanIngredient = {
  medicine_id: string;
  medicine_name: string;
  qty_per_bungkus: number;  // jumlah per bungkus/kapsul
  unit: string;
};

type RacikanFormula = {
  id: string;
  user_id: string;
  nama_racikan: string;
  jenis: 'puyer' | 'kapsul' | 'krim' | 'salep' | 'sirup' | 'lainnya';
  jumlah_bungkus: number;
  signa: string;
  notes?: string | null;
  biaya_racik: number;
  ingredients: RacikanIngredient[];
  created_at: string;
};

type DraftFormula = Omit<RacikanFormula, 'id' | 'user_id' | 'created_at'>;

const emptyDraft = (): DraftFormula => ({
  nama_racikan: '',
  jenis: 'puyer',
  jumlah_bungkus: 10,
  signa: '',
  notes: '',
  biaya_racik: 0,
  ingredients: [],
});

const JENIS_OPTIONS: { value: RacikanFormula['jenis']; label: string }[] = [
  { value: 'puyer', label: 'Puyer' },
  { value: 'kapsul', label: 'Kapsul' },
  { value: 'krim', label: 'Krim' },
  { value: 'salep', label: 'Salep' },
  { value: 'sirup', label: 'Sirup' },
  { value: 'lainnya', label: 'Lainnya' },
];

const TABLE_NAME = 'racikan_formula';

export default function Racikan() {
  const { user, profile, effectiveUserId } = useAuth();
  const [formulas, setFormulas] = useState<RacikanFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<RacikanFormula | null>(null);
  const [draft, setDraft] = useState<DraftFormula>(emptyDraft());
  const [saving, setSaving] = useState(false);

  // Medicine search for ingredients
  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState<Medicine[]>([]);
  const [searchingMed, setSearchingMed] = useState(false);

  // Etiket modal
  const [showEtiketModal, setShowEtiketModal] = useState(false);
  const [etiketData, setEtiketData] = useState({ patientName: '', jumlah: 10, jenis: 'oral' as EtiketItem['jenis'] });
  const [selectedForEtiket, setSelectedForEtiket] = useState<RacikanFormula | null>(null);

  const fetchFormulas = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFormulas((data as RacikanFormula[]) || []);
    } catch {
      setFormulas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveUserId) fetchFormulas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Search medicines for ingredient addition
  useEffect(() => {
    if (!medSearch.trim() || medSearch.length < 2) {
      setMedResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingMed(true);
      try {
        const { data } = await supabase
          .from('medicines')
          .select('id, name, unit, stock, buy_price, sell_price, category')
          .eq('user_id', effectiveUserId)
          .ilike('name', `%${medSearch}%`)
          .order('name')
          .limit(8);
        setMedResults((data as Medicine[]) || []);
      } catch {
        setMedResults([]);
      } finally {
        setSearchingMed(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [medSearch, effectiveUserId]);

  const openNew = () => {
    setDraft(emptyDraft());
    setSelected(null);
    setMedSearch('');
    setMedResults([]);
    setShowForm(true);
  };

  const openEdit = (formula: RacikanFormula) => {
    setDraft({
      nama_racikan: formula.nama_racikan,
      jenis: formula.jenis,
      jumlah_bungkus: formula.jumlah_bungkus,
      signa: formula.signa,
      notes: formula.notes,
      biaya_racik: formula.biaya_racik,
      ingredients: [...formula.ingredients],
    });
    setSelected(formula);
    setMedSearch('');
    setMedResults([]);
    setShowForm(true);
  };

  const addIngredient = (med: Medicine) => {
    if (draft.ingredients.find(i => i.medicine_id === med.id)) {
      toast.error('Obat ini sudah ada dalam formula');
      return;
    }
    setDraft(d => ({
      ...d,
      ingredients: [
        ...d.ingredients,
        {
          medicine_id: med.id,
          medicine_name: med.name,
          qty_per_bungkus: 1,
          unit: med.unit,
        }
      ]
    }));
    setMedSearch('');
    setMedResults([]);
  };

  const removeIngredient = (medicineId: string) => {
    setDraft(d => ({
      ...d,
      ingredients: d.ingredients.filter(i => i.medicine_id !== medicineId)
    }));
  };

  const updateIngredientQty = (medicineId: string, qty: number) => {
    setDraft(d => ({
      ...d,
      ingredients: d.ingredients.map(i =>
        i.medicine_id === medicineId ? { ...i, qty_per_bungkus: qty } : i
      )
    }));
  };

  const handleSave = async () => {
    if (!draft.nama_racikan.trim()) return toast.error('Nama racikan wajib diisi');
    if (!draft.signa.trim()) return toast.error('Aturan pakai wajib diisi');
    if (draft.ingredients.length === 0) return toast.error('Tambahkan minimal satu bahan');

    setSaving(true);
    try {
      const payload = {
        user_id: effectiveUserId,
        ...draft,
        notes: draft.notes || null,
      };

      if (selected) {
        const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', selected.id);
        if (error) throw error;
        toast.success('Formula racikan diperbarui');
      } else {
        const { error } = await supabase.from(TABLE_NAME).insert(payload);
        if (error) throw error;
        toast.success('Formula racikan disimpan');
      }

      setShowForm(false);
      fetchFormulas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (formula: RacikanFormula) => {
    if (!confirm(`Hapus formula "${formula.nama_racikan}"?`)) return;
    try {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('id', formula.id);
      if (error) throw error;
      toast.success('Formula dihapus');
      fetchFormulas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menghapus: ' + msg);
    }
  };

  const openEtiket = (formula: RacikanFormula) => {
    setSelectedForEtiket(formula);
    setEtiketData({ patientName: '', jumlah: formula.jumlah_bungkus, jenis: ['krim', 'salep'].includes(formula.jenis) ? 'topikal' : 'oral' });
    setShowEtiketModal(true);
  };

  const handlePrintEtiket = () => {
    if (!selectedForEtiket) return;
    if (!etiketData.patientName.trim()) return toast.error('Nama pasien wajib diisi');

    const items: EtiketItem[] = [{
      medicineName: `Racikan ${selectedForEtiket.jenis.charAt(0).toUpperCase() + selectedForEtiket.jenis.slice(1)} – ${selectedForEtiket.nama_racikan}`,
      signa: selectedForEtiket.signa,
      quantity: etiketData.jumlah,
      unit: selectedForEtiket.jenis === 'krim' || selectedForEtiket.jenis === 'salep' ? 'tube' : selectedForEtiket.jenis === 'sirup' ? 'botol' : 'bungkus',
      patientName: etiketData.patientName,
      prescriptionDate: new Date().toISOString().split('T')[0],
      jenis: etiketData.jenis,
      notes: selectedForEtiket.notes || undefined,
      pharmacyName: profile?.pharmacy_name || 'APOTEK MEDISIR',
      pharmacyAddress: profile?.pharmacy_address || undefined,
      pharmacyPhone: profile?.phone || undefined,
      apotekerName: profile?.apoteker_name || undefined,
    }];

    printEtiketObat(items);
    setShowEtiketModal(false);
  };

  const handlePrintFormula = (formula: RacikanFormula) => {
    if (!profile) return;
    const safeStr = (s?: string | null) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const ingrRows = formula.ingredients.map(i =>
      `<tr><td>${safeStr(i.medicine_name)}</td><td style="text-align:center;">${i.qty_per_bungkus}</td><td>${safeStr(i.unit)}</td><td>${i.qty_per_bungkus * formula.jumlah_bungkus} ${safeStr(i.unit)}</td></tr>`
    ).join('');

    const html = `<html><head><meta charset="UTF-8"/><style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 20mm; }
      h1 { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
      .pharmacy { text-align: center; margin-bottom: 16px; }
      .pharmacy .name { font-size: 16px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #f1f5f9; padding: 8px; border: 1px solid #ccc; font-size: 11px; }
      td { padding: 6px 8px; border: 1px solid #ccc; }
      .meta-table td { border: none; padding: 4px 0; }
      .meta-table td:first-child { width: 160px; font-weight: 500; }
    </style></head><body>
      <div class="pharmacy">
        <div class="name">${safeStr(profile.pharmacy_name)}</div>
        ${profile.pharmacy_address ? `<div>${safeStr(profile.pharmacy_address)}</div>` : ''}
      </div>
      <h1>Formula Racikan</h1>
      <table class="meta-table">
        <tr><td>Nama Racikan</td><td>: <b>${safeStr(formula.nama_racikan)}</b></td></tr>
        <tr><td>Jenis</td><td>: ${formula.jenis.charAt(0).toUpperCase() + formula.jenis.slice(1)}</td></tr>
        <tr><td>Jumlah</td><td>: ${formula.jumlah_bungkus} bungkus/kapsul</td></tr>
        <tr><td>Aturan Pakai</td><td>: ${safeStr(formula.signa)}</td></tr>
        ${formula.notes ? `<tr><td>Catatan</td><td>: ${safeStr(formula.notes)}</td></tr>` : ''}
        <tr><td>Tanggal</td><td>: ${today}</td></tr>
      </table>
      <br/>
      <table>
        <thead><tr><th>Nama Bahan</th><th>Qty/Bungkus</th><th>Satuan</th><th>Total</th></tr></thead>
        <tbody>${ingrRows}</tbody>
      </table>
      <br/>
      <p style="font-size:11px; color:#555;">Biaya Racik: <b>Rp ${formula.biaya_racik.toLocaleString('id-ID')}</b></p>
      <p style="margin-top:50px; font-size:10px; color:#888;">Dicetak oleh MediSir — ${today}</p>
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

  const filtered = formulas.filter(f =>
    f.nama_racikan.toLowerCase().includes(search.toLowerCase()) ||
    f.jenis.toLowerCase().includes(search.toLowerCase())
  );

  const totalQty = (formula: RacikanFormula) =>
    formula.ingredients.reduce((s, i) => s + (i.qty_per_bungkus * formula.jumlah_bungkus), 0);

  if (!user) return null;

  return (
    <div className="flex-1 overflow-x-hidden p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Flask weight="fill" className="w-8 h-8 text-violet-500" />
            Racikan & Compounding
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Formula racikan, puyer, kapsul, dan sediaan khusus sesuai PMK 73/2016
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus weight="bold" className="w-4 h-4" />
          Buat Formula Baru
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari nama racikan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-2xl p-4 mb-6 flex gap-3">
        <Info weight="fill" className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
        <div className="text-sm text-violet-700 dark:text-violet-300">
          <span className="font-semibold">PMK 73/2016 Pasal 21-22:</span> Pelayanan sediaan farmasi racikan harus menggunakan
          formula yang terdokumentasi. Cetak etiket obat setelah racikan selesai dibuat.
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat formula...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Flask className="w-14 h-14 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500 mb-1">
            {search ? 'Tidak ada formula yang cocok' : 'Belum ada formula racikan'}
          </p>
          <p className="text-sm mb-4">
            {search ? 'Coba nama yang berbeda' : 'Tambahkan formula racikan pertama Anda'}
          </p>
          {!search && (
            <button onClick={openNew} className="text-violet-500 text-sm font-semibold hover:underline">
              Buat Formula Baru
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(formula => (
            <div
              key={formula.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      {formula.jenis}
                    </span>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{formula.nama_racikan}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formula.signa}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEtiket(formula)}
                    className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
                    title="Cetak Etiket"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePrintFormula(formula)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                    title="Cetak Formula"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(formula)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FloppyDisk className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(formula)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ingredients */}
              <div className="space-y-1 mb-3">
                {formula.ingredients.map(ing => (
                  <div key={ing.medicine_id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
                    <span className="font-medium">{ing.medicine_name}</span>
                    <span className="text-slate-400">{ing.qty_per_bungkus} {ing.unit}/bungkus</span>
                  </div>
                ))}
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 dark:border-slate-800 pt-3">
                <span>{formula.jumlah_bungkus} bungkus · {totalQty(formula).toFixed(0)} satuan total</span>
                {formula.biaya_racik > 0 && (
                  <span className="text-violet-500 font-semibold">
                    +Rp {formula.biaya_racik.toLocaleString('id-ID')} biaya racik
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {selected ? 'Edit Formula Racikan' : 'Formula Racikan Baru'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Name + Jenis */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Racikan <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={draft.nama_racikan}
                    onChange={e => setDraft(d => ({ ...d, nama_racikan: e.target.value }))}
                    placeholder="Mis: Puyer Batuk Anak"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Sediaan</label>
                  <select
                    value={draft.jenis}
                    onChange={e => setDraft(d => ({ ...d, jenis: e.target.value as RacikanFormula['jenis'] }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {JENIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Jumlah + Biaya + Signa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah Bungkus/Kapsul</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.jumlah_bungkus}
                    onChange={e => setDraft(d => ({ ...d, jumlah_bungkus: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Biaya Racik (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.biaya_racik}
                    onChange={e => setDraft(d => ({ ...d, biaya_racik: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Aturan Pakai (Signa) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={draft.signa}
                  onChange={e => setDraft(d => ({ ...d, signa: e.target.value }))}
                  placeholder="Mis: 3 x sehari 1 bungkus sesudah makan"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan</label>
                <textarea
                  value={draft.notes || ''}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Catatan khusus untuk petugas atau pasien..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              {/* Bahan */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  Bahan-Bahan <span className="text-rose-500">*</span>
                  <span className="font-normal ml-1">({draft.ingredients.length} bahan)</span>
                </label>

                {/* Ingredient list */}
                {draft.ingredients.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {draft.ingredients.map(ing => (
                      <div key={ing.medicine_id} className="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl px-3 py-2">
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{ing.medicine_name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min={0.001}
                            step={0.001}
                            value={ing.qty_per_bungkus}
                            onChange={e => updateIngredientQty(ing.medicine_id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <span className="text-xs text-slate-400">{ing.unit}</span>
                          <button
                            onClick={() => removeIngredient(ing.medicine_id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X weight="bold" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Medicine search */}
                <div className="relative">
                  <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                    placeholder="Cari dan tambah bahan obat..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {(medResults.length > 0 || searchingMed) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                      {searchingMed ? (
                        <div className="p-3 text-sm text-slate-400 text-center">Mencari...</div>
                      ) : (
                        medResults.map(med => (
                          <button
                            key={med.id}
                            onClick={() => addIngredient(med)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center justify-between gap-2 transition-colors"
                          >
                            <span className="font-medium text-slate-700 dark:text-slate-200">{med.name}</span>
                            <span className="text-xs text-slate-400">{med.stock} {med.unit}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {draft.ingredients.length > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Warning weight="fill" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Qty di atas adalah per bungkus/kapsul. Total kebutuhan: {draft.ingredients.map(i => `${i.medicine_name} = ${(i.qty_per_bungkus * draft.jumlah_bungkus).toFixed(3)} ${i.unit}`).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

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
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <FloppyDisk weight="bold" className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Formula'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Etiket Modal */}
      {showEtiketModal && selectedForEtiket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Cetak Etiket Racikan</h2>
              <button onClick={() => setShowEtiketModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Pasien <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={etiketData.patientName}
                  onChange={e => setEtiketData(d => ({ ...d, patientName: e.target.value }))}
                  placeholder="Nama pasien"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min={1}
                    value={etiketData.jumlah}
                    onChange={e => setEtiketData(d => ({ ...d, jumlah: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Obat</label>
                  <select
                    value={etiketData.jenis}
                    onChange={e => setEtiketData(d => ({ ...d, jenis: e.target.value as EtiketItem['jenis'] }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="oral">Oral (putih)</option>
                    <option value="topikal">Topikal/Luar (biru)</option>
                    <option value="injeksi">Injeksi (kuning)</option>
                  </select>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{selectedForEtiket.nama_racikan}</span>
                <br />
                <span className="text-xs text-slate-400">{selectedForEtiket.signa}</span>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setShowEtiketModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handlePrintEtiket}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
              >
                <Tag weight="bold" className="w-4 h-4" />
                Cetak Etiket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
