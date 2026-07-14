import { ReactNode } from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

const ACTION_CLASS =
  'mt-5 inline-flex items-center rounded-sm bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark';

/** Friendly empty state with icon, copy, and a single primary action. */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-dashed border-ledger-rule bg-surface-2 px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-lg bg-ledger-teal-light text-ledger-teal">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-lg font-semibold text-ledger-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ledger-ink-muted">{description}</p>}
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
