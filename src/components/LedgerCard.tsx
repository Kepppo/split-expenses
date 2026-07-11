import { ReactNode } from 'react';

interface LedgerCardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  ruled?: boolean;
}

/** A card styled like a torn ledger page: perforated top edge, optional ruled lines. */
export function LedgerCard({ title, eyebrow, children, className = '', ruled = true }: LedgerCardProps) {
  return (
    <div className={`relative rounded-sm px-6 pb-6 pt-6 ${ruled ? 'ledger-ruled' : 'bg-ledger-card'} ${className}`}>
      <div className="ledger-perforation">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>
      {eyebrow && (
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ledger-ink-muted">{eyebrow}</p>
      )}
      {title && <h3 className="mb-3 font-serif text-lg font-semibold text-ledger-ink">{title}</h3>}
      {children}
    </div>
  );
}

/** A dollar amount set in mono, right-aligned. Balances are ink-colored by sign; pass `neutral` for plain amounts. */
export function Money({ amount, neutral = false, className = '' }: { amount: number; neutral?: boolean; className?: string }) {
  if (neutral) {
    return (
      <span className={`font-mono font-medium tabular-nums text-ledger-ink ${className}`}>
        ${Math.abs(amount).toFixed(2)}
      </span>
    );
  }
  const color = amount > 0 ? 'text-ledger-teal' : amount < 0 ? 'text-ledger-red' : 'text-ledger-ink-muted';
  const sign = amount > 0 ? '+' : amount < 0 ? '\u2212' : '';
  return (
    <span className={`font-mono font-medium tabular-nums ${color} ${className}`}>
      {sign}${Math.abs(amount).toFixed(2)}
    </span>
  );
}
