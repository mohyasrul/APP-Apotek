import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6', className)}>
      <div>
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-500 dark:text-zinc-400 mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
