import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Cross, EnvelopeSimple, LockKey, X,
  Receipt, Package, ChartPieSlice, Users,
} from '@phosphor-icons/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const features = [
  { icon: Receipt,        title: 'Kasir & POS Cepat',        desc: 'Proses transaksi dengan antarmuka yang intuitif dan responsif.' },
  { icon: Package,        title: 'Manajemen Stok Otomatis',   desc: 'Pantau stok secara real-time dengan peringatan kadaluarsa.' },
  { icon: ChartPieSlice,  title: 'Laporan Keuangan Lengkap',  desc: 'Analisis pendapatan dan pengeluaran dalam satu dashboard.' },
  { icon: Users,          title: 'Multi-Pengguna & Peran',    desc: 'Atur akses kasir dan apoteker dengan sistem peran fleksibel.' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  // Jika user sudah login, arahkan ke Dashboard
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      if (isSignUp) {
        // Sign Up Mode
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          // Auto-confirm aktif — profil akan dibuat via trigger, redirect ke dashboard
          navigate('/');
          return;
        }
        // Email confirmation diperlukan — tampilkan pesan
        setSuccessMsg('Registrasi berhasil! Periksa email Anda untuk konfirmasi akun, lalu login.');
        setIsSignUp(false);
        setPassword('');
      } else {
        // Sign In Mode
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Setelah berhasil login, pastikan profil apotek ada di tabel public.users
        if (data.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('id')
            .eq('id', data.user.id)
            .single();
            
          if (!profile) {
            // Jika belum ada, buat profil dasar
            await supabase.from('users').insert([{
              id: data.user.id,
              full_name: email.split('@')[0],
              pharmacy_name: `Apotek ${email.split('@')[0]}`,
              pharmacy_address: '-',
              role: 'owner'
            }]);
          }
        }
        
        // Arahkan ke dashboard
        navigate('/');
      }
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Terjadi kesalahan saat otentikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Terjadi kesalahan');
      setShowForgotModal(false);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 font-sans">
      {/* ── Left Panel: Brand (desktop only) ─────────────────── */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 text-white p-12 relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-white/5 rounded-full" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
            <Cross weight="bold" className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">MediSir</span>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold leading-tight mb-4">
            Sistem Manajemen<br />Apotek Modern
          </h2>
          <p className="text-indigo-200 text-base mb-10 leading-relaxed">
            Kelola stok, resep, dan laporan apotek Anda dalam satu platform terintegrasi yang mudah digunakan.
          </p>

          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border border-white/10">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-indigo-300 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
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

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-1">
              {isSignUp ? 'Buat Akun Baru' : 'Selamat Datang Kembali'}
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 text-sm">
              {isSignUp
                ? 'Daftarkan apotek Anda dan mulai kelola dengan lebih efisien.'
                : 'Masuk ke sistem manajemen apotek Anda.'}
            </p>
          </div>

          {errorMsg && (
            <div role="alert" className="bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 p-3 rounded-xl text-sm mb-6">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div role="status" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm mb-6">
              {successMsg}
            </div>
          )}
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Email</label>
              <div className="relative">
                <EnvelopeSimple className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
                <input 
                  id="login-email"
                  required
                  type="email" 
                  placeholder="nama@domain.com" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
                />
              </div>
            </div>
            
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => { setShowForgotModal(true); setForgotEmail(email); setForgotSent(false); }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                  >
                    Lupa Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
                <input 
                  id="login-password"
                  required
                  type="password" 
                  placeholder="Min. 6 karakter" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
                />
              </div>
            </div>

            {isSignUp && (
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500/20"
                />
                <label htmlFor="agree-terms" className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                  Saya menyetujui{' '}
                  <Link to="/syarat-ketentuan" className="text-indigo-600 hover:underline font-semibold" target="_blank">
                    Syarat dan Ketentuan
                  </Link>{' '}
                  dan{' '}
                  <Link to="/kebijakan-privasi" className="text-indigo-600 hover:underline font-semibold" target="_blank">
                    Kebijakan Privasi
                  </Link>{' '}
                  MediSir, termasuk pemrosesan data pribadi sesuai UU PDP.
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isSignUp && !agreedToTerms)}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:bg-indigo-800 transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 shadow-e2 mt-2"
            >
              {loading ? 'Memproses...' : isSignUp ? 'Buat Akun' : 'Masuk'}
            </button>

            <p className="text-center text-sm text-gray-600 dark:text-zinc-400 pt-1">
              {isSignUp ? 'Sudah punya akun? ' : 'Belum punya akun? '}
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                {isSignUp ? 'Masuk di sini' : 'Daftar gratis'}
              </button>
            </p>
          </form>

          {isSignUp && (
            <p className="mt-4 text-xs text-gray-400 dark:text-zinc-500 text-center">
              Akun baru otomatis menjadi <span className="font-semibold text-gray-500 dark:text-zinc-400">Owner</span>.
              Jika Anda kasir, gunakan <span className="font-semibold text-gray-500 dark:text-zinc-400">link undangan</span> dari pemilik apotek.
            </p>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-zinc-500">
            <Link to="/kebijakan-privasi" className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">Kebijakan Privasi</Link>
            <span>·</span>
            <Link to="/syarat-ketentuan" className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">Syarat & Ketentuan</Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="forgot-pw-title" className="bg-white dark:bg-zinc-900 rounded-2xl shadow-e4 w-full max-w-sm p-6 border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 id="forgot-pw-title" className="text-base font-semibold text-gray-900 dark:text-zinc-100">Reset Password</h2>
              <button onClick={() => setShowForgotModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg" aria-label="Tutup modal">
                <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
              </button>
            </div>

            {forgotSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center mx-auto mb-3">
                  <EnvelopeSimple weight="fill" className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Email Terkirim!</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
                  Cek inbox <strong>{forgotEmail}</strong> untuk link reset password.
                </p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-zinc-400">Masukkan email Anda. Kami akan mengirimkan link untuk reset password.</p>
                <div className="relative">
                  <label htmlFor="forgot-email" className="sr-only">Email</label>
                  <EnvelopeSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoFocus
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {forgotLoading ? 'Mengirim...' : 'Kirim Link Reset'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
