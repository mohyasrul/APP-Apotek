import { useLocation, useNavigate } from "react-router-dom";
import { SquaresFour, Receipt, ChartPieSlice, Package, Plus, UsersFour } from "@phosphor-icons/react";
import { useAuth } from "../../lib/AuthContext";
import { cn } from "../../lib/cn";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  // Hide on POS page (POS has its own full-height layout)
  if (location.pathname === '/pos') return null;

  const navItems = [
    { path: '/', icon: SquaresFour, label: 'Home' },
    { path: '/medicines', icon: Package, label: 'Stok' },
    { path: '/pos', icon: Plus, label: 'Transaksi', isCenter: true },
    ...(isOwner
      ? [
          { path: '/resep', icon: Receipt, label: 'Resep' },
          { path: '/laporan', icon: ChartPieSlice, label: 'Laporan' },
        ]
      : [
          { path: '/resep', icon: Receipt, label: 'Resep' },
          { path: '/customers', icon: UsersFour, label: 'Pelanggan' },
        ]
    ),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" aria-label="Menu navigasi">
      {/* Glass Background */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-end justify-around py-2 max-w-md mx-auto relative">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            if (item.isCenter) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  className="relative -mt-6 flex flex-col items-center"
                >
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all',
                    isActive
                      ? 'bg-blue-500 shadow-blue-500/30 scale-105'
                      : 'bg-blue-500 shadow-blue-500/20 hover:scale-105 active:scale-95'
                  )}>
                    <Plus weight="bold" className="w-7 h-7 text-white" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold mt-1',
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                className="flex flex-col items-center gap-0.5 py-1 px-3 transition-colors"
              >
                <item.icon
                  weight={isActive ? "fill" : "regular"}
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                  )}
                />
                <span className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
