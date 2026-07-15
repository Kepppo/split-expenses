'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The Supabase client automatically parses the recovery token out of the
    // URL and fires this event once a temporary recovery session is ready.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // If the tab was already open / event already fired before we
    // subscribed, fall back to checking for an existing session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        // Give the URL-parsing a moment before deciding the link is bad.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s2 } }) => {
            if (s2) setReady(true);
            else setInvalidLink(true);
          });
        }, 1500);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ledger-paper px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-ledger-card p-8 shadow-card">
        <h2 className="text-center text-3xl font-bold tracking-tight text-ledger-ink">
          Set a new password
        </h2>

        {invalidLink && (
          <div className="space-y-4">
            <div className="rounded-md bg-ledger-red-light p-4 text-sm text-ledger-red">
              This reset link is invalid or has expired. Request a new one.
            </div>
            <Link
              href="/forgot-password"
              className="flex w-full justify-center rounded-md border border-transparent bg-ledger-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ledger-teal-dark"
            >
              Request a new link
            </Link>
          </div>
        )}

        {!invalidLink && !ready && (
          <p className="text-center text-sm text-ledger-ink-muted">Verifying your reset link...</p>
        )}

        {ready && !done && (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-ledger-red-light p-4 text-sm text-ledger-red">{error}</div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ledger-ink">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ledger-rule px-3 py-2 shadow-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ledger-ink">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ledger-rule px-3 py-2 shadow-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md border border-transparent bg-ledger-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ledger-teal-dark focus:outline-none focus:ring-2 focus:ring-ledger-teal focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}

        {done && (
          <div className="rounded-md bg-ledger-teal-light p-4 text-sm text-ledger-teal-dark">
            Password updated. Taking you to your dashboard...
          </div>
        )}
      </div>
    </div>
  );
}
