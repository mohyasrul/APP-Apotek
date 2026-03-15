import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
}

const Section = forwardRef<HTMLElement, SectionProps>(
  ({ className, title, description, children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('mb-6', className)}
      {...props}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
);

Section.displayName = 'Section';

export { Section };
