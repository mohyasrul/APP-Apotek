import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardText, Plus, MagnifyingGlass, Storefront,
  Trash, X, FloppyDisk, ShoppingCart, Prohibit, Printer, Tag
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { Prescription, PrescriptionItem, PrescriptionScreening } from '../lib/types';
import { printApograph, printEtiketObat, type ApographData, type EtiketItem } from '../lib/receipt';
import { PrescriptionScreeningModal } from '../components/PrescriptionScreeningModal';

// ─── helpers ────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'pending' | 'dispensed' | 'cancelled';

function StatusBadge({ status }: { status: Prescription['status'] }) {
  const map = {
    pending:   'bg-amber-50 text-amber-700',
    dispensed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  } as const;
  const label = { pending: 'Menunggu', dispensed: 'Selesai', cancelled: 'Dibatalkan' } as const;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  );
}

type DraftItem = { medicine_name: string; medicine_id: string | null; signa: string; quantity: number };
const emptyDraft = (): DraftItem => ({ medicine_name: '', medicine_id: null, signa: '', quantity: 1 });

// ─── main component ──────────────────────────────────────────────────────────
export default function Resep() {
  const navigate = useNavigate();
  const { user, profile, effectiveUserId } = useAuth();

  // list state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  // detail modal
  const [selected, setSelected] = useState<Prescription | null>(null);

  // cancel state
  const [isCancelling, setIsCancelling] = useState(false);

  // screening state
  const [showScreening, setShowScreening] = useState(false);
  const [screeningTarget, setScreeningTarget] = useState<Prescription | null>(null);
  const [screenings, setScreenings] = useState<Record<string, PrescriptionScreening>>({});

  // Load screenings from localStorage
  useEffect(() => {
    if (!effectiveUserId) return;
    const stored = localStorage.getItem(`screenings_${effectiveUserId}`);
    if (stored) {
      try { setScreenings(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [effectiveUserId]);

  const handleSaveScreening = (screening: PrescriptionScreening) => {
    const updated = { ...screenings, [screening.prescription_id]: screening };
    setScreenings(updated);
    if (effectiveUserId) {
      localStorage.setItem(`screenings_${effectiveUserId}`, JSON.stringify(updated));
    }
    setShowScreening(false);
    setScreeningTarget(null);
    toast.success(`Skrining resep: ${screening.hasil === 'layak' ? 'Layak dilayani' : screening.hasil === 'perlu_konfirmasi' ? 'Perlu konfirmasi dokter' : 'Tidak layak'}`);
  };

  // create-modal state
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    prescription_number: '',
    patient_name: '',
    patient_age: '',
    doctor_name: '',
    doctor_sip: '',
    prescription_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });
  const [items, setItems] = useState<DraftItem[]>([emptyDraft()]);

  // ── medicine autocomplete ──────────────────────────────────────────────────
  type MedSuggestion = { id: string; name: string; sell_price: number; unit: string; stock: number };
  const [medSuggestions, setMedSuggestions] = useState<{ idx: number; list: MedSuggestion[] } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const searchMedicines = (idx: number, query: string) => {
    clearTimeout(searchTimerRef.current);
    if (query.length < 2) { setMedSuggestions(null); return; }
    searchTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('medicines')
        .select('id, name, sell_price, unit, stock')
        .eq('user_id', effectiveUserId)
        .ilike('name', `%${query}%`)
        .gt('stock', 0)
        .limit(6);
      setMedSuggestions({ idx, list: (data || []) as MedSuggestion[] });
    }, 300);
  };

  const selectMedicineSuggestion = (idx: number, med: MedSuggestion) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, medicine_name: med.name, medicine_id: med.id } : it));
    setMedSuggestions(null);
  };

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchPrescriptions = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, prescription_items(*)')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Gagal memuat resep'); }
    else { setPrescriptions(data as Prescription[]); }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPrescriptions(); }, [user]);

  // ── filter ─────────────────────────────────────────────────────────────────
  const filtered = prescriptions.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.patient_name.toLowerCase().includes(q) &&
          !r.doctor_name.toLowerCase().includes(q) &&
          !r.prescription_number.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: prescriptions.length,
    pending: prescriptions.filter(r => r.status === 'pending').length,
    dispensed: prescriptions.filter(r => r.status === 'dispensed').length,
    cancelled: prescriptions.filter(r => r.status === 'cancelled').length,
  };

  // ── item helpers ───────────────────────────────────────────────────────────
  const updateItem = (idx: number, key: keyof DraftItem, val: string | number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  const removeItem = (idx: number) =>
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  // ── save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    if (!form.prescription_number.trim()) { toast.error('Nomor resep wajib diisi'); return; }
    if (!form.patient_name.trim()) { toast.error('Nama pasien wajib diisi'); return; }
    if (!form.doctor_name.trim()) { toast.error('Nama dokter wajib diisi'); return; }
    if (items.some(it => !it.medicine_name.trim())) { toast.error('Nama obat pada semua item wajib diisi'); return; }

    setSaving(true);
    const { data: resep, error: resepError } = await supabase
      .from('prescriptions')
      .insert({
        user_id: effectiveUserId,
        prescription_number: form.prescription_number.trim(),
        patient_name: form.patient_name.trim(),
        patient_age: form.patient_age ? Number(form.patient_age) : null,
        doctor_name: form.doctor_name.trim(),
        doctor_sip: form.doctor_sip.trim() || null,
        prescription_date: form.prescription_date,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (resepError || !resep) {
      toast.error('Gagal menyimpan resep');
      setSaving(false);
      return;
    }

    const itemRows = items
      .filter(it => it.medicine_name.trim())
      .map(it => ({
        prescription_id: resep.id,
        medicine_name: it.medicine_name.trim(),
        medicine_id: it.medicine_id ?? null,
        signa: it.signa.trim() || null,
        quantity: it.quantity,
        dispensed_quantity: 0,
      }));

    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase.from('prescription_items').insert(itemRows);
      if (itemsError) {
        toast.error('Resep tersimpan tapi item gagal disimpan');
        // still continue — prescription header is already saved
      }
    }

    toast.success('Resep berhasil disimpan');
    setShowCreate(false);
    setForm({ prescription_number: '', patient_name: '', patient_age: '', doctor_name: '', doctor_sip: '', prescription_date: new Date().toISOString().split('T')[0], valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: '' });
    setItems([emptyDraft()]);
    setSaving(false);
    fetchPrescriptions();
  };

  // ── cancel ─────────────────────────────────────────────────────────────────
  const handleTebusKePOS = (resep: Prescription) => {
    if (resep.valid_until && new Date(resep.valid_until) < new Date()) {
      toast.error(`Resep sudah kadaluarsa sejak ${new Date(resep.valid_until).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`);
      return;
    }
    navigate(`/pos?resep_id=${resep.id}`);
  };

  const handleCancel = async (resep: Prescription) => {
    if (!confirm(`Batalkan resep ${resep.prescription_number}?`)) return;
    setIsCancelling(true);
    const { error } = await supabase
      .from('prescriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', resep.id);
    if (error) { toast.error('Gagal membatalkan resep'); }
    else {
      toast.success('Resep dibatalkan');
      setSelected(null);
      fetchPrescriptions();
    }
    setIsCancelling(false);
  };

  const handlePrintApograph = (resep: Prescription) => {
    if (!profile) return;
    const data: ApographData = {
      prescriptionNumber: resep.prescription_number,
      prescriptionDate: new Date(resep.prescription_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      patientName: resep.patient_name,
      patientAge: resep.patient_age,
      doctorName: resep.doctor_name,
      doctorSip: resep.doctor_sip,
      items: resep.prescription_items?.map(i => ({
        medicine_name: i.medicine_name,
        quantity: i.quantity,
        dispensed_quantity: i.dispensed_quantity || 0,
        signa: i.signa || undefined
      })) || [],
      pharmacyName: profile.pharmacy_name || 'KLINIK & APOTEK MEDISIR',
      pharmacyAddress: profile.pharmacy_address || undefined,
      pharmacyPhone: profile.phone || undefined,
      apotekerName: profile.apoteker_name || undefined,
      siaNumber: profile.sia_number || undefined,
      sipaNumber: profile.sipa_number || undefined
    };
    printApograph(data);
  };

  const handlePrintEtiket = (resep: Prescription) => {
    if (!profile) return;
    const items: EtiketItem[] = (resep.prescription_items || []).map(item => ({
      medicineName: item.medicine_name,
      signa: item.signa || 'Sesuai petunjuk dokter',
      quantity: item.dispensed_quantity || item.quantity,
      unit: item.medicines?.unit || 'tablet',
      patientName: resep.patient_name,
      patientAge: resep.patient_age,
      prescriptionDate: resep.prescription_date,
      prescriptionNumber: resep.prescription_number,
      jenis: 'oral' as const,
      pharmacyName: profile.pharmacy_name || 'APOTEK MEDISIR',
      pharmacyAddress: profile.pharmacy_address || undefined,
      pharmacyPhone: profile.phone || undefined,
      apotekerName: profile.apoteker_name || undefined,
    }));
    if (items.length === 0) {
      toast.error('Tidak ada obat dalam resep untuk dicetak etiket');
      return;
    }
    printEtiketObat(items);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="font-sans text-slate-800 dark:text-slate-100 antialiased min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">

      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ClipboardText weight="fill" className="w-7 h-7 text-blue-500" />
              Resep Digital
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{counts.pending} resep menunggu penebusan</p>
          </div>
          {profile?.role === 'owner' && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
            >
              <Plus weight="bold" className="w-4 h-4" /> Buat Resep Baru
            </button>
          )}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-sm w-fit">
            {(['all', 'pending', 'dispensed', 'cancelled'] as StatusFilter[]).map(tab => {
              const label = { all: 'Semua', pending: 'Menunggu', dispensed: 'Selesai', cancelled: 'Dibatalkan' }[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === tab
                      ? 'bg-blue-500 text-white shadow'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {label} <span className="ml-1 opacity-70">{counts[tab]}</span>
                </button>
              );
            })}
          </div>
          <div className="relative max-w-xs w-full">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Cari pasien, dokter, no. resep..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-sm">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardText weight="fill" className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">Belum ada resep</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70">
                  <th className="text-left py-3 px-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">No. Resep</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Pasien</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide hidden md:table-cell">Dokter</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide hidden sm:table-cell">Tgl Resep</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(resep => (
                  <tr
                    key={resep.id}
                    className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 cursor-pointer"
                    onClick={() => setSelected(resep)}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">{resep.prescription_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">
                      {resep.patient_name}
                      {resep.patient_age ? <span className="text-slate-400 dark:text-slate-500 font-normal"> · {resep.patient_age} thn</span> : null}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell">dr. {resep.doctor_name}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      {new Date(resep.prescription_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={resep.status} /></td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      {resep.status === 'pending' && (
                        <button
                          onClick={() => handleTebusKePOS(resep)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto ${
                            resep.valid_until && new Date(resep.valid_until) < new Date()
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          <ShoppingCart weight="bold" className="w-3.5 h-3.5" />
                          {resep.valid_until && new Date(resep.valid_until) < new Date() ? 'Kadaluarsa' : 'Tebus'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Detail Resep</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{selected.prescription_number}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mb-0.5">Pasien</p>
                  <p className="font-semibold">{selected.patient_name}{selected.patient_age ? `, ${selected.patient_age} thn` : ''}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mb-0.5">Dokter</p>
                  <p className="font-semibold">dr. {selected.doctor_name}</p>
                  {selected.doctor_sip && <p className="text-xs text-slate-400 dark:text-slate-500">SIP: {selected.doctor_sip}</p>}
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mb-0.5">Tgl Resep</p>
                  <p className="font-semibold">{new Date(selected.prescription_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mb-0.5">Status</p>
                  <StatusBadge status={selected.status} />
                </div>
                {selected.valid_until && (
                  <div className="col-span-2">
                    <p className="text-slate-400 dark:text-slate-500 text-xs mb-0.5">Berlaku Sampai</p>
                    <p className={`font-semibold text-sm ${new Date(selected.valid_until) < new Date() ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>
                      {new Date(selected.valid_until).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {new Date(selected.valid_until) < new Date() && ' — Kadaluarsa'}
                    </p>
                  </div>
                )}
              </div>
              {selected.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
                  <p className="font-semibold text-xs mb-1">Catatan Dokter</p>
                  {selected.notes}
                </div>
              )}
              {/* items */}
              {selected.prescription_items && selected.prescription_items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Obat yang Diresepkan</p>
                  <div className="space-y-2">
                    {selected.prescription_items.map((item: PrescriptionItem) => (
                      <div key={item.id} className="flex items-start justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                        <div>
                          <p className="font-semibold text-sm">{item.medicine_name}</p>
                          {item.signa && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.signa}</p>}
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-4 shrink-0">{item.quantity}x</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-slate-100 dark:border-slate-800 flex-wrap">
              <div className="w-full flex gap-2 mb-2">
                <button
                  onClick={() => handlePrintApograph(selected)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 py-2.5 rounded-xl text-sm font-semibold border border-emerald-100 dark:border-emerald-800"
                >
                  <Printer weight="bold" className="w-4 h-4" /> Cetak Salinan (Apograph)
                </button>
                <button
                  onClick={() => handlePrintEtiket(selected)}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 py-2.5 rounded-xl text-sm font-semibold border border-violet-100 dark:border-violet-800"
                >
                  <Tag weight="bold" className="w-4 h-4" /> Cetak Etiket
                </button>
                <button
                  onClick={() => { setScreeningTarget(selected); setShowScreening(true); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border ${
                    screenings[selected.id]
                      ? screenings[selected.id].hasil === 'layak'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                        : screenings[selected.id].hasil === 'perlu_konfirmasi'
                          ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                      : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                  }`}
                >
                  <ClipboardText weight="bold" className="w-4 h-4" />
                  {screenings[selected.id] ? 'Skrining ✓' : 'Skrining Resep'}
                </button>
              </div>
              {selected.status === 'pending' && (
                <>
                  <button
                    onClick={() => { handleTebusKePOS(selected); if (!(selected.valid_until && new Date(selected.valid_until) < new Date())) setSelected(null); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold"
                  >
                    <ShoppingCart weight="bold" className="w-4 h-4" /> Tebus ke POS
                  </button>
                  {profile?.role === 'owner' && (
                    <button
                      onClick={() => handleCancel(selected)}
                      disabled={isCancelling}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      <Prohibit weight="bold" className="w-4 h-4" /> Batalkan
                    </button>
                  )}
                </>
              )}
              {selected.status !== 'pending' && (
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Storefront weight="fill" className="w-5 h-5 text-blue-500" /> Buat Resep Baru
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">No. Resep *</label>
                  <input
                    type="text"
                    value={form.prescription_number}
                    onChange={e => setForm(f => ({ ...f, prescription_number: e.target.value }))}
                    placeholder="Misal: R/001/2025"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Pasien *</label>
                  <input
                    type="text"
                    value={form.patient_name}
                    onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))}
                    placeholder="Nama lengkap pasien"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Umur Pasien</label>
                  <input
                    type="number"
                    min={0}
                    value={form.patient_age}
                    onChange={e => setForm(f => ({ ...f, patient_age: e.target.value }))}
                    placeholder="Tahun"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Dokter *</label>
                  <input
                    type="text"
                    value={form.doctor_name}
                    onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))}
                    placeholder="Nama dokter penulis resep"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">No. SIP Dokter</label>
                  <input
                    type="text"
                    value={form.doctor_sip}
                    onChange={e => setForm(f => ({ ...f, doctor_sip: e.target.value }))}
                    placeholder="Opsional"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tanggal Resep</label>
                  <input
                    type="date"
                    value={form.prescription_date}
                    onChange={e => setForm(f => ({ ...f, prescription_date: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Berlaku Sampai</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Default: 30 hari dari tgl resep</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Catatan Dokter</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Instruksi atau catatan khusus dari dokter..."
                    rows={2}
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Items section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Daftar Obat *</p>
                  <button
                    onClick={() => setItems(prev => [...prev, emptyDraft()])}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold"
                  >
                    <Plus weight="bold" className="w-3.5 h-3.5" /> Tambah Obat
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <div className="col-span-5">
                        <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                          Nama Obat *
                          {item.medicine_id && <span className="text-emerald-500 ml-1">✓ terhubung ke stok</span>}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.medicine_name}
                            onChange={e => {
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, medicine_name: e.target.value, medicine_id: null } : it));
                              searchMedicines(idx, e.target.value);
                            }}
                            onBlur={() => setTimeout(() => setMedSuggestions(null), 200)}
                            placeholder="Cari nama obat..."
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${item.medicine_id ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500'}`}
                          />
                          {medSuggestions?.idx === idx && medSuggestions.list.length > 0 && (
                            <div className="absolute z-20 mt-0.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                              {medSuggestions.list.map(med => (
                                <button
                                  key={med.id}
                                  type="button"
                                  onMouseDown={() => selectMedicineSuggestion(idx, med)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 last:border-b-0"
                                >
                                  <span className="font-semibold text-slate-800 dark:text-slate-100">{med.name}</span>
                                  <span className="text-slate-400 dark:text-slate-500 ml-2 shrink-0">Stok: {med.stock} {med.unit}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-5">
                        <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">Aturan Pakai (Signa)</label>
                        <input
                          type="text"
                          value={item.signa}
                          onChange={e => updateItem(idx, 'signa', e.target.value)}
                          placeholder="3×1 sesudah makan"
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">Jml</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-1 flex items-end pb-0.5">
                        <button
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          className="text-slate-300 hover:text-red-400 disabled:opacity-30 mt-4"
                        >
                          <Trash weight="bold" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                <FloppyDisk weight="bold" className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Resep'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Screening Modal ──────────────────────────────────────────────── */}
      {showScreening && screeningTarget && (
        <PrescriptionScreeningModal
          prescriptionId={screeningTarget.id}
          patientName={screeningTarget.patient_name}
          screenerName={profile?.apoteker_name || profile?.full_name || ''}
          existingScreening={screenings[screeningTarget.id] || null}
          onSave={handleSaveScreening}
          onClose={() => { setShowScreening(false); setScreeningTarget(null); }}
        />
      )}
    </div>
  );
}
