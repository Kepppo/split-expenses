import { ReactNode } from 'react';
import { formatMoney } from '@/lib/utils';

interface LedgerCardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  ruled?: boolean;
}

/** A card styled like a torn ledger page: perforated top edge, optional ruled lines. */
export function LedgerCard({ title, eyebrow, children, className = '', ruled = false }: LedgerCardProps) {
  return (
    <div
      className={cnLedgerCard(ruled, className)}
    >
      {ruled && (
        <div className="ledger-perforation">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
      )}
      {eyebrow && (
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ledger-ink-muted">{eyebrow}</p>
      )}
      {title && <h3 className="mb-3 font-serif text-lg font-semibold text-ledger-ink">{title}</h3>}
      {children}
    </div>
  );
}

function cnLedgerCard(ruled: boolean, className: string) {
  const base = 'relative px-6 pb-6 pt-6 shadow-card-sm';
  if (ruled) return `${base} ledger-ruled ${className}`;
  return `${base} rounded-lg bg-ledger-card border border-ledger-rule ${className}`;
}

/** A currency amount set in mono, right-aligned. Balances are colored by sign; pass `neutral` for plain amounts. */
export function Money({
  amount,
  neutral = false,
  currency = 'USD',
  className = '',
}: {
  amount: number;
  neutral?: boolean;
  currency?: string;
  className?: string;
}) {
  if (neutral) {
    return (
      <span className={`font-mono font-medium tabular-nums text-ledger-ink ${className}`}>
        {formatMoney(Math.abs(amount), currency)}
      </span>
    );
  }
  const color = amount > 0 ? 'text-ledger-teal' : amount < 0 ? 'text-ledger-red' : 'text-ledger-ink-muted';
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return (
    <span className={`font-mono font-medium tabular-nums ${color} ${className}`}>
      {sign}
      {formatMoney(Math.abs(amount), currency)}
    </span>
  );
}
