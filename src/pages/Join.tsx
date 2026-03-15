import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { InvitePreview } from '../lib/types';
import {
  Cross, Buildings, User, EnvelopeSimple, LockKey,
  ArrowRight, CheckCircle, Warning, Storefront, Spinner,
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

  const renderHeader = (preview?: InvitePreview) => (
    <div className="text-center mb-8">
      {preview?.logo_url ? (
        <img src={preview.logo_url} alt="Logo Apotek" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 shadow-md" />
      ) : (
        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white transform rotate-45 mx-auto mb-4 shadow-lg shadow-blue-500/30">
          <Cross weight="bold" className="w-8 h-8 -rotate-45" />
        </div>
      )}
      {preview ? (
        <>
          <h1 className="text-xl font-bold text-slate-800 mb-1">Undangan Bergabung</h1>
          <div className="flex items-center justify-center gap-1.5 text-slate-600">
            <Buildings weight="fill" className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="font-semibold">{preview.pharmacy_name}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">oleh {preview.owner_name}</p>
          {preview.email && (
            <p className="text-xs text-slate-400 mt-2 bg-slate-50 rounded-lg px-3 py-1.5 inline-block">
              Untuk: <span className="font-mono font-semibold text-slate-600">{preview.email}</span>
            </p>
          )}
        </>
      ) : (
        <h1 className="text-2xl font-bold text-slate-800">Bergabung ke Tim Apotek</h1>
      )}
    </div>
  );

  const renderAuthForm = () => (
    <div className="w-full">
      {/* Mode toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
        {(['register', 'login'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => { setAuthMode(mode); setAuthError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              authMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {mode === 'register' ? 'Daftar Akun Baru' : 'Sudah Punya Akun'}
          </button>
        ))}
      </div>

      <form onSubmit={handleAuth} className="space-y-3">
        {authMode === 'register' && (
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              required
              type="text"
              placeholder="Nama Lengkap"
              value={authName}
              onChange={e => setAuthName(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        )}

        <div className="relative">
          <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            required
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={e => setAuthEmail(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="relative">
          <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            required
            type="password"
            placeholder="Password (min. 6 karakter)"
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {authError && (
          <p className="text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2">{authError}</p>
        )}

        {authMode === 'register' && (
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="agree-terms-join"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500/20"
            />
            <label htmlFor="agree-terms-join" className="text-xs text-slate-500 leading-relaxed">
              Saya menyetujui{' '}
              <Link to="/syarat-ketentuan" className="text-blue-500 hover:underline font-semibold" target="_blank">
                Syarat dan Ketentuan
              </Link>{' '}
              dan{' '}
              <Link to="/kebijakan-privasi" className="text-blue-500 hover:underline font-semibold" target="_blank">
                Kebijakan Privasi
              </Link>{' '}
              MediSir.
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading || (authMode === 'register' && !agreedToTerms)}
          className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Memuat undangan...</span>
        </div>
      </div>
    );
  }

  if (pageState.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="bg-white max-w-sm w-full p-8 rounded-[24px] shadow-soft border border-slate-100 text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Warning weight="fill" className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Undangan Tidak Valid</h1>
          <p className="text-sm text-slate-500 mb-6">{ERROR_MESSAGES[pageState.reason]}</p>
          <a href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors">
            Kembali ke Login
          </a>
        </div>
      </div>
    );
  }

  if (pageState.status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="bg-white max-w-sm w-full p-8 rounded-[24px] shadow-soft border border-slate-100 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle weight="fill" className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Selamat Bergabung!</h1>
          <p className="text-sm text-slate-500 mb-1">Anda berhasil bergabung ke tim</p>
          <p className="font-bold text-blue-600 text-lg mb-6">{pageState.pharmacyName}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
            Mengalihkan ke dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (pageState.status === 'already_member') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="bg-white max-w-sm w-full p-8 rounded-[24px] shadow-soft border border-slate-100 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle weight="fill" className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Sudah Bergabung</h1>
          <p className="text-sm text-slate-500 mb-6">Anda sudah menjadi anggota tim apotek ini.</p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-[24px] shadow-soft border border-slate-100">

        {renderHeader(preview)}

        {/* Email confirmation sent state */}
        {confirmEmail ? (
          <div className="text-center">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-4">
              <EnvelopeSimple weight="fill" className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-800 mb-1">Cek Email Anda!</p>
              <p className="text-xs text-emerald-600">Kami mengirimkan link konfirmasi ke <strong>{authEmail}</strong>. Klik link tersebut untuk melanjutkan.</p>
            </div>
            <button
              onClick={() => setConfirmEmail(false)}
              className="text-sm text-blue-500 hover:underline"
            >
              Masukkan email lain
            </button>
          </div>
        ) : user ? (
          /* User is already authenticated — show accept button */
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-700">
                Masuk sebagai <span className="font-semibold">{user.email}</span>
              </p>
            </div>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60"
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
          <div className="mt-6 pt-5 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Storefront weight="fill" className="w-4 h-4" />
              Saya pemilik apotek
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
