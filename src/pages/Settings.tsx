import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Storefront, User, Phone, MapPin, FloppyDisk, Image as ImageIcon, Trash, IdentificationCard, Users, UserPlus, Copy, CheckCircle, X, Warning, ClockCounterClockwise, WhatsappLogo, Link, CalendarBlank } from "@phosphor-icons/react";
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

  return (
    <div className="font-sans text-slate-800 antialiased min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-0">

      <main className="flex-1 p-6 lg:p-8 max-w-[800px] mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Pengaturan Apotek</h1>
          <p className="text-sm text-slate-500">Kelola profil apotek, tim kasir, dan informasi resmi.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('profil')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'profil' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Profil Apotek
          </button>
          <button
            onClick={() => setActiveTab('tim')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'tim' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${profile?.role === 'cashier' ? 'hidden' : ''}`}
          >
            <Users className="w-4 h-4" />
            Tim Kasir
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'log' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${profile?.role === 'cashier' ? 'hidden' : ''}`}
          >
            <ClockCounterClockwise className="w-4 h-4" />
            Log Aktivitas
          </button>
        </div>

        {/* ── TAB: Profil Apotek ── */}
        {activeTab === 'profil' && (
          <form onSubmit={handleSave} className="space-y-6">
          {/* Logo Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ImageIcon weight="fill" className="w-5 h-5 text-blue-500" />
              Logo Apotek
            </h2>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Storefront className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-semibold rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                    Pilih Gambar
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash weight="bold" className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">PNG, JPG, atau WebP. Maks 2MB. Akan tampil di struk.</p>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User weight="fill" className="w-5 h-5 text-blue-500" />
              Informasi Profil
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Pemilik / Apoteker</label>
                <input
                  required
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Dr. Ahmad Fauzi, S.Farm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Apotek</label>
                <input
                  required
                  type="text"
                  value={form.pharmacy_name}
                  onChange={(e) => setForm({ ...form, pharmacy_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Apotek Sehat Selalu"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Alamat Apotek
                </label>
                <input
                  type="text"
                  value={form.pharmacy_address}
                  onChange={(e) => setForm({ ...form, pharmacy_address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Jl. Kesehatan No. 123, Jakarta"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="628123456789"
                />
                <p className="text-xs text-slate-400 mt-1.5">Format: 628xxx (tanpa +). Juga digunakan sebagai default nomor WA untuk kirim struk.</p>
              </div>
            </div>
          </div>

          {/* Informasi Resmi Apotek */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <IdentificationCard weight="fill" className="w-5 h-5 text-blue-500" />
              Informasi Resmi Apotek
            </h2>
            <p className="text-xs text-slate-400 mb-4">Akan tampil di struk cetak sesuai regulasi PMK 73/2016.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor SIA</label>
                <input
                  type="text"
                  value={form.sia_number}
                  onChange={(e) => setForm({ ...form, sia_number: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="503/SIA/XII/2024/001"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Apoteker Penanggung Jawab</label>
                <input
                  type="text"
                  value={form.apoteker_name}
                  onChange={(e) => setForm({ ...form, apoteker_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="apt. Siti Rahayu, S.Farm."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor SIPA Apoteker</label>
                <input
                  type="text"
                  value={form.sipa_number}
                  onChange={(e) => setForm({ ...form, sipa_number: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="503/SIPA/XII/2024/001"
                />
              </div>
            </div>
          </div>

          {/* Masa Berlaku Izin */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <CalendarBlank weight="fill" className="w-5 h-5 text-blue-500" />
              Masa Berlaku Izin
            </h2>
            <p className="text-xs text-slate-400 mb-4">Sistem akan mengingatkan Anda sebelum izin kadaluarsa (H-90, H-30, H-7).</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {([
                { key: 'sia_expiry_date' as const, label: 'Kadaluarsa SIA' },
                { key: 'sipa_expiry_date' as const, label: 'Kadaluarsa SIPA' },
                { key: 'stra_expiry_date' as const, label: 'Kadaluarsa STRA' },
              ]).map(({ key, label }) => {
                const expiryInfo = getLicenseExpiryStatus(form[key]);
                return (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
                    <input
                      type="date"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    {form[key] && (
                      <p className={`text-xs mt-1.5 font-medium ${
                        expiryInfo.status === 'expired' ? 'text-rose-600' :
                        expiryInfo.status === 'critical' ? 'text-amber-600' :
                        expiryInfo.status === 'warning' ? 'text-amber-500' :
                        'text-emerald-600'
                      }`}>
                        {expiryInfo.status === 'expired' && <Warning className="w-3 h-3 inline mr-1" weight="fill" />}
                        {expiryInfo.status === 'critical' && <Warning className="w-3 h-3 inline mr-1" weight="fill" />}
                        {expiryInfo.label}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receipt Settings */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Storefront weight="fill" className="w-5 h-5 text-blue-500" />
              Pengaturan Struk
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Lebar Kertas Struk</label>
                <select
                  value={form.receipt_width}
                  onChange={e => setForm(f => ({ ...f, receipt_width: e.target.value as '58mm' | '80mm' | 'A4' }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                >
                  <option value="58mm">58mm — Printer Termal Kecil (paling umum)</option>
                  <option value="80mm">80mm — Printer Termal Besar</option>
                  <option value="A4">A4 — Printer Biasa / Inkjet</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Sesuaikan dengan tipe printer yang digunakan di apotek Anda.</p>
              </div>
            </div>
          </div>

          {/* Receipt Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Storefront weight="fill" className="w-5 h-5 text-blue-500" />
              Preview Header Struk
            </h2>
            <div className="bg-slate-50 rounded-xl p-6 font-mono text-xs text-center border border-slate-200 max-w-[300px] mx-auto">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="w-12 h-12 object-cover rounded-lg mx-auto mb-2" />
              )}
              <p className="font-bold text-sm">{form.pharmacy_name || 'NAMA APOTEK'}</p>
              <p className="text-slate-500">{form.pharmacy_address || 'Alamat Apotek'}</p>
              <p className="text-slate-500">Telp: {form.phone || '-'}</p>
              {form.apoteker_name && <p className="text-slate-500">Apt: {form.apoteker_name}{form.sipa_number ? `, SIPA: ${form.sipa_number}` : ''}</p>}
              {form.sia_number && <p className="text-slate-500">SIA: {form.sia_number}</p>}
              <div className="border-t border-dashed border-slate-300 mt-3 pt-2">
                <p className="text-slate-400 italic">... detail transaksi ...</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <FloppyDisk weight="fill" className="w-4 h-4" />
                  Simpan Pengaturan
                </>
              )}
            </button>
          </div>
          </form>
        )} {/* end profil tab */}

        {/* ── TAB: Tim Kasir ── */}
        {activeTab === 'tim' && (
          <div className="space-y-6">
            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
              <Warning weight="fill" className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Cara menambah kasir baru:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Klik <strong>Undang Kasir</strong>, masukkan email kasir</li>
                  <li>Salin kode undangan, kirimkan ke kasir</li>
                  <li>Kasir daftar akun baru, lalu kunjungi halaman <strong>/join</strong> dan masukkan kode undangan</li>
                </ol>
              </div>
            </div>

            {/* Active team members */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Users weight="fill" className="w-5 h-5 text-blue-500" />
                  Kasir Aktif
                </h2>
                <button
                  onClick={() => { setShowInviteModal(true); setInviteResult(null); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Undang Kasir
                </button>
              </div>

              {loadingTeam ? (
                <div className="text-center py-8 text-slate-400 text-sm">Memuat...</div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Belum ada kasir terdaftar.<br />
                  Undang kasir menggunakan tombol di atas.
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                          <User weight="fill" className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{member.full_name}</p>
                          <p className="text-xs text-slate-400 capitalize">{member.role} · Bergabung {new Date(member.created_at!).toLocaleDateString('id-ID')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDeactivateTarget(member)}
                        className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors font-semibold"
                      >
                        Lepas
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-base font-bold text-slate-800 mb-4">Undangan Tertunda</h2>
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {inv.email ?? <span className="text-slate-400 italic">Open invite</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          Kadaluarsa {new Date(inv.expires_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/join?token=${inv.token}`;
                            navigator.clipboard.writeText(link).then(() => toast.success('Link disalin'));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Link className="w-3.5 h-3.5" />
                          Salin Link
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Halo! Anda diundang bergabung ke tim apotek ${profile?.pharmacy_name}. Klik link berikut untuk bergabung:\n${window.location.origin}/join?token=${inv.token}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-600 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <WhatsappLogo className="w-3.5 h-3.5" />
                          WA
                        </a>
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          disabled={revokingInviteId === inv.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-500 text-xs font-semibold rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
                          title="Batalkan undangan"
                        >
                          {revokingInviteId === inv.id
                            ? <div className="w-3.5 h-3.5 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                            : <X className="w-3.5 h-3.5" />
                          }
                          Batalkan
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Menampilkan 100 aktivitas terbaru dari semua pengguna apotek ini.
              </p>
              <button onClick={fetchAuditLogs}
                className="text-xs text-blue-500 font-semibold hover:underline">
                Muat Ulang
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {loadingLogs ? (
                <div className="py-12 text-center text-slate-400 text-sm">Memuat log aktivitas...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center">
                  <ClockCounterClockwise className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Belum ada log aktivitas tercatat</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {auditLogs.map((log) => {
                    const actionConfig = {
                      create: { label: 'Tambah', color: 'text-emerald-600 bg-emerald-50' },
                      update: { label: 'Ubah',   color: 'text-blue-600 bg-blue-50' },
                      delete: { label: 'Hapus',  color: 'text-rose-600 bg-rose-50' },
                    } as const;
                    const cfg = actionConfig[log.action] ?? { label: log.action, color: 'text-slate-600 bg-slate-100' };
                    const entityLabel: Record<string, string> = {
                      medicine: 'Obat', transaction: 'Transaksi',
                      prescription: 'Resep', customer: 'Pelanggan',
                    };
                    return (
                      <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <span className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">{log.users?.full_name || 'Sistem'}</span>
                            {' '}{cfg.label.toLowerCase()}{' '}
                            <span className="text-slate-500">{entityLabel[log.entity_type] || log.entity_type}</span>
                            {log.entity_name && (
                              <span className="font-medium text-slate-800"> "{log.entity_name}"</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Modal: Undang Kasir ── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 id="invite-modal-title" className="text-lg font-bold">Undang Kasir Baru</h2>
              <button onClick={() => { setShowInviteModal(false); setInviteResult(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl">
                  <CheckCircle weight="fill" className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">Undangan berhasil dibuat!</p>
                </div>
                <p className="text-sm text-slate-600">Bagikan link ini kepada kasir. Link berlaku 7 hari.</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="flex-1 text-xs font-mono text-slate-700 truncate">
                    {`${window.location.origin}/join?token=${inviteResult.token}`}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join?token=${inviteResult.token}`).then(() => toast.success('Link disalin'));
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                    title="Salin link"
                  >
                    <Copy className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Halo! Anda diundang bergabung ke tim apotek ${profile?.pharmacy_name}. Klik link berikut untuk bergabung:\n${window.location.origin}/join?token=${inviteResult.token}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
                >
                  <WhatsappLogo className="w-5 h-5" />
                  Kirim via WhatsApp
                </a>
                <details className="text-xs text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-600 transition-colors">Kode manual (fallback)</summary>
                  <div className="mt-2 flex items-center gap-2 bg-slate-100 rounded-lg p-2">
                    <span className="flex-1 font-mono font-bold text-slate-700 text-base tracking-widest text-center">{inviteResult.code}</span>
                    <button onClick={() => navigator.clipboard.writeText(inviteResult.code).then(() => toast.success('Kode disalin'))} className="p-1 hover:bg-slate-200 rounded">
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </details>
                <button
                  onClick={() => setInviteResult(null)}
                  className="w-full px-4 py-2 text-slate-500 hover:bg-slate-50 text-sm rounded-xl transition-colors"
                >
                  Undang kasir lain
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Kasir <span className="text-slate-400 font-normal">(opsional)</span></label>
                  <input
                    type="email"
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="kasir@email.com"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Kosongkan untuk membuat link terbuka yang bisa dipakai siapa saja.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-label="Konfirmasi Lepas Kasir">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <Warning weight="fill" className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">Lepas Kasir?</h2>
            <p className="text-sm text-slate-500 mb-6">
              <strong>{deactivateTarget.full_name}</strong> akan dilepas dari tim apotek ini dan tidak dapat lagi menggunakan aplikasi sebagai kasir Anda.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
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
