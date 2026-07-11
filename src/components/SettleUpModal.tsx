'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser } from '@/types';
import { X } from 'lucide-react';

interface SettleUpModalProps {
  groupId: string;
  currentUserId: string;
  members: AppUser[];
  defaultPayTo?: string;
  defaultAmount?: number;
  onClose: () => void;
  onSettled: () => void;
}

export function SettleUpModal({
  groupId,
  currentUserId,
  members,
  defaultPayTo,
  defaultAmount,
  onClose,
  onSettled,
}: SettleUpModalProps) {
  const others = members.filter((m) => m.id !== currentUserId);
  const [paidTo, setPaidTo] = useState(defaultPayTo || others[0]?.id || '');
  const [amount, setAmount] = useState(defaultAmount ? defaultAmount.toFixed(2) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stamped, setStamped] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-sm bg-ledger-card p-6 shadow-xl">
        {stamped && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-ledger-card/70">
            <div className="animate-stamp rounded border-4 border-ledger-brass px-6 py-2 font-mono text-2xl font-medium uppercase tracking-widest text-ledger-brass">
              Paid
            </div>
          </div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-ledger-ink">Settle Up</h2>
          <button onClick={onClose} className="rounded-sm p-1 text-ledger-ink-muted hover:bg-ledger-paper">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-sm bg-ledger-red-light p-3 text-sm text-ledger-red">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ledger-ink">I paid</label>
            <select
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              required
              className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
            >
              {others.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ledger-ink">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ledger-ink">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ledger-ink">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Cash, Bizum, bank transfer"
              className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-sm bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-sm border border-ledger-rule bg-ledger-card px-4 py-2 text-sm font-medium text-ledger-ink hover:bg-ledger-paper"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
