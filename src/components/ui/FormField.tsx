import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: FormFieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-gray-500 dark:text-zinc-500">{hint}</p>
      )}
    </div>
  );
}
