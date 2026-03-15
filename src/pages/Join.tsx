import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { InvitePreview } from '../lib/types';
import {
  Cross, Buildings, User, EnvelopeSimple, LockKey,
  ArrowRight, CheckCircle, Warning, Storefront, Spinner,
  UsersFour, ShieldCheck, Heartbeat,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'not_found' | 'expired' | 'already_used' | 'no_token' }
  | { status: 'info'; preview: InvitePreview }
  | { status: 'accepting'; preview: InvitePreview }
  | { status: 'success'; pharmacyName: string }
  | { status: 'already_member'; pharmacyName: string };

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Link undangan tidak valid atau sudah dihapus.',
  expired: 'Link undangan sudah kedaluwarsa.',
  already_used: 'Link undangan ini sudah pernah digunakan.',
  no_token: 'Link undangan tidak lengkap. Pastikan Anda membuka link yang dikirim oleh pemilik apotek.',
};

export default function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const { user, profile, refreshProfile } = useAuth();

  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });

  // ── Auth form state ───────────────────────────────────────
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(false); // email confirmation required
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // ── Load invite preview on mount ─────────────────────────
  useEffect(() => {
    if (!token) {
      setPageState({ status: 'error', reason: 'no_token' });
      return;
    }
    loadPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadPreview = async () => {
    setPageState({ status: 'loading' });
    try {
      const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });
      if (error) throw error;

      const errorReason = data?.error as string;
      if (errorReason) {
        setPageState({
          status: 'error',
          reason: errorReason as Extract<PageState, { status: 'error' }>['reason'],
        });
        return;
      }

      const preview = data as InvitePreview;

      // If user is already a member of some pharmacy, redirect immediately
      if (profile?.pharmacy_owner_id) {
        setPageState({ status: 'already_member', pharmacyName: preview.pharmacy_name });
        return;
      }

      setPageState({ status: 'info', preview });

      // Pre-fill email field with hint if invite has an email restriction
      // (don't set it as value — just use as placeholder hint)
    } catch {
      setPageState({ status: 'error', reason: 'not_found' });
    }
  };

  // ── After inline auth, update page state based on user ───
  useEffect(() => {
    if (!user) return;
    if (pageState.status !== 'info') return;

    // User just logged in — if already a kasir, redirect
    if (profile?.pharmacy_owner_id) {
      setPageState({ status: 'already_member', pharmacyName: profile.pharmacy_name || '' });
    }
    // Otherwise: user is now authed, accept button will show (handled in render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  // ── Auto-redirect on terminal states ─────────────────────
  useEffect(() => {
    if (pageState.status === 'success' || pageState.status === 'already_member') {
      const timer = setTimeout(() => navigate('/', { replace: true }), 2500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState.status]);

  // ── Handle inline auth form submit ───────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: { full_name: authName.trim() },
            emailRedirectTo: window.location.href,
          },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation required
          setConfirmEmail(true);
          return;
        }
        // Auto-confirm — onAuthStateChange fires → user state updates → useEffect above handles
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Invalid login credentials')) {
        setAuthError('Email atau password salah');
      } else if (msg.includes('User already registered')) {
        setAuthError('Email sudah terdaftar. Pilih tab "Masuk"');
      } else if (msg.includes('Password should be')) {
        setAuthError('Password minimal 6 karakter');
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Handle accept invite ──────────────────────────────────
  const handleAccept = async () => {
    if (pageState.status !== 'info') return;
    const preview = pageState.preview;
    setPageState({ status: 'accepting', preview });

    try {
      const { error } = await supabase.rpc('accept_invite_by_token', { p_token: token });
      if (error) throw error;
      await refreshProfile();
      setPageState({ status: 'success', pharmacyName: preview.pharmacy_name });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal bergabung, silakan coba lagi');
      setPageState({ status: 'info', preview });
    }
  };

  // ─────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────

  const renderAuthForm = () => (
    <div className="w-full">
      {/* Mode toggle */}
      <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 mb-6">
        {(['register', 'login'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => { setAuthMode(mode); setAuthError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              authMode === mode
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-e1'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            {mode === 'register' ? 'Daftar Akun Baru' : 'Sudah Punya Akun'}
          </button>
        ))}
      </div>

      <form onSubmit={handleAuth} className="space-y-3">
        {authMode === 'register' && (
          <div>
            <label htmlFor="join-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="join-name"
                required
                type="text"
                placeholder="Nama Lengkap"
                value={authName}
                onChange={e => setAuthName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="join-email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Email</label>
          <div className="relative">
            <EnvelopeSimple className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              id="join-email"
              required
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
            />
          </div>
        </div>

        <div>
          <label htmlFor="join-password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Password</label>
          <div className="relative">
            <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              id="join-password"
              required
              type="password"
              placeholder="Min. 6 karakter"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
            />
          </div>
        </div>

        {authError && (
          <p role="alert" className="text-xs text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 rounded-xl px-3 py-2">{authError}</p>
        )}

        {authMode === 'register' && (
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="agree-terms-join"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500/20"
            />
            <label htmlFor="agree-terms-join" className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
              Saya menyetujui{' '}
              <Link to="/syarat-ketentuan" className="text-indigo-600 hover:underline font-semibold" target="_blank">
                Syarat dan Ketentuan
              </Link>{' '}
              dan{' '}
              <Link to="/kebijakan-privasi" className="text-indigo-600 hover:underline font-semibold" target="_blank">
                Kebijakan Privasi
              </Link>{' '}
              MediSir.
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading || (authMode === 'register' && !agreedToTerms)}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-all shadow-e2 mt-1"
        >
          {authLoading
            ? <><Spinner className="w-4 h-4 animate-spin" /> Memproses...</>
            : authMode === 'register'
            ? <><ArrowRight weight="bold" className="w-4 h-4" /> Daftar & Lihat Undangan</>
            : <><ArrowRight weight="bold" className="w-4 h-4" /> Masuk & Lihat Undangan</>
          }
        </button>
      </form>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // Page states
  // ─────────────────────────────────────────────────────────

  if (pageState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-zinc-400">Memuat undangan...</span>
        </div>
      </div>
    );
  }

  if (pageState.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 font-sans p-4">
        <div className="bg-white dark:bg-zinc-900 max-w-sm w-full p-8 rounded-2xl shadow-e3 border border-gray-100 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Warning weight="fill" className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">Undangan Tidak Valid</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">{ERROR_MESSAGES[pageState.reason]}</p>
          <a href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 font-semibold rounded-xl text-sm transition-colors">
            Kembali ke Login
          </a>
        </div>
      </div>
    );
  }

  if (pageState.status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 font-sans p-4">
        <div className="bg-white dark:bg-zinc-900 max-w-sm w-full p-8 rounded-2xl shadow-e3 border border-gray-100 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle weight="fill" className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">Selamat Bergabung!</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">Anda berhasil bergabung ke tim</p>
          <p className="font-bold text-indigo-600 text-lg mb-6">{pageState.pharmacyName}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-zinc-500">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-slate-500 rounded-full animate-spin" />
            Mengalihkan ke dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (pageState.status === 'already_member') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 font-sans p-4">
        <div className="bg-white dark:bg-zinc-900 max-w-sm w-full p-8 rounded-2xl shadow-e3 border border-gray-100 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle weight="fill" className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">Sudah Bergabung</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">Anda sudah menjadi anggota tim apotek ini.</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-zinc-500">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-slate-500 rounded-full animate-spin" />
            Mengalihkan...
          </div>
        </div>
      </div>
    );
  }

  // ── Main info state ───────────────────────────────────────
  const { preview } = pageState;
  const isAccepting = pageState.status === 'accepting';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 font-sans">
      {/* ── Left Panel: Brand (desktop only) ─────────────────── */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-white/5 rounded-full" />

        <div className="relative flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
            <Cross weight="bold" className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">MediSir</span>
        </div>

        <div className="relative z-10">
          {preview?.logo_url ? (
            <img src={preview.logo_url} alt="Logo Apotek" className="w-16 h-16 rounded-2xl object-cover mb-6 border-2 border-white/20" />
          ) : (
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
              <Buildings weight="fill" className="w-8 h-8" />
            </div>
          )}
          <h2 className="text-3xl font-bold leading-tight mb-3">
            Bergabung ke Tim
          </h2>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl font-bold">{preview.pharmacy_name}</span>
          </div>
          <p className="text-indigo-200 text-sm mb-1">Diundang oleh <span className="font-semibold text-white">{preview.owner_name}</span></p>
          {preview.email && (
            <p className="text-indigo-300 text-sm">
              Untuk: <span className="font-mono font-semibold text-white">{preview.email}</span>
            </p>
          )}

          <div className="mt-8 space-y-3">
            {[
              { icon: UsersFour, text: 'Bergabung sebagai anggota tim apotek' },
              { icon: ShieldCheck, text: 'Akses sesuai peran yang ditetapkan' },
              { icon: Heartbeat, text: 'Mulai bekerja segera setelah bergabung' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-indigo-200">
                <Icon className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-indigo-400 text-xs">
          © {new Date().getFullYear()} MediSir. Sistem manajemen apotek terpercaya.
        </p>
      </div>

      {/* ── Right Panel: Form ─────────────────────────────────── */}
      <div className="flex items-center justify-center min-h-screen lg:min-h-0 bg-gray-50 dark:bg-zinc-950 p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Cross weight="bold" className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-zinc-100">MediSir</span>
          </div>

          {/* Mobile invite header */}
          <div className="lg:hidden mb-6 text-center">
            {preview?.logo_url ? (
              <img src={preview.logo_url} alt="Logo Apotek" className="w-14 h-14 rounded-xl object-cover mx-auto mb-3 shadow-e2" />
            ) : (
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                <Cross weight="bold" className="w-6 h-6" />
              </div>
            )}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Undangan Bergabung</h1>
            <div className="flex items-center justify-center gap-1.5 text-gray-600 dark:text-zinc-400 mt-1">
              <Buildings weight="fill" className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="font-semibold">{preview.pharmacy_name}</span>
            </div>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-1">Terima Undangan</h1>
            <p className="text-gray-500 dark:text-zinc-400 text-sm">
              {user ? 'Klik tombol di bawah untuk bergabung ke tim.' : 'Buat akun atau masuk untuk melanjutkan.'}
            </p>
          </div>

          {/* Email confirmation sent state */}
          {confirmEmail ? (
            <div className="text-center py-4">
              <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-xl p-5 mb-4">
                <EnvelopeSimple weight="fill" className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1">Cek Email Anda!</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Kami mengirimkan link konfirmasi ke <strong>{authEmail}</strong>. Klik link tersebut untuk melanjutkan.</p>
              </div>
              <button
                onClick={() => setConfirmEmail(false)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Masukkan email lain
              </button>
            </div>
          ) : user ? (
            /* User is already authenticated — show accept button */
            <div className="space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 rounded-xl p-4 text-center">
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                  Masuk sebagai <span className="font-semibold">{user.email}</span>
                </p>
              </div>
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-e2"
              >
                {isAccepting
                  ? <><Spinner className="w-4 h-4 animate-spin" /> Bergabung...</>
                  : <><ArrowRight weight="bold" className="w-4 h-4" /> Bergabung ke {preview.pharmacy_name}</>
                }
              </button>
            </div>
          ) : (
            /* Not authenticated — show inline auth form */
            renderAuthForm()
          )}

          {/* Escape hatch */}
          {!confirmEmail && (
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-zinc-800 flex justify-center">
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
              >
                <Storefront weight="fill" className="w-4 h-4" />
                Saya pemilik apotek
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
