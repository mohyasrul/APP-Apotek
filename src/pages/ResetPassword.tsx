import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Cross, LockKey, CheckCircle } from '@phosphor-icons/react';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-[24px] shadow-soft border border-slate-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white transform rotate-45 mb-8 shadow-lg shadow-blue-500/30">
          <Cross weight="bold" className="w-8 h-8 -rotate-45" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">Reset Password</h1>
        <p className="text-slate-500 text-center mb-6 text-sm">
          Masukkan password baru Anda di bawah.
        </p>

        {done ? (
          <div className="text-center">
            <CheckCircle weight="fill" className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-800 mb-1">Password berhasil direset!</p>
            <p className="text-sm text-slate-500">Anda akan diarahkan ke dashboard dalam beberapa detik...</p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center text-slate-500 text-sm">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memverifikasi link reset...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {errorMsg && (
              <div className="bg-rose-50 text-rose-600 border border-rose-200 p-3 rounded-lg text-sm text-center">
                {errorMsg}
              </div>
            )}

            <div className="relative">
              <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                required
                type="password"
                placeholder="Password Baru (Min. 6 Karakter)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="relative">
              <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                required
                type="password"
                placeholder="Konfirmasi Password Baru"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
