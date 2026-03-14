import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Cross, EnvelopeSimple, LockKey, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-[24px] shadow-soft border border-slate-100 flex flex-col items-center">
        {/* Logo */}
        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white transform rotate-45 mb-8 shadow-lg shadow-blue-500/30">
          <Cross weight="bold" className="w-8 h-8 -rotate-45" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Selamat Datang di MediSir</h1>
        <p className="text-slate-500 text-center mb-6 text-sm">
          Aplikasi kasir dan manajemen stok apotek yang simpel dan mudah digunakan.
        </p>

        {errorMsg && (
          <div className="w-full bg-rose-50 text-rose-600 border border-rose-200 p-3 rounded-lg text-sm mb-6 text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="w-full bg-emerald-50 text-emerald-600 border border-emerald-200 p-3 rounded-lg text-sm mb-6 text-center">
            {successMsg}
          </div>
        )}
        
        <form onSubmit={handleAuth} className="w-full">
          <div className="mb-4 relative">
            <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              required
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="mb-6 relative">
            <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              required
              type="password" 
              placeholder="Password (Min. 6 Karakter)" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {!isSignUp && (
            <div className="flex justify-end -mt-4 mb-4">
              <button
                type="button"
                onClick={() => { setShowForgotModal(true); setForgotEmail(email); setForgotSent(false); }}
                className="text-xs text-blue-500 hover:underline"
              >
                Lupa Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 active:bg-blue-700 transition-all disabled:opacity-60 mb-4"
          >
            {loading ? 'Memproses...' : isSignUp ? 'Daftar' : 'Masuk'}
          </button>

          {isSignUp ? "Sudah punya akun? " : "Belum punya akun? "}
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-blue-500 font-semibold hover:underline"
          >
            {isSignUp ? "Masuk di sini" : "Daftar di sini"}
          </button>
        </form>

        {isSignUp && (
          <p className="mt-3 text-xs text-slate-400 text-center">
            Akun baru otomatis menjadi <span className="font-semibold text-slate-500">Owner</span>.
            Jika Anda kasir, gunakan <span className="font-semibold text-slate-500">link undangan</span> dari pemilik apotek.
          </p>
        )}

      </div>

    {/* Forgot Password Modal */}
    {showForgotModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Reset Password</h2>
            <button onClick={() => setShowForgotModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {forgotSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <EnvelopeSimple weight="fill" className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-semibold text-slate-800 mb-1">Email Terkirim!</p>
              <p className="text-sm text-slate-500 mb-4">
                Cek inbox <strong>{forgotEmail}</strong> untuk link reset password.
              </p>
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl"
              >
                Tutup
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-slate-500">Masukkan email Anda. Kami akan mengirimkan link untuk reset password.</p>
              <div className="relative">
                <EnvelopeSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
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
