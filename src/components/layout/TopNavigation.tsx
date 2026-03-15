import { Cross, Bell, CaretDown, SignOut, GearSix, X, Warning, CalendarX, Clipboard, CreditCard, FileText, Book, Trash, ChatCircleText, Flask, CurrencyCircleDollar, Sun, Moon, Timer, Question } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { supabase } from "../../lib/supabase";
import { usePOSStore } from "../../lib/store";
import { useTheme } from "../../lib/ThemeContext";
import { useSubscription } from "../../lib/SubscriptionContext";
import { useState, useRef, useEffect, useCallback } from "react";

interface NotificationItem {
  type: 'stock' | 'expiry';
  name: string;
  detail: string;
}

export function TopNavigation() {
  const navigate = useNavigate();
  const { user, profile, effectiveUserId } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isTrialing, daysRemaining } = useSubscription();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };

    if (showDropdown || showNotifPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, showNotifPanel]);

  const fetchNotifications = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoadingNotif(true);
    try {
      const today = new Date();
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('medicines')
        .select('name, stock, min_stock, expiry_date')
        .eq('user_id', effectiveUserId);

      if (error) throw error;

      const items: NotificationItem[] = [];
      (data || []).forEach(med => {
        if (med.stock <= (med.min_stock || 5)) {
          items.push({
            type: 'stock',
            name: med.name,
            detail: `Stok: ${med.stock} (min: ${med.min_stock || 5})`,
          });
        }
        if (med.expiry_date && med.expiry_date <= thirtyDaysLater) {
          const expDate = new Date(med.expiry_date);
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          items.push({
            type: 'expiry',
            name: med.name,
            detail: diffDays <= 0 ? 'Sudah kadaluarsa!' : `Kadaluarsa ${diffDays} hari lagi (${med.expiry_date})`,
          });
        }
      });
      setNotifications(items);
    } catch {
      // silent fail
    } finally {
      setLoadingNotif(false);
    }
  }, [effectiveUserId]);

  const handleBellClick = () => {
    if (!showNotifPanel) {
      fetchNotifications();
    }
    setShowNotifPanel(prev => !prev);
    setShowDropdown(false);
  };

  // Fetch once on mount so the badge count is visible before clicking
  useEffect(() => {
    if (effectiveUserId) fetchNotifications();
  }, [effectiveUserId, fetchNotifications]);

  const handleLogout = async () => {
    // Clear Zustand store (cart, search, etc.)
    usePOSStore.getState().resetStore();
    await supabase.auth.signOut();
    navigate('/login');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  // Untuk kasir: tampilkan nama apotek owner (bukan nama kasir sendiri)
  const [ownerPharmacyName, setOwnerPharmacyName] = useState<string | null>(null);
  useEffect(() => {
    if (profile?.role === 'cashier' && profile?.pharmacy_owner_id) {
      supabase
        .from('users')
        .select('pharmacy_name')
        .eq('id', profile.pharmacy_owner_id)
        .single()
        .then(({ data }) => setOwnerPharmacyName(data?.pharmacy_name ?? null));
    }
  }, [profile?.role, profile?.pharmacy_owner_id]);

  const pharmacyName = profile?.role === 'cashier'
    ? `Kasir — ${ownerPharmacyName ?? profile?.pharmacy_name ?? 'Apotek'}`
    : profile?.pharmacy_name || 'Apotek';


  return (
    <nav className="bg-white dark:bg-zinc-900 px-6 py-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 z-50">
      {/* Left: Logo & Menus */}
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Cross weight="bold" className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xl tracking-tight text-gray-900 dark:text-zinc-100">MediSir</span>
        </Link>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-3">
        {/* Trial Counter */}
        {isTrialing && profile?.role === 'owner' && (
          <button
            onClick={() => navigate('/billing')}
            aria-label={`${daysRemaining} hari trial tersisa`}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              daysRemaining <= 3
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50'
            }`}
          >
            <Timer weight="fill" className="w-3.5 h-3.5" />
            {daysRemaining} hari trial
          </button>
        )}
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          {theme === 'dark'
            ? <Sun weight="bold" className="w-4 h-4 text-amber-400" />
            : <Moon weight="bold" className="w-4 h-4" />
          }
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            aria-label="Notifikasi"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors relative"
          >
            <Bell weight="bold" className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center translate-x-1/4 -translate-y-1/4">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifPanel && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Notifikasi</p>
                <button onClick={() => setShowNotifPanel(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loadingNotif ? (
                  <div className="py-6 text-center text-xs text-gray-400">Memuat...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400">
                    Tidak ada notifikasi saat ini
                  </div>
                ) : (
                  <>
                    {notifications.filter(n => n.type === 'stock').length > 0 && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Warning className="w-3 h-3 text-amber-500" />
                          Stok Kritis ({notifications.filter(n => n.type === 'stock').length})
                        </p>
                        {notifications.filter(n => n.type === 'stock').map((n, i) => (
                          <div key={i} className="py-2 border-b border-gray-50 dark:border-zinc-800 last:border-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{n.name}</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">{n.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {notifications.filter(n => n.type === 'expiry').length > 0 && (
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CalendarX className="w-3 h-3 text-rose-500" />
                          Mendekati Kadaluarsa ({notifications.filter(n => n.type === 'expiry').length})
                        </p>
                        {notifications.filter(n => n.type === 'expiry').map((n, i) => (
                          <div key={i} className="py-2 border-b border-gray-50 dark:border-zinc-800 last:border-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{n.name}</p>
                            <p className="text-xs text-rose-600 dark:text-rose-400">{n.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    onClick={() => { setShowNotifPanel(false); navigate('/medicines'); }}
                    className="w-full text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-center"
                  >
                    Kelola Stok Obat →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="h-8 w-[1px] bg-gray-200 dark:bg-zinc-700 mx-1"></div>

        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 p-1.5 pr-3 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-semibold text-sm uppercase">
              {displayName.charAt(0)}
            </div>
            <div className="flex-col hidden sm:flex">
              <span className="text-sm font-medium leading-tight text-gray-900 dark:text-zinc-100 max-w-[120px] truncate">
                {displayName}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-zinc-400 max-w-[120px] truncate">{pharmacyName}</span>
            </div>
            <CaretDown weight="bold" className={`w-3.5 h-3.5 text-gray-400 ml-1 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </div>

          {/* User Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800 mb-1">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Masuk sebagai</p>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{user?.email}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{pharmacyName}</p>
              </div>
              <button
                onClick={() => { setShowDropdown(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <GearSix weight="bold" className="w-4 h-4" />
                Pengaturan
              </button>
              {profile?.role === 'owner' && (
                <>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/stock-opname'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Clipboard weight="bold" className="w-4 h-4" />
                    Stock Opname
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/billing'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <CreditCard weight="bold" className="w-4 h-4" />
                    Langganan
                  </button>
                  <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                  <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Kepatuhan</p>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/sipnap'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <FileText weight="bold" className="w-4 h-4" />
                    Laporan SIPNAP
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/buku-harian-narkotika'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Book weight="bold" className="w-4 h-4" />
                    Buku Harian Narkotika
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/pemusnahan-obat'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Trash weight="bold" className="w-4 h-4" />
                    Pemusnahan Obat
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/laporan-keuangan'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <CurrencyCircleDollar weight="bold" className="w-4 h-4" />
                    Laporan Keuangan
                  </button>
                  <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                  <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Farmasi Klinis</p>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/konseling'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <ChatCircleText weight="bold" className="w-4 h-4" />
                    Konseling & PIO
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/racikan'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Flask weight="bold" className="w-4 h-4" />
                    Racikan & Compounding
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/meso'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <Warning weight="bold" className="w-4 h-4" />
                    MESO (Efek Samping Obat)
                  </button>
                </>
              )}
              <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
              <button
                onClick={() => { setShowDropdown(false); navigate('/bantuan'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <Question weight="bold" className="w-4 h-4" />
                Pusat Bantuan
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors text-left"
              >
                <SignOut weight="bold" className="w-4 h-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
