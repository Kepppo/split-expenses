import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

const ACTION_CLASS =
  'mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg';

/** Friendly empty state with icon, copy, and a single primary action. */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-rule bg-surface-2 px-6 py-16 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-xl bg-primary-light text-primary">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action?.href ? (
        <Link href={action.href} className={ACTION_CLASS}>
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <button type="button" onClick={action.onClick} className={ACTION_CLASS}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
