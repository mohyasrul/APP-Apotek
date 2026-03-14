import { Cross, SquaresFour, ClipboardText, Receipt, ChartPieSlice, Package, Bell, CaretDown, SignOut, GearSix, X, Warning, CalendarX, UsersFour, Clipboard, CreditCard, Truck } from "@phosphor-icons/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { supabase } from "../../lib/supabase";
import { usePOSStore } from "../../lib/store";
import { useState, useRef, useEffect, useCallback } from "react";

interface NotificationItem {
  type: 'stock' | 'expiry';
  name: string;
  detail: string;
}

export function TopNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, effectiveUserId } = useAuth();
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

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors ${
      isActive
        ? "bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        : "text-slate-500 hover:text-slate-900"
    }`;
  };

  return (
    <nav className="bg-white px-6 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 z-50">
      {/* Left: Logo & Menus */}
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white transform rotate-45">
            <Cross weight="bold" className="w-5 h-5 -rotate-45" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">MediSir</span>
        </Link>

      {/* Desktop Menus */}
        <div className="hidden md:flex items-center gap-2">
          <Link to="/" className={getLinkClass("/")}>
            <SquaresFour weight={location.pathname === "/" ? "fill" : "bold"} className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to="/resep" className={getLinkClass("/resep")}>
            <ClipboardText weight={location.pathname === "/resep" ? "fill" : "bold"} className="w-4 h-4" />
            Resep
          </Link>
          <Link to="/pengadaan" className={getLinkClass("/pengadaan")}>
            <Truck weight={location.pathname === "/pengadaan" ? "fill" : "bold"} className="w-4 h-4" />
            Pengadaan
          </Link>
          <Link to="/pos" className={getLinkClass("/pos")}>
            <Receipt weight={location.pathname === "/pos" ? "fill" : "bold"} className="w-4 h-4" />
            Kasir / POS
          </Link>
          {profile?.role === 'owner' && (
            <Link to="/laporan" className={getLinkClass("/laporan")}>
              <ChartPieSlice weight={location.pathname === "/laporan" ? "fill" : "bold"} className="w-4 h-4" />
              Laporan
            </Link>
          )}
          <Link to="/medicines" className={getLinkClass("/medicines")}>
            <Package weight={location.pathname === "/medicines" ? "fill" : "bold"} className="w-4 h-4" />
            Stok Obat
          </Link>
          <Link to="/customers" className={getLinkClass("/customers")}>
            <UsersFour weight={location.pathname === "/customers" ? "fill" : "bold"} className="w-4 h-4" />
            Pelanggan
          </Link>
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors relative"
          >
            <Bell weight="bold" className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full border-2 border-white flex items-center justify-center translate-x-1/4 -translate-y-1/4">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifPanel && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Notifikasi</p>
                <button onClick={() => setShowNotifPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loadingNotif ? (
                  <div className="py-6 text-center text-xs text-slate-400">Memuat...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Tidak ada notifikasi saat ini
                  </div>
                ) : (
                  <>
                    {notifications.filter(n => n.type === 'stock').length > 0 && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Warning className="w-3 h-3 text-amber-500" />
                          Stok Kritis ({notifications.filter(n => n.type === 'stock').length})
                        </p>
                        {notifications.filter(n => n.type === 'stock').map((n, i) => (
                          <div key={i} className="py-2 border-b border-slate-50 last:border-0">
                            <p className="text-sm font-semibold text-slate-800">{n.name}</p>
                            <p className="text-xs text-amber-600">{n.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {notifications.filter(n => n.type === 'expiry').length > 0 && (
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CalendarX className="w-3 h-3 text-rose-500" />
                          Mendekati Kadaluarsa ({notifications.filter(n => n.type === 'expiry').length})
                        </p>
                        {notifications.filter(n => n.type === 'expiry').map((n, i) => (
                          <div key={i} className="py-2 border-b border-slate-50 last:border-0">
                            <p className="text-sm font-semibold text-slate-800">{n.name}</p>
                            <p className="text-xs text-rose-600">{n.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <button
                    onClick={() => { setShowNotifPanel(false); navigate('/medicines'); }}
                    className="w-full text-xs text-blue-600 font-semibold hover:underline text-center"
                  >
                    Kelola Stok Obat →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>

        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full border border-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm uppercase">
              {displayName.charAt(0)}
            </div>
            <div className="flex-col hidden sm:flex">
              <span className="text-sm font-semibold leading-tight text-slate-800 max-w-[120px] truncate">
                {displayName}
              </span>
              <span className="text-[11px] text-slate-500 max-w-[120px] truncate">{pharmacyName}</span>
            </div>
            <CaretDown weight="bold" className={`w-4 h-4 text-slate-400 ml-1 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </div>

          {/* User Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs text-slate-500">Masuk sebagai</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
                <p className="text-xs text-slate-400 truncate">{pharmacyName}</p>
              </div>
              <button
                onClick={() => { setShowDropdown(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
              >
                <GearSix weight="bold" className="w-4 h-4" />
                Pengaturan
              </button>
              {profile?.role === 'owner' && (
                <>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/stock-opname'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                  >
                    <Clipboard weight="bold" className="w-4 h-4" />
                    Stock Opname
                  </button>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/billing'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                  >
                    <CreditCard weight="bold" className="w-4 h-4" />
                    Langganan
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors text-left"
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
