import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { X } from '@phosphor-icons/react';

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  className,
  ...props
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus dialog on open
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-2xl bg-white dark:bg-slate-900 shadow-e4 border border-slate-200 dark:border-slate-800 animate-zoom-in-95',
          'max-h-[90vh] flex flex-col focus:outline-none',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Header */}
        {(title || true) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X weight="bold" className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
