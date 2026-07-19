'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser, Expense } from '@/types';
import { X } from 'lucide-react';
import { currencySymbol } from '@/lib/utils';
import { Select } from '@/components/Select';
import { cn } from '@/lib/utils';

interface SettleUpModalProps {
  groupId: string;
  currentUserId: string;
  members: AppUser[];
  expenses?: Expense[];
  defaultPayTo?: string;
  defaultAmount?: number;
  currency?: string;
  onClose: () => void;
  onSettled: () => void;
}

export function SettleUpModal({
  groupId,
  currentUserId,
  members,
  expenses = [],
  defaultPayTo,
  defaultAmount,
  currency = 'EUR',
  onClose,
  onSettled,
}: SettleUpModalProps) {
  const others = members.filter((m) => m.id !== currentUserId);
  const [paidTo, setPaidTo] = useState(defaultPayTo || others[0]?.id || '');
  const [amount, setAmount] = useState(defaultAmount ? defaultAmount.toFixed(2) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    if (!selectedExpenseId) return;
    const expense = expenses.find((e) => e.id === selectedExpenseId);
    if (expense) {
      setAmount(expense.amount.toFixed(2));
    }
  }, [selectedExpenseId, expenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (!paidTo || !amountNum || amountNum <= 0) {
      setError('Enter who you paid and a valid amount');
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from('settlements').insert({
      group_id: groupId,
      paid_by: currentUserId,
      paid_to: paidTo,
      amount: amountNum,
      date,
      note: note.trim() || null,
      expense_id: selectedExpenseId || null,
      created_by: currentUserId,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onSettled();
    setStamped(true);
    setTimeout(() => {
      onClose();
    }, 850);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className={cn(
        'relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-card-hover',
        stamped && 'pointer-events-none'
      )}>
        {stamped && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface/80 backdrop-blur-sm">
            <div className="animate-stamp rounded-lg border-4 border-accent bg-accent-light px-6 py-2 font-mono text-2xl font-bold uppercase tracking-widest text-accent">
              Paid
            </div>
          </div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Settle Up</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-danger-light p-3 text-sm text-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink">I paid</label>
            <Select
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              required
              className="mt-1 h-10"
            >
              {others.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">
              Amount <span className="text-ink-muted">({currencySymbol(currency)})</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 block w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 block w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {expenses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ink">Related expense (optional)</label>
              <Select
                value={selectedExpenseId}
                onChange={(e) => setSelectedExpenseId(e.target.value)}
                className="mt-1 h-10"
              >
                <option value="">— none —</option>
                {expenses.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.description} ({currencySymbol(currency)}{e.amount})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Cash, Bizum, bank transfer"
              className="mt-1 block w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-xl border border-rule bg-surface px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
