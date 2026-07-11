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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Settle Up</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">I paid</label>
            <select
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              {others.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Cash, Bizum, bank transfer"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
