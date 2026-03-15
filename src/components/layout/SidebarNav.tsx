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
import { cn } from '../../lib/cn';

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
  { label: 'Pengaturan', to: '/settings', icon: GearSix },
  { label: 'Bantuan',    to: '/bantuan',  icon: Question },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        'flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-[13px] transition-colors duration-150',
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-medium'
          : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-200'
      )}
    >
      <Icon
        weight={isActive ? 'fill' : 'regular'}
        className="w-[18px] h-[18px] shrink-0"
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  const checkActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <div className="hidden lg:block">
      {/* pt-[57px] matches the TopNavigation height (h-[57px]) to avoid overlapping */}
      <div className="fixed top-0 left-0 h-full w-60 z-40 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col pt-[57px]">
        {/* Logo */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
              <Cross weight="bold" className="w-4 h-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-gray-900 dark:text-zinc-100">
              MediSir
            </span>
          </Link>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar" aria-label="Menu utama">
          {navSections.map((section, si) => {
            if (section.ownerOnly && !isOwner) return null;
            return (
              <div key={si} className={si > 0 ? 'mt-1' : ''}>
                {section.sectionLabel && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest select-none">
                    {section.sectionLabel}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      item={item}
                      isActive={checkActive(item.to)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom items */}
        <div className="pb-4 border-t border-gray-100 dark:border-zinc-800 pt-2 space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              isActive={checkActive(item.to)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
