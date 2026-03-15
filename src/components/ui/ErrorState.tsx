import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { WarningCircle, ArrowClockwise } from '@phosphor-icons/react';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Terjadi Kesalahan',
  description = 'Gagal memuat data. Silakan coba lagi.',
  onRetry,
  icon,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center mb-3">
        {icon ?? <WarningCircle weight="fill" className="w-5 h-5 text-red-500 dark:text-red-400" />}
      </div>
      <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm mb-4">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ArrowClockwise className="w-4 h-4" />
          Coba Lagi
        </button>
      )}
    </div>
  );
}
