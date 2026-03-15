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
        'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-e1',
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
        'bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800',
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
        'border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors',
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
        'px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap',
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
        'px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap',
        className
      )}
      {...props}
    />
  )
);
DataTableCell.displayName = 'DataTableCell';

export { DataTable, DataTableHeader, DataTableRow, DataTableHead, DataTableCell };
