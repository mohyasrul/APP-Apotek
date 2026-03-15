import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
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
  ArrowLineLeft,
  ArrowLineRight,
  CaretDown,
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/AuthContext';
import { useSidebar } from '../../lib/SidebarContext';
import { cn } from '../../lib/cn';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

interface NavSection {
  sectionLabel?: string;
  ownerOnly?: boolean;
  collapsible?: boolean;
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
    collapsible: true,
    items: [
      { label: 'Laporan',   to: '/laporan',          icon: ChartPieSlice },
      { label: 'Keuangan',  to: '/laporan-keuangan', icon: CurrencyCircleDollar },
    ],
  },
  {
    sectionLabel: 'FARMASI KLINIS',
    ownerOnly: true,
    collapsible: true,
    items: [
      { label: 'Konseling & PIO', to: '/konseling', icon: ChatCircleText },
      { label: 'Racikan',         to: '/racikan',    icon: Flask },
      { label: 'MESO',            to: '/meso',       icon: Warning },
    ],
  },
  {
    sectionLabel: 'KEPATUHAN',
    ownerOnly: true,
    collapsible: true,
    items: [
      { label: 'SIPNAP',          to: '/sipnap',                   icon: FileText },
      { label: 'Buku Harian',     to: '/buku-harian-narkotika',    icon: Book },
      { label: 'Pemusnahan Obat', to: '/pemusnahan-obat',          icon: Trash },
    ],
  },
  {
    sectionLabel: 'MANAJEMEN',
    ownerOnly: true,
    collapsible: true,
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

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 py-2 mx-2 rounded-lg text-[13px] transition-colors duration-150',
        collapsed ? 'justify-center px-2.5' : 'px-3',
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-medium'
          : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-200'
      )}
    >
      <Icon
        weight={isActive ? 'fill' : 'regular'}
        className="w-[18px] h-[18px] shrink-0"
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function SidebarNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const isOwner = profile?.role === 'owner';

  const checkActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // Collapsible section state — auto-expand section if it contains the active route
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const pathname = location.pathname;
    navSections.forEach(section => {
      if (section.sectionLabel && section.collapsible) {
        const hasActiveChild = section.items.some(item =>
          item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
        );
        initial[section.sectionLabel] = hasActiveChild;
      }
    });
    return initial;
  });

  const toggleSection = useCallback((label: string) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
  }, []);

  // Auto-expand section when navigating to one of its child routes
  useEffect(() => {
    navSections.forEach(section => {
      if (section.sectionLabel && section.collapsible) {
        const hasActiveChild = section.items.some(item => checkActive(item.to));
        if (hasActiveChild) {
          setExpandedSections(prev => {
            if (prev[section.sectionLabel!]) return prev;
            return { ...prev, [section.sectionLabel!]: true };
          });
        }
      }
    });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="hidden lg:block">
      {/* Sidebar starts below TopNavigation — no z-index collision */}
      <div
        className={cn(
          'fixed top-[57px] left-0 h-[calc(100vh-57px)] z-40',
          'bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col',
          'transition-[width] duration-200 overflow-hidden',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar" aria-label="Menu utama">
          {navSections.map((section, si) => {
            if (section.ownerOnly && !isOwner) return null;

            const isCollapsible = section.collapsible && section.sectionLabel && !collapsed;
            const isExpanded = section.sectionLabel ? expandedSections[section.sectionLabel] ?? false : true;
            const hasActiveChild = section.items.some(item => checkActive(item.to));

            return (
              <div key={si} className={si > 0 ? 'mt-1' : ''}>
                {!collapsed && section.sectionLabel && (
                  isCollapsible ? (
                    <button
                      onClick={() => toggleSection(section.sectionLabel!)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 pt-3 pb-1 select-none group',
                        'hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors rounded-md mx-0'
                      )}
                    >
                      <span className={cn(
                        'text-[10px] font-semibold uppercase tracking-widest',
                        hasActiveChild
                          ? 'text-indigo-500 dark:text-indigo-400'
                          : 'text-gray-400 dark:text-zinc-500'
                      )}>
                        {section.sectionLabel}
                      </span>
                      <CaretDown
                        weight="bold"
                        className={cn(
                          'w-3 h-3 text-gray-400 dark:text-zinc-500 transition-transform duration-200',
                          isExpanded ? '' : '-rotate-90'
                        )}
                      />
                    </button>
                  ) : (
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest select-none">
                      {section.sectionLabel}
                    </p>
                  )
                )}
                {collapsed && si > 0 && (
                  <div className="mx-3 my-2 h-px bg-gray-100 dark:bg-zinc-800" />
                )}
                <div
                  className={cn(
                    'space-y-0.5 overflow-hidden transition-all duration-200',
                    isCollapsible && !isExpanded ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
                  )}
                >
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      item={item}
                      isActive={checkActive(item.to)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom items + collapse toggle */}
        <div className="pb-3 border-t border-gray-100 dark:border-zinc-800 pt-2 space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              isActive={checkActive(item.to)}
              collapsed={collapsed}
            />
          ))}

          <button
            onClick={toggle}
            aria-label={collapsed ? 'Perluas sidebar' : 'Kecilkan sidebar'}
            title={collapsed ? 'Perluas sidebar' : 'Kecilkan sidebar'}
            className={cn(
              'flex items-center gap-3 py-2 mx-2 rounded-lg text-[13px]',
              'text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300',
              'transition-colors duration-150 w-[calc(100%-16px)]',
              collapsed ? 'justify-center px-2.5' : 'px-3'
            )}
          >
            {collapsed ? (
              <ArrowLineRight weight="bold" className="w-[18px] h-[18px] shrink-0" />
            ) : (
              <>
                <ArrowLineLeft weight="bold" className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">Kecilkan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
