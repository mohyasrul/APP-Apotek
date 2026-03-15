import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold transition-colors',
  {
    variants: {
      variant: {
        neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        success: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
        warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
        error: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
        info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px] rounded-md',
        md: 'px-2 py-0.5 text-xs rounded-lg',
        lg: 'px-2.5 py-1 text-xs rounded-lg',
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
