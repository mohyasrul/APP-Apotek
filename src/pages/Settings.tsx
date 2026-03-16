import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Storefront, User, Phone, MapPin, FloppyDisk, Image as ImageIcon, Trash, IdentificationCard, Users, UserPlus, Copy, CheckCircle, X, Warning, ClockCounterClockwise, WhatsappLogo, Link, CalendarBlank, Shield, Receipt, Funnel, ArrowsClockwise } from "@phosphor-icons/react";
import type { TeamMember, Invitation } from "../lib/types";
import { getLicenseExpiryStatus } from "../lib/types";

type AuditLogEntry = {
  id: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_name?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  created_at: string;
  users?: { full_name: string };
};

export default function Settings() {
  const { profile, refreshProfile } = useAuth();

  // ── tab ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'profil' | 'tim' | 'log'>('profil');

  // ── profil form ──────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    pharmacy_name: profile?.pharmacy_name || '',
    pharmacy_address: profile?.pharmacy_address || '',
    phone: profile?.phone || '',
    sia_number: profile?.sia_number || '',
    sipa_number: profile?.sipa_number || '',
    apoteker_name: profile?.apoteker_name || '',
    sia_expiry_date: profile?.sia_expiry_date || '',
    sipa_expiry_date: profile?.sipa_expiry_date || '',
    stra_expiry_date: profile?.stra_expiry_date || '',
    receipt_width: (profile?.receipt_width || '58mm') as '58mm' | '80mm' | 'A4',
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null);

  // ── tim state ────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<{ token: string; code: string } | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  // ── audit log state ──────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterAction, setLogFilterAction] = useState<'all' | 'create' | 'update' | 'delete'>('all');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.warning("Ukuran file logo maksimal 2MB");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    try {
      let logoUrl = profile.logo_url;

      // Upload logo if changed
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const filePath = `${profile.id}/logo.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('pharmacy-assets')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          toast.warning("Logo gagal di-upload (storage mungkin belum di-setup), profil tetap disimpan.");
        } else {
          const { data } = supabase.storage
            .from('pharmacy-assets')
            .getPublicUrl(filePath);
          logoUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('users')
        .update({
          full_name: form.full_name,
          pharmacy_name: form.pharmacy_name,
          pharmacy_address: form.pharmacy_address,
          phone: form.phone,
          logo_url: logoUrl,
          sia_number: form.sia_number || null,
          sipa_number: form.sipa_number || null,
          apoteker_name: form.apoteker_name || null,
          sia_expiry_date: form.sia_expiry_date || null,
          sipa_expiry_date: form.sipa_expiry_date || null,
          stra_expiry_date: form.stra_expiry_date || null,
          receipt_width: form.receipt_width || '58mm',
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Pengaturan berhasil disimpan!");
    } catch (error: unknown) {
      toast.error("Gagal menyimpan: " + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setSaving(false);
    }
  };

  // ── Team management handlers ─────────────────────────────────
  const fetchTeam = async () => {
    if (!profile) return;
    setLoadingTeam(true);
    try {
      // Fetch kasir members
      const { data: members, error: mErr } = await supabase
        .from('users')
        .select('id, full_name, pharmacy_name, role, pharmacy_owner_id, created_at')
        .eq('pharmacy_owner_id', profile.id);
      if (mErr) throw mErr;
      setTeamMembers((members as TeamMember[]) || []);

      // Fetch pending invitations
      const { data: invs, error: iErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('owner_id', profile.id)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (iErr) throw iErr;
      setInvitations((invs as Invitation[]) || []);
    } catch (error: unknown) {
      toast.error('Gagal memuat data tim: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'tim') {
      fetchTeam();
    }
    if (activeTab === 'log') {
      fetchAuditLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchAuditLogs = async () => {
    if (!profile) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, users(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setAuditLogs((data as AuditLogEntry[]) || []);
    } catch (err: unknown) {
      toast.error('Gagal memuat audit log: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvite(true);
    try {
      const { data, error } = await supabase.rpc('create_invite_link', {
        p_email: inviteEmail.toLowerCase().trim() || null,
        p_role: 'cashier',
      });
      if (error) throw error;
      const result = data as { token: string; code: string };
      setInviteResult(result);
      setInviteEmail('');
      fetchTeam();
    } catch (error: unknown) {
      toast.error('Gagal membuat undangan: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setSendingInvite(false);
    }
  };


  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const { error } = await supabase.rpc('remove_kasir', {
        p_kasir_id: deactivateTarget.id,
      });
      if (error) throw error;
      toast.success(`${deactivateTarget.full_name} telah dilepas dari tim`);
      setDeactivateTarget(null);
      fetchTeam();
    } catch (error: unknown) {
      toast.error('Gagal menonaktifkan kasir: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setDeactivating(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setRevokingInviteId(invitationId);
    try {
      const { error } = await supabase.rpc('revoke_invitation', {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
      toast.success('Undangan berhasil dibatalkan');
      fetchTeam();
    } catch (error: unknown) {
      toast.error('Gagal membatalkan undangan: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan'));
    } finally {
      setRevokingInviteId(null);
    }
  };

  const settingsTabs = [
    { id: 'profil' as const, label: 'Profil Apotek', icon: Storefront, desc: 'Informasi & lisensi apotek' },
    ...(profile?.role !== 'cashier' ? [
      { id: 'tim' as const, label: 'Tim Kasir', icon: Users, desc: 'Kelola anggota tim' },
      { id: 'log' as const, label: 'Log Aktivitas', icon: ClockCounterClockwise, desc: 'Riwayat perubahan data' },
    ] : []),
  ];

  const filteredLogs = logFilterAction === 'all'
    ? auditLogs
    : auditLogs.filter(l => l.action === logFilterAction);

  const actionConfig = {
    create: { label: 'Tambah', color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
    update: { label: 'Ubah',   color: 'text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30', dot: 'bg-indigo-500' },
    delete: { label: 'Hapus',  color: 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30', dot: 'bg-rose-500' },
  } as const;

  const entityLabel: Record<string, string> = {
    medicine: 'Obat', transaction: 'Transaksi',
    prescription: 'Resep', customer: 'Pelanggan',
    purchase_order: 'Surat Pesanan', supplier: 'Suplier',
    defecta: 'Defecta',
  };

  return (
    <div className="flex-1 pb-20 lg:pb-0">
      <div className="flex flex-col lg:flex-row min-h-full">

        {/* ── Settings Sidebar (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800">
          {/* Sidebar header */}
          <div className="px-5 py-5 border-b border-gray-100 dark:border-zinc-800">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Pengaturan</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Apotek &amp; Akun</p>
          </div>

          {/* Profile mini card */}
          <div className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  : <span>{(form.pharmacy_name || profile?.pharmacy_name || 'A')[0].toUpperCase()}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {form.pharmacy_name || profile?.pharmacy_name || 'Apotek Anda'}
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 capitalize font-medium">{profile?.role === 'owner' ? 'Pemilik' : 'Kasir'}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1 flex-1">
            {settingsTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <tab.icon
                  weight={activeTab === tab.id ? 'fill' : 'bold'}
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}
                />
                <div>
                  <p className={`font-medium leading-none ${activeTab === tab.id ? 'font-semibold' : ''}`}>{tab.label}</p>
                  <p className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-indigo-500 dark:text-indigo-500' : 'text-gray-400 dark:text-gray-500'}`}>{tab.desc}</p>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 p-5 lg:p-8 min-w-0 lg:max-w-3xl">

          {/* Mobile header */}
          <div className="mb-5 lg:hidden">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Pengaturan Apotek</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kelola profil apotek, tim kasir, dan informasi resmi.</p>
          </div>

          {/* Desktop section header */}
          <div className="hidden lg:flex items-center justify-between mb-7">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {settingsTabs.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {activeTab === 'profil' && 'Kelola informasi apotek, lisensi, dan preferensi tampilan.'}
                {activeTab === 'tim' && 'Undang kasir, kelola anggota tim, dan atur izin akses.'}
                {activeTab === 'log' && 'Pantau semua aktivitas perubahan data di apotek Anda.'}
              </p>
            </div>
          </div>

          {/* Mobile tab pills */}
          <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl mb-6 w-fit lg:hidden overflow-x-auto">
            {settingsTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <tab.icon weight={activeTab === tab.id ? 'fill' : 'bold'} className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

        {/* ── TAB: Profil Apotek ── */}
        {activeTab === 'profil' && (
          <form onSubmit={handleSave} className="space-y-5">
          {/* Logo + Quick Info Banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/40 p-5 flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-xl bg-white dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 shadow-sm flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Storefront weight="duotone" className="w-9 h-9 text-indigo-300" />
                )}
              </div>
              <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center justify-center cursor-pointer shadow-sm transition-colors">
                <ImageIcon weight="bold" className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {form.pharmacy_name || 'Nama Apotek Belum Diisi'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {form.pharmacy_address || 'Alamat belum diisi'}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                {form.apoteker_name ? `Apt. ${form.apoteker_name}` : 'Nama apoteker belum diisi'}
              </p>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                  className="text-xs text-rose-500 hover:underline mt-1 flex items-center gap-1"
                >
                  <Trash weight="bold" className="w-3 h-3" /> Hapus logo
                </button>
              )}
            </div>
          </div>

          {/* Informasi Umum */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center">
                <User weight="fill" className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Informasi Umum
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">Nama Pemilik / Apoteker</label>
                <input
                  required
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="Dr. Ahmad Fauzi, S.Farm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">Nama Apotek</label>
                <input
                  required
                  type="text"
                  value={form.pharmacy_name}
                  onChange={(e) => setForm({ ...form, pharmacy_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="Apotek Sehat Selalu"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Alamat Apotek
                </label>
                <input
                  type="text"
                  value={form.pharmacy_address}
                  onChange={(e) => setForm({ ...form, pharmacy_address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="Jl. Kesehatan No. 123, Jakarta"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                  <Phone className="w-3.5 h-3.5" /> Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="628123456789"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Format: 628xxx (tanpa +). Digunakan untuk kirim struk via WA.</p>
              </div>
            </div>
          </div>

          {/* Informasi Resmi / Lisensi */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
                <Shield weight="fill" className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              Lisensi &amp; Informasi Resmi
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Tampil di struk cetak sesuai regulasi PMK 73/2016.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">Nomor SIA</label>
                <input
                  type="text"
                  value={form.sia_number}
                  onChange={(e) => setForm({ ...form, sia_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="503/SIA/XII/2024/001"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">Nama Apoteker Penanggung Jawab</label>
                <input
                  type="text"
                  value={form.apoteker_name}
                  onChange={(e) => setForm({ ...form, apoteker_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="apt. Siti Rahayu, S.Farm."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">Nomor SIPA Apoteker</label>
                <input
                  type="text"
                  value={form.sipa_number}
                  onChange={(e) => setForm({ ...form, sipa_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  placeholder="503/SIPA/XII/2024/001"
                />
              </div>
            </div>
          </div>

          {/* Masa Berlaku Izin */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <div className="w-6 h-6 bg-rose-100 dark:bg-rose-900/40 rounded-lg flex items-center justify-center">
                <CalendarBlank weight="fill" className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              </div>
              Masa Berlaku Izin
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Sistem akan mengingatkan Anda sebelum izin kadaluarsa (H-90, H-30, H-7).</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { key: 'sia_expiry_date' as const, label: 'Kadaluarsa SIA' },
                { key: 'sipa_expiry_date' as const, label: 'Kadaluarsa SIPA' },
                { key: 'stra_expiry_date' as const, label: 'Kadaluarsa STRA' },
              ]).map(({ key, label }) => {
                const expiryInfo = getLicenseExpiryStatus(form[key]);
                return (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">{label}</label>
                    <input
                      type="date"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all"
                    />
                    {form[key] && (
                      <p className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${
                        expiryInfo.status === 'expired' ? 'text-rose-600' :
                        expiryInfo.status === 'critical' ? 'text-amber-600' :
                        expiryInfo.status === 'warning' ? 'text-amber-500' :
                        'text-emerald-600'
                      }`}>
                        {(expiryInfo.status === 'expired' || expiryInfo.status === 'critical') && <Warning className="w-3 h-3 flex-shrink-0" weight="fill" />}
                        {expiryInfo.label}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pengaturan Struk */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                <Receipt weight="fill" className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </div>
              Pengaturan Struk
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">Lebar Kertas Struk</label>
                <select
                  value={form.receipt_width}
                  onChange={e => setForm(f => ({ ...f, receipt_width: e.target.value as '58mm' | '80mm' | 'A4' }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                >
                  <option value="58mm">58mm — Printer Termal Kecil (paling umum)</option>
                  <option value="80mm">80mm — Printer Termal Besar</option>
                  <option value="A4">A4 — Printer Biasa / Inkjet</option>
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Sesuaikan dengan tipe printer yang digunakan.</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 font-mono text-xs text-center border border-dashed border-gray-200 dark:border-zinc-700">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="w-8 h-8 object-cover rounded-lg mx-auto mb-1.5" />
                )}
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{form.pharmacy_name || 'NAMA APOTEK'}</p>
                <p className="text-gray-500 dark:text-gray-400">{form.pharmacy_address || 'Alamat Apotek'}</p>
                <p className="text-gray-500 dark:text-gray-400">Telp: {form.phone || '-'}</p>
                {form.apoteker_name && <p className="text-gray-500 dark:text-gray-400">Apt: {form.apoteker_name}</p>}
                {form.sia_number && <p className="text-gray-500 dark:text-gray-400">SIA: {form.sia_number}</p>}
                <div className="border-t border-dashed border-gray-300 dark:border-zinc-600 mt-2 pt-2">
                  <p className="text-gray-400 italic">... detail transaksi ...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(99,102,241,0.3)] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <FloppyDisk weight="fill" className="w-4 h-4" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
          </form>
        )} {/* end profil tab */}

        {/* ── TAB: Tim Kasir ── */}
        {activeTab === 'tim' && (
          <div className="space-y-5">
            {/* Stats + Action */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                  <Users weight="fill" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{teamMembers.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Kasir Aktif</p>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                  <Link weight="fill" className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{invitations.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Undangan Aktif</p>
                </div>
              </div>
            </div>

            {/* Cara bergabung info */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 flex gap-3">
              <IdentificationCard weight="fill" className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">Cara menambah kasir baru:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                  <li>Klik <strong>Undang Kasir</strong>, masukkan email kasir (opsional)</li>
                  <li>Salin link undangan, kirimkan ke kasir</li>
                  <li>Kasir daftar akun baru, lalu buka link undangan</li>
                </ol>
              </div>
            </div>

            {/* Active team members */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Users weight="fill" className="w-4 h-4 text-indigo-600" />
                  Kasir Aktif
                  {teamMembers.length > 0 && (
                    <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-semibold px-2 py-0.5 rounded-full">{teamMembers.length}</span>
                  )}
                </h3>
                <button
                  onClick={() => { setShowInviteModal(true); setInviteResult(null); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Undang Kasir
                </button>
              </div>

              {loadingTeam ? (
                <div className="text-center py-10 text-gray-400 text-sm">Memuat...</div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <Users className="w-10 h-10 text-gray-200 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">Belum ada kasir terdaftar</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Undang kasir menggunakan tombol di atas.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {teamMembers.map((member) => {
                    const initial = member.full_name?.[0]?.toUpperCase() || '?';
                    const hueColors = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700'];
                    const colorIdx = member.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % hueColors.length;
                    const colorClass = hueColors[colorIdx];
                    return (
                      <div key={member.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${colorClass}`}>
                            {initial}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{member.full_name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              <span className="capitalize bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-xs font-medium mr-1.5">
                                {member.role === 'cashier' ? 'Kasir' : member.role}
                              </span>
                              Bergabung {new Date(member.created_at!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeactivateTarget(member)}
                          className="px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors font-semibold"
                        >
                          Lepas
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    Undangan Tertunda
                    <span className="ml-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">{invitations.length}</span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {inv.email ?? <span className="text-gray-400 italic font-normal">Link terbuka</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Berlaku sampai {new Date(inv.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/join?token=${inv.token}`;
                            navigator.clipboard.writeText(link).then(() => toast.success('Link disalin')).catch(() => toast.error('Gagal menyalin link'));
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Salin
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Halo! Anda diundang bergabung ke tim apotek ${profile?.pharmacy_name}. Klik link berikut untuk bergabung:\n${window.location.origin}/join?token=${inv.token}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <WhatsappLogo className="w-3.5 h-3.5" /> WA
                        </a>
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          disabled={revokingInviteId === inv.id}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Batalkan undangan"
                        >
                          {revokingInviteId === inv.id
                            ? <div className="w-3.5 h-3.5 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                            : <X className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {/* ── TAB: Log Aktivitas ── */}
        {activeTab === 'log' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Menampilkan 100 aktivitas terbaru dari semua pengguna apotek ini.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAuditLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  <ArrowsClockwise className="w-3.5 h-3.5" /> Muat Ulang
                </button>
              </div>
            </div>

            {/* Action filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
              <Funnel weight="bold" className="w-3.5 h-3.5 text-gray-400 ml-1.5 mr-0.5 flex-shrink-0" />
              {(['all', 'create', 'update', 'delete'] as const).map(action => (
                <button
                  key={action}
                  onClick={() => setLogFilterAction(action)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    logFilterAction === action
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {action === 'all' ? 'Semua' : action === 'create' ? 'Tambah' : action === 'update' ? 'Ubah' : 'Hapus'}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
              {loadingLogs ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Memuat log aktivitas...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center">
                  <ClockCounterClockwise className="w-10 h-10 text-gray-200 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada log aktivitas tercatat</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {filteredLogs.map((log) => {
                    const cfg = actionConfig[log.action] ?? { label: log.action, color: 'text-gray-600 bg-gray-100', dot: 'bg-gray-400' };
                    return (
                      <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex-shrink-0 mt-1">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{log.users?.full_name || 'Sistem'}</span>
                            {' '}{cfg.label.toLowerCase()}{' '}
                            <span className="text-gray-500 dark:text-gray-400">{entityLabel[log.entity_type] || log.entity_type}</span>
                            {log.entity_name && (
                              <span className="font-medium text-gray-900 dark:text-gray-100"> &quot;{log.entity_name}&quot;</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredLogs.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-700 text-xs text-gray-400 dark:text-gray-500">
                  Menampilkan {filteredLogs.length} dari {auditLogs.length} aktivitas
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>{/* end flex row */}

      {/* ── Modal: Undang Kasir ── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 id="invite-modal-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Undang Kasir Baru</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Buat link undangan untuk kasir bergabung ke tim</p>
              </div>
              <button onClick={() => { setShowInviteModal(false); setInviteResult(null); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" aria-label="Tutup">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl">
                  <CheckCircle weight="fill" className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">Undangan berhasil dibuat!</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Bagikan link ini kepada kasir. Link berlaku 7 hari.</p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3">
                  <span className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                    {`${window.location.origin}/join?token=${inviteResult.token}`}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join?token=${inviteResult.token}`).then(() => toast.success('Link disalin')).catch(() => toast.error('Gagal menyalin link'));
                    }}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
                    title="Salin link"
                  >
                    <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Halo! Anda diundang bergabung ke tim apotek ${profile?.pharmacy_name}. Klik link berikut untuk bergabung:\n${window.location.origin}/join?token=${inviteResult.token}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <WhatsappLogo className="w-5 h-5" />
                  Kirim via WhatsApp
                </a>
                <details className="text-xs text-gray-400 dark:text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Kode manual (fallback)</summary>
                  <div className="mt-2 flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-lg p-2">
                    <span className="flex-1 font-mono font-bold text-gray-700 dark:text-gray-200 text-base tracking-widest text-center">{inviteResult.code}</span>
                    <button onClick={() => navigator.clipboard.writeText(inviteResult.code).then(() => toast.success('Kode disalin')).catch(() => toast.error('Gagal menyalin kode'))} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors">
                      <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </details>
                <button
                  onClick={() => setInviteResult(null)}
                  className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm rounded-xl transition-colors font-semibold"
                >
                  Undang kasir lain
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Email Kasir <span className="text-gray-400 font-normal">(opsional)</span></label>
                  <input
                    type="email"
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="kasir@email.com"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Kosongkan untuk membuat link terbuka yang bisa dipakai siapa saja.</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {sendingInvite ? 'Membuat...' : 'Buat Undangan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Lepas Kasir ── */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-label="Konfirmasi Lepas Kasir">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Warning weight="fill" className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Lepas Kasir?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <strong className="text-gray-700 dark:text-gray-300">{deactivateTarget.full_name}</strong> akan dilepas dari tim apotek ini dan tidak dapat lagi mengakses aplikasi.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivating}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deactivating ? 'Melepas...' : 'Ya, Lepas'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
