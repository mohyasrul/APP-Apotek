import { forwardRef, type SelectHTMLAttributes, useId } from 'react';
import { cn } from '../../lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, id: propId, children, ...props }, ref) => {
    const autoId = useId();
    const id = propId ?? autoId;
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'dark:bg-slate-900 dark:text-slate-100',
            error
              ? 'border-red-300 dark:border-red-700'
              : 'border-slate-200 dark:border-slate-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} className="text-xs text-red-500 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
