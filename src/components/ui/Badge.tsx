import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-medium transition-colors',
  {
    variants: {
      variant: {
        neutral: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300',
        success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
        error: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
        info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px] rounded',
        md: 'px-2 py-0.5 text-xs rounded-md',
        lg: 'px-2.5 py-1 text-xs rounded-md',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
  );
}
