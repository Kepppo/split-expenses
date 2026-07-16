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
            'w-full appearance-none cursor-pointer rounded-xl border border-rule bg-surface px-3.5 py-2.5 pr-9 text-sm text-ink shadow-sm transition-all duration-200',
            'hover:border-primary/40 hover:shadow-card',
            'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      </div>
    );
  }
);

Select.displayName = 'Select';
