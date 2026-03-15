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
        'flex items-center gap-1 border-b border-gray-200 dark:border-zinc-800 pb-px overflow-x-auto custom-scrollbar',
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
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
        active
          ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-300',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
