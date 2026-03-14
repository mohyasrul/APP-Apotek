import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { usePOSStore } from '../lib/store';

const IDLE_TIMEOUT_MS  = 30 * 60 * 1000; // 30 menit tidak aktif → tampilkan warning
const WARN_DURATION_MS =  5 * 60 * 1000; // 5 menit sejak warning → auto logout

export function SessionTimeout() {
  const { user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARN_DURATION_MS / 1000);

  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (idleTimer.current)        clearTimeout(idleTimer.current);
    if (warnTimer.current)        clearTimeout(warnTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const logout = useCallback(async () => {
    clearTimers();
    usePOSStore.getState().resetStore();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  const resetTimer = useCallback(() => {
    if (!user) return;
    setShowWarning(false);
    clearTimers();

    idleTimer.current = setTimeout(() => {
      // Mulai countdown 5 menit
      setShowWarning(true);
      setCountdown(WARN_DURATION_MS / 1000);

      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      warnTimer.current = setTimeout(logout, WARN_DURATION_MS);
    }, IDLE_TIMEOUT_MS);
  }, [user, logout]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
      clearTimers();
    };
  }, [user, resetTimer]);

  if (!user || !showWarning) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeStr = minutes > 0
    ? `${minutes} menit ${seconds} detik`
    : `${seconds} detik`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Sesi Akan Berakhir</h2>
        <p className="text-sm text-slate-500 mb-2">
          Anda tidak aktif selama 30 menit.<br />
          Sesi akan berakhir otomatis dalam:
        </p>
        <p className="text-2xl font-bold text-amber-500 mb-6">{timeStr}</p>
        <div className="flex gap-3">
          <button
            onClick={logout}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Keluar Sekarang
          </button>
          <button
            onClick={resetTimer}
            className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Tetap Login
          </button>
        </div>
      </div>
    </div>
  );
}
