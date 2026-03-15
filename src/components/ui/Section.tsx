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
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
);

Section.displayName = 'Section';

export { Section };
