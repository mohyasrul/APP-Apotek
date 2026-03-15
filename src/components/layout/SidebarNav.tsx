import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  Cross,
  SquaresFour,
  Receipt,
  ClipboardText,
  Truck,
  Package,
  UsersFour,
  ChartPieSlice,
  CurrencyCircleDollar,
  ChatCircleText,
  Flask,
  Warning,
  FileText,
  Book,
  Trash,
  Clipboard,
  CreditCard,
  GearSix,
  Question,
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/AuthContext';

const MotionLink = motion(Link);

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

interface NavSection {
  sectionLabel?: string;
  ownerOnly?: boolean;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard',   to: '/',          icon: SquaresFour },
      { label: 'Kasir / POS', to: '/pos',        icon: Receipt },
      { label: 'Resep',       to: '/resep',      icon: ClipboardText },
      { label: 'Pengadaan',   to: '/pengadaan',  icon: Truck },
      { label: 'Stok Obat',   to: '/medicines',  icon: Package },
      { label: 'Pelanggan',   to: '/customers',  icon: UsersFour },
    ],
  },
  {
    sectionLabel: 'LAPORAN',
    ownerOnly: true,
    items: [
      { label: 'Laporan',   to: '/laporan',          icon: ChartPieSlice },
      { label: 'Keuangan',  to: '/laporan-keuangan', icon: CurrencyCircleDollar },
    ],
  },
  {
    sectionLabel: 'FARMASI KLINIS',
    ownerOnly: true,
    items: [
      { label: 'Konseling & PIO', to: '/konseling', icon: ChatCircleText },
      { label: 'Racikan',         to: '/racikan',    icon: Flask },
      { label: 'MESO',            to: '/meso',       icon: Warning },
    ],
  },
  {
    sectionLabel: 'KEPATUHAN',
    ownerOnly: true,
    items: [
      { label: 'SIPNAP',          to: '/sipnap',                   icon: FileText },
      { label: 'Buku Harian',     to: '/buku-harian-narkotika',    icon: Book },
      { label: 'Pemusnahan Obat', to: '/pemusnahan-obat',          icon: Trash },
    ],
  },
  {
    sectionLabel: 'MANAJEMEN',
    ownerOnly: true,
    items: [
      { label: 'Stock Opname', to: '/stock-opname', icon: Clipboard },
      { label: 'Langganan',    to: '/billing',       icon: CreditCard },
    ],
  },
];

const bottomItems: NavItem[] = [
  { label: 'Settings', to: '/settings', icon: GearSix },
  { label: 'Bantuan',  to: '/bantuan',  icon: Question },
];

export function SidebarNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  const getItemClass = (to: string) => {
    const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
    return isActive
      ? 'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl text-sm transition-all bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold border-l-2 border-blue-500'
      : 'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl text-sm transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100';
  };

  return (
    <div className="hidden lg:block">
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="fixed top-0 left-0 h-full w-60 z-40 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col pt-16"
      >
        {/* Logo */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-1">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white transform rotate-45 shrink-0">
              <Cross weight="bold" className="w-5 h-5 -rotate-45" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-slate-100">
              MediSir
            </span>
          </Link>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navSections.map((section, si) => {
            if (section.ownerOnly && !isOwner) return null;
            return (
              <div key={si}>
                {section.sectionLabel && (
                  <p className="px-4 pt-4 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {section.sectionLabel}
                  </p>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);
                  return (
                    <MotionLink
                      key={item.to}
                      to={item.to}
                      whileHover={{ x: 2 }}
                      className={getItemClass(item.to)}
                    >
                      <Icon
                        weight={isActive ? 'fill' : 'regular'}
                        className="w-[18px] h-[18px] shrink-0"
                      />
                      <span className="truncate">{item.label}</span>
                    </MotionLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom items */}
        <div className="pb-4 border-t border-slate-100 dark:border-slate-800 pt-2">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <MotionLink
                key={item.to}
                to={item.to}
                whileHover={{ x: 2 }}
                className={getItemClass(item.to)}
              >
                <Icon
                  weight={isActive ? 'fill' : 'regular'}
                  className="w-[18px] h-[18px] shrink-0"
                />
                <span className="truncate">{item.label}</span>
              </MotionLink>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
