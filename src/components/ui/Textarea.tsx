import { forwardRef, type TextareaHTMLAttributes, useId } from 'react';
import { cn } from '../../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id: propId, ...props }, ref) => {
    const autoId = useId();
    const id = propId ?? autoId;
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150 min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600',
            'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
            error
              ? 'border-red-300 dark:border-red-700'
              : 'border-gray-300 dark:border-zinc-600',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-red-500 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-gray-500 dark:text-zinc-500">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
