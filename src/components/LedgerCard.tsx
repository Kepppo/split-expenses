import { ReactNode } from 'react';
import { formatMoney } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LedgerCardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  glass?: boolean;
}

export function LedgerCard({ title, eyebrow, children, className = '', glass = false }: LedgerCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-rule/60 bg-surface p-6 shadow-card transition-all duration-200 hover:shadow-card-hover',
        glass && 'glass-card',
        className
      )}
    >
      {eyebrow && (
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-muted">{eyebrow}</p>
      )}
      {title && <h3 className="mb-3 font-heading text-lg font-semibold text-ink">{title}</h3>}
      {children}
    </div>
  );
}

/** A currency amount set in mono, right-aligned. Balances are colored by sign; pass `neutral` for plain amounts. */
export function Money({
  amount,
  neutral = false,
  currency = 'EUR',
  className = '',
}: {
  amount: number;
  neutral?: boolean;
  currency?: string;
  className?: string;
}) {
  if (neutral) {
    return (
      <span className={`font-mono font-medium tabular-nums text-ink ${className}`}>
        {formatMoney(Math.abs(amount), currency)}
      </span>
    );
  }
  const color = amount > 0 ? 'text-primary' : amount < 0 ? 'text-danger' : 'text-ink-muted';
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return (
    <span className={`font-mono font-medium tabular-nums ${color} ${className}`}>
      {sign}
      {formatMoney(Math.abs(amount), currency)}
    </span>
  );
}
