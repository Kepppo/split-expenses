'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() || email.split('@')[0] },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setError('Account created! Please check your email to confirm your account before logging in.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ledger-paper px-4">
      <div className="relative w-full max-w-md space-y-8 rounded-lg bg-ledger-card p-8 shadow-card">
        <Link
          href="/"
          className="absolute right-4 top-4 rounded-md p-1 text-ledger-ink-muted hover:bg-ledger-paper hover:text-ledger-ink-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-ledger-ink">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          {error && (
            <div className="rounded-md bg-ledger-red-light p-4 text-sm text-ledger-red">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ledger-ink">
                Your name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What group members will see"
                className="mt-1 block w-full rounded-md border border-ledger-rule px-3 py-2 shadow-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
              />
            </div>
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ledger-ink">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ledger-rule px-3 py-2 shadow-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md border border-transparent bg-ledger-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ledger-teal-dark focus:outline-none focus:ring-2 focus:ring-ledger-teal focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
          <p className="text-center text-sm text-ledger-ink-muted">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-ledger-teal hover:text-ledger-teal-dark">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
