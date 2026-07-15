'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Tag, HandCoins } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LedgerCard } from '@/components/LedgerCard';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard');
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen">
        <Navbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-ledger-ink-muted">
              A shared ledger, kept honest
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-ledger-ink sm:text-5xl md:text-6xl">
              <span className="block">Split expenses</span>
              <span className="block text-ledger-teal">without the awkward math</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base text-ledger-ink-muted sm:text-lg md:mt-5 md:max-w-xl">
              Real people, real groups, real balances — track who paid, who owes, and settle up when it&apos;s time.
            </p>
            <div className="mx-auto mt-8 max-w-md sm:flex sm:justify-center">
              <Link
                href="/signup"
                className="flex items-center justify-center rounded-md border border-transparent bg-ledger-teal px-8 py-3 text-base font-medium text-white hover:bg-ledger-teal-dark md:py-4 md:px-10 md:text-lg"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="mt-3 flex items-center justify-center rounded-md border border-ledger-rule bg-ledger-card px-8 py-3 text-base font-medium text-ledger-teal hover:bg-ledger-paper sm:mt-0 sm:ml-3 md:py-4 md:px-10 md:text-lg"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="mt-24 grid grid-cols-1 gap-6 md:grid-cols-3">
            <LedgerCard ruled={false} className="text-center">
              <Users className="mx-auto h-10 w-10 text-ledger-teal" />
              <h3 className="mt-4 font-serif text-lg font-semibold text-ledger-ink">Real groups, real people</h3>
              <p className="mt-2 text-sm text-ledger-ink-muted">
                Invite the actual people you split with by email. Everyone sees their own balance from their own account.
              </p>
            </LedgerCard>
            <LedgerCard ruled={false} className="text-center">
              <Tag className="mx-auto h-10 w-10 text-ledger-teal" />
              <h3 className="mt-4 font-serif text-lg font-semibold text-ledger-ink">Category splits</h3>
              <p className="mt-2 text-sm text-ledger-ink-muted">
                Organize expenses by category with equal, percentage, fixed, or custom split rules.
              </p>
            </LedgerCard>
            <LedgerCard ruled={false} className="text-center">
              <HandCoins className="mx-auto h-10 w-10 text-ledger-teal" />
              <h3 className="mt-4 font-serif text-lg font-semibold text-ledger-ink">Settle up</h3>
              <p className="mt-2 text-sm text-ledger-ink-muted">
                Record a payment and it nets against the balance immediately — no more guessing who&apos;s even.
              </p>
            </LedgerCard>
          </div>
        </div>
      </main>
    </div>
  );
}
