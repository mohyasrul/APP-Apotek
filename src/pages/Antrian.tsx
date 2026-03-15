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
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Queue weight="fill" className="w-7 h-7 text-indigo-600" />
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
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Plus weight="bold" className="w-4 h-4" />
            Daftar Antrian
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Menunggu',  count: statsWaiting,   color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-50 dark:bg-zinc-800' },
          { label: 'Diproses',  count: statsPreparing, color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Siap Ambil',count: statsReady,     color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Selesai',   count: statsDone,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-gray-200 dark:border-zinc-700 ${s.bg} p-3`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all','waiting','preparing','ready','taken','cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filterStatus === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300'
            }`}
          >
            {s === 'all' ? 'Semua' : STATUS_LABELS[s as QueueStatus]}
          </button>
        ))}
        <div className="relative ml-auto">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama / nomor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-7 pr-3 py-1.5 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>
      </div>

      {/* Queue list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Memuat antrian...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {entries.length === 0 ? `Belum ada antrian ${viewDate === today ? 'hari ini' : `tanggal ${viewDate}`}` : 'Tidak ada data yang sesuai filter'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div
              key={entry.id}
              className={`bg-white dark:bg-zinc-900 border rounded-xl p-4 flex items-center gap-4 ${
                entry.status === 'ready'
                  ? 'border-indigo-400 dark:border-indigo-600 shadow-sm shadow-indigo-100 dark:shadow-none'
                  : 'border-gray-200 dark:border-zinc-700'
              }`}
            >
              {/* Queue number */}
              <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xl ${
                entry.status === 'ready' ? 'bg-indigo-600 text-white' :
                entry.status === 'preparing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                entry.status === 'taken' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                entry.status === 'cancelled' ? 'bg-rose-100 text-rose-400 dark:bg-rose-900/40 line-through' :
                'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'
              }`}>
                {padQueue(entry.queue_number)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{entry.patient_name}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${SERVICE_COLORS[entry.service_type]}`}>
                    {SERVICE_LABELS[entry.service_type]}
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[entry.status]}`}>
                    {STATUS_LABELS[entry.status]}
                  </span>
                </div>
                {entry.patient_phone && (
                  <div className="text-xs text-gray-400 mt-0.5">{entry.patient_phone}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5 space-x-3">
                  <span><Clock className="inline w-3 h-3 mr-0.5" />Daftar: {formatTime(entry.created_at)}</span>
                  {entry.called_at && <span>Proses: {formatTime(entry.called_at)}</span>}
                  {entry.ready_at && <span>Siap: {formatTime(entry.ready_at)}</span>}
                </div>
                {entry.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{entry.notes}</div>}
              </div>

              {/* Actions */}
              {(entry.status !== 'taken' && entry.status !== 'cancelled') && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {STATUS_FLOW[entry.status] && (
                    <button
                      onClick={() => advanceStatus(entry)}
                      title={STATUS_NEXT_LABEL[entry.status]}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        entry.status === 'ready'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {entry.status === 'waiting' && <ArrowClockwise weight="bold" className="w-3.5 h-3.5" />}
                      {entry.status === 'preparing' && <Bell weight="bold" className="w-3.5 h-3.5" />}
                      {entry.status === 'ready' && <CheckCircle weight="bold" className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{STATUS_NEXT_LABEL[entry.status]}</span>
                    </button>
                  )}
                  <button
                    onClick={() => cancelQueue(entry)}
                    title="Batalkan antrian"
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                  >
                    <X weight="bold" className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Queue Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          role="dialog"
          aria-modal
          aria-labelledby="antrian-form-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <h2 id="antrian-form-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Daftarkan Antrian
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddQueue(); }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  No. Telepon <span className="text-xs text-gray-400">(opsional)</span>
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="cth: 08123456789"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Jenis Layanan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['umum','resep','racikan','konsultasi'] as ServiceType[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormService(s)}
                      className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                        formService === s
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300'
                      }`}
                    >
                      {SERVICE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Catatan <span className="text-xs text-gray-400">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="cth: resep dr. Andi, tunggu racikan"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleAddQueue}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold"
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
