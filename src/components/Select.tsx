import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

/** Native <select> with a modern, theme-aware trigger (custom chevron, no native chrome). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', wrapperClassName = '', children, ...props }, ref) => {
    return (
      <div className={cn('relative', wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            'w-full appearance-none cursor-pointer rounded-md border border-ledger-rule bg-ledger-surface-2 px-3.5 py-2 pr-9 text-sm text-ledger-ink',
            'transition-all duration-200 hover:border-ledger-ink-muted hover:shadow-sm',
            'focus-visible:border-ledger-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-teal/40 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-ink-muted" />
      </div>
    );
  }
);

Select.displayName = 'Select';
