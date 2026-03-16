import { useState, useEffect, useCallback } from 'react';
import {
  Queue, Plus, Bell, CheckCircle, X, Clock,
  MagnifyingGlass, ArrowClockwise, User
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type QueueStatus = 'waiting' | 'preparing' | 'ready' | 'taken' | 'cancelled';
type ServiceType = 'resep' | 'racikan' | 'konsultasi' | 'umum';

type QueueEntry = {
  id: string;
  user_id: string;
  queue_date: string;
  queue_number: number;
  patient_name: string;
  patient_phone?: string | null;
  service_type: ServiceType;
  status: QueueStatus;
  notes?: string | null;
  called_at?: string | null;
  ready_at?: string | null;
  taken_at?: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<QueueStatus, string> = {
  waiting:   'Menunggu',
  preparing: 'Diproses',
  ready:     'Siap Diambil',
  taken:     'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_COLORS: Record<QueueStatus, string> = {
  waiting:   'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400',
  preparing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  ready:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  taken:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  cancelled: 'bg-rose-100 text-rose-500 dark:bg-rose-900/40 dark:text-rose-400',
};

const STATUS_FLOW: Record<QueueStatus, QueueStatus | null> = {
  waiting:   'preparing',
  preparing: 'ready',
  ready:     'taken',
  taken:     null,
  cancelled: null,
};

const STATUS_NEXT_LABEL: Record<QueueStatus, string> = {
  waiting:   'Mulai Proses',
  preparing: 'Tandai Siap',
  ready:     'Selesai / Diambil',
  taken:     '',
  cancelled: '',
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  resep:      'Resep',
  racikan:    'Racikan',
  konsultasi: 'Konsultasi',
  umum:       'Umum',
};

const SERVICE_COLORS: Record<ServiceType, string> = {
  resep:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  racikan:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  konsultasi: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  umum:       'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400',
};

function padQueue(n: number) {
  return String(n).padStart(3, '0');
}

function formatTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Antrian() {
  const { effectiveUserId } = useAuth();

  const today = new Date().toISOString().split('T')[0];

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<QueueStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDate, setViewDate] = useState(today);

  // New queue form
  const [showForm, setShowForm] = useState(false);
  const [formPatient, setFormPatient] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formService, setFormService] = useState<ServiceType>('umum');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('queue_date', viewDate)
      .order('queue_number', { ascending: true });
    if (error) {
      toast.error('Gagal memuat data antrian');
    } else {
      setEntries((data as QueueEntry[]) || []);
    }
    setLoading(false);
  }, [effectiveUserId, viewDate]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Close form on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleAddQueue = async () => {
    if (!effectiveUserId) return;
    setSaving(true);

    // Get next queue number for today
    const { data: maxData } = await supabase
      .from('queue_entries')
      .select('queue_number')
      .eq('user_id', effectiveUserId)
      .eq('queue_date', today)
      .order('queue_number', { ascending: false })
      .limit(1);

    const nextNum = ((maxData?.[0]?.queue_number as number) || 0) + 1;

    const { error } = await supabase.from('queue_entries').insert({
      user_id: effectiveUserId,
      queue_date: today,
      queue_number: nextNum,
      patient_name: formPatient.trim() || `Umum-${padQueue(nextNum)}`,
      patient_phone: formPhone.trim() || null,
      service_type: formService,
      status: 'waiting',
      notes: formNotes.trim() || null,
    });

    if (error) {
      toast.error('Gagal menambah antrian');
    } else {
      toast.success(`Nomor antrian ${padQueue(nextNum)} berhasil dibuat`);
      setShowForm(false);
      setFormPatient('');
      setFormPhone('');
      setFormService('umum');
      setFormNotes('');
      if (viewDate === today) fetchEntries();
    }
    setSaving(false);
  };

  const advanceStatus = async (entry: QueueEntry) => {
    const next = STATUS_FLOW[entry.status];
    if (!next) return;
    const update: Partial<QueueEntry> = { status: next };
    if (next === 'preparing') update.called_at = new Date().toISOString();
    if (next === 'ready')     update.ready_at  = new Date().toISOString();
    if (next === 'taken')     update.taken_at  = new Date().toISOString();

    const { error } = await supabase.from('queue_entries').update(update).eq('id', entry.id);
    if (error) {
      toast.error('Gagal memperbarui status');
    } else {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...update } : e));
      if (next === 'ready') {
        toast.success(`Nomor ${padQueue(entry.queue_number)} — ${entry.patient_name} siap diambil!`);
      }
    }
  };

  const cancelQueue = async (entry: QueueEntry) => {
    const { error } = await supabase.from('queue_entries').update({ status: 'cancelled' }).eq('id', entry.id);
    if (error) {
      toast.error('Gagal membatalkan antrian');
    } else {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'cancelled' } : e));
      toast.info(`Antrian ${padQueue(entry.queue_number)} dibatalkan`);
    }
  };

  // Stats for today
  const statsWaiting   = entries.filter(e => e.status === 'waiting').length;
  const statsPreparing = entries.filter(e => e.status === 'preparing').length;
  const statsReady     = entries.filter(e => e.status === 'ready').length;
  const statsDone      = entries.filter(e => e.status === 'taken').length;

  const filtered = entries.filter(e => {
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || e.patient_name.toLowerCase().includes(q)
      || String(e.queue_number).includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex-1 pb-20 lg:pb-0">
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Antrian Pasien
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kelola nomor antrian layanan resep, racikan, dan konsultasi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={viewDate}
              onChange={e => setViewDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all whitespace-nowrap"
            >
              <Plus weight="bold" className="w-4 h-4" />
              Daftar Antrian
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Menunggu',   count: statsWaiting,   color: 'text-gray-900 dark:text-gray-100',      bg: 'bg-white dark:bg-zinc-900', border: 'border-gray-200 dark:border-zinc-700' },
            { label: 'Diproses',   count: statsPreparing, color: 'text-amber-700 dark:text-amber-400',    bg: 'bg-white dark:bg-zinc-900', border: 'border-gray-200 dark:border-zinc-700' },
            { label: 'Siap Ambil', count: statsReady,     color: 'text-indigo-700 dark:text-indigo-400',  bg: 'bg-white dark:bg-zinc-900', border: statsReady > 0 ? 'border-indigo-300 dark:border-indigo-700' : 'border-gray-200 dark:border-zinc-700' },
            { label: 'Selesai',    count: statsDone,      color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-white dark:bg-zinc-900', border: 'border-gray-200 dark:border-zinc-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex gap-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-1 rounded-xl shadow-sm w-fit overflow-x-auto">
            {(['all','waiting','preparing','ready','taken','cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterStatus === s
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {s === 'all' ? 'Semua' : STATUS_LABELS[s as QueueStatus]}
              </button>
            ))}
          </div>
          <div className="relative max-w-xs w-full">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="search"
              placeholder="Cari nama pasien atau nomor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:text-gray-200 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-sm"
            />
          </div>
        </div>

        {/* Queue list */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">Memuat antrian...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Queue weight="fill" className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {entries.length === 0
                  ? `Belum ada antrian ${viewDate === today ? 'hari ini' : `tanggal ${viewDate}`}`
                  : 'Tidak ada data yang sesuai filter'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
              {filtered.map(entry => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-zinc-800/60 transition-colors ${
                    entry.status === 'ready' ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                  }`}
                >
                  {/* Queue number badge */}
                  <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xl ${
                    entry.status === 'ready'     ? 'bg-indigo-600 text-white' :
                    entry.status === 'preparing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                    entry.status === 'taken'     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                    entry.status === 'cancelled' ? 'bg-rose-100 text-rose-400 dark:bg-rose-900/40 line-through' :
                    'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'
                  }`}>
                    {padQueue(entry.queue_number)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.patient_name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${SERVICE_COLORS[entry.service_type]}`}>
                        {SERVICE_LABELS[entry.service_type]}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_COLORS[entry.status]}`}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                    </div>
                    {entry.patient_phone && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">{entry.patient_phone}</div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        Daftar: {formatTime(entry.created_at)}
                      </span>
                      {entry.called_at && <span>Proses: {formatTime(entry.called_at)}</span>}
                      {entry.ready_at  && <span>Siap: {formatTime(entry.ready_at)}</span>}
                    </div>
                    {entry.notes && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{entry.notes}</div>
                    )}
                  </div>

                  {/* Actions */}
                  {(entry.status !== 'taken' && entry.status !== 'cancelled') && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {STATUS_FLOW[entry.status] && (
                        <button
                          onClick={() => advanceStatus(entry)}
                          title={STATUS_NEXT_LABEL[entry.status]}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            entry.status === 'ready'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {entry.status === 'waiting'   && <ArrowClockwise weight="bold" className="w-3.5 h-3.5" />}
                          {entry.status === 'preparing' && <Bell weight="bold" className="w-3.5 h-3.5" />}
                          {entry.status === 'ready'     && <CheckCircle weight="bold" className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{STATUS_NEXT_LABEL[entry.status]}</span>
                        </button>
                      )}
                      <button
                        onClick={() => cancelQueue(entry)}
                        title="Batalkan antrian"
                        className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                      >
                        <X weight="bold" className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Add Queue Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          role="dialog"
          aria-modal
          aria-labelledby="antrian-form-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <h2 id="antrian-form-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Daftarkan Antrian
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X weight="bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Nama Pasien
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    value={formPatient}
                    onChange={e => setFormPatient(e.target.value)}
                    placeholder="Nama pasien (opsional)"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddQueue(); }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  No. Telepon <span className="text-xs font-normal text-gray-400">(opsional)</span>
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="cth: 08123456789"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Jenis Layanan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['umum','resep','racikan','konsultasi'] as ServiceType[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormService(s)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                        formService === s
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      {SERVICE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Catatan <span className="text-xs font-normal text-gray-400">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="cth: resep dr. Andi, tunggu racikan"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleAddQueue}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Queue weight="bold" className="w-4 h-4" />
                {saving ? 'Mendaftarkan...' : 'Daftarkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
