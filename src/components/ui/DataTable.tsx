import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const DataTable = forwardRef<HTMLDivElement, DataTableProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden',
        className
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
);
DataTable.displayName = 'DataTable';

const DataTableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        'bg-gray-50/80 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800',
        className
      )}
      {...props}
    />
  )
);
DataTableHeader.displayName = 'DataTableHeader';

const DataTableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors',
        className
      )}
      {...props}
    />
  )
);
DataTableRow.displayName = 'DataTableRow';

const DataTableHead = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap',
        className
      )}
      {...props}
    />
  )
);
DataTableHead.displayName = 'DataTableHead';

const DataTableCell = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-4 py-2.5 text-gray-700 dark:text-zinc-300 whitespace-nowrap',
        className
      )}
      {...props}
    />
  )
);
DataTableCell.displayName = 'DataTableCell';

export { DataTable, DataTableHeader, DataTableRow, DataTableHead, DataTableCell };
