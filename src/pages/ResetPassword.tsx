import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Cross, LockKey, CheckCircle, ShieldCheck } from '@phosphor-icons/react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase mengirim user ke URL dengan access_token di hash fragment.
  // onAuthStateChange akan menangkap event PASSWORD_RECOVERY secara otomatis.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Konfirmasi password tidak cocok');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
            <ShieldCheck weight="fill" className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-4">
            Keamanan Akun<br />Adalah Prioritas Kami
          </h2>
          <p className="text-indigo-200 text-base leading-relaxed">
            Buat password yang kuat untuk melindungi data apotek Anda. Gunakan kombinasi huruf, angka, dan simbol.
          </p>
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

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-1">Reset Password</h1>
            <p className="text-gray-500 dark:text-zinc-400 text-sm">
              Masukkan password baru Anda di bawah.
            </p>
          </div>

          {done ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle weight="fill" className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-2 text-lg">Password Berhasil Direset!</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Anda akan diarahkan ke dashboard dalam beberapa detik...</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-zinc-400 text-sm">Memverifikasi link reset...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div role="alert" className="bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 p-3 rounded-xl text-sm">
                  {errorMsg}
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Password Baru</label>
                <div className="relative">
                  <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
                  <input
                    id="new-password"
                    required
                    type="password"
                    placeholder="Min. 6 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Konfirmasi Password</label>
                <div className="relative">
                  <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
                  <input
                    id="confirm-password"
                    required
                    type="password"
                    placeholder="Ulangi password baru"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-e1"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-e2 disabled:opacity-50 mt-2"
              >
                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
