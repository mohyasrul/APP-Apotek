import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto custom-scrollbar',
        className
      )}
    >
      {items.map((item) => (
        <TabButton
          key={item.value}
          active={value === item.value}
          onClick={() => onChange(item.value)}
          role="tab"
          aria-selected={value === item.value}
        >
          {item.icon}
          {item.label}
        </TabButton>
      ))}
    </div>
  );
}

interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

function TabButton({ active, className, children, ...props }: TabButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors',
        active
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
