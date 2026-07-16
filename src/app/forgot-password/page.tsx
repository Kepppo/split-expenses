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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-rule bg-surface p-8 shadow-card">
        <Link
          href="/login"
          className="absolute right-4 top-4 rounded-lg p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-ink-muted">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-primary-light p-4 text-sm text-primary">
              If an account exists for {email}, a password reset link is on its way. Check your inbox
              (and spam folder).
            </div>
            <p className="text-center text-sm text-ink-muted">
              <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-danger-light p-4 text-sm text-danger">{error}</div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-ink-muted">
              Remembered it?{' '}
              <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
