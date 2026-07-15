'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ledger-paper px-4">
      <div className="relative w-full max-w-md space-y-8 rounded-lg bg-ledger-card p-8 shadow-card">
        <Link
          href="/login"
          className="absolute right-4 top-4 rounded-md p-1 text-ledger-ink-muted hover:bg-ledger-paper hover:text-ledger-ink-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-ledger-ink">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-ledger-ink-muted">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-md bg-ledger-teal-light p-4 text-sm text-ledger-teal-dark">
              If an account exists for {email}, a password reset link is on its way. Check your inbox
              (and spam folder).
            </div>
            <p className="text-center text-sm text-ledger-ink-muted">
              <Link href="/login" className="font-medium text-ledger-teal hover:text-ledger-teal-dark">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-ledger-red-light p-4 text-sm text-ledger-red">{error}</div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ledger-ink">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ledger-rule px-3 py-2 shadow-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md border border-transparent bg-ledger-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ledger-teal-dark focus:outline-none focus:ring-2 focus:ring-ledger-teal focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-ledger-ink-muted">
              Remembered it?{' '}
              <Link href="/login" className="font-medium text-ledger-teal hover:text-ledger-teal-dark">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
