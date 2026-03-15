import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-gray-400 dark:text-zinc-500">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
