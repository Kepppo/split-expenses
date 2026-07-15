'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function AcceptInvitePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const inviteId = params.id;
  const [state, setState] = useState<'checking' | 'joining' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) router.replace(`/signup?invite=${inviteId}`);
        return;
      }

      setState('joining');
      const { error } = await supabase.rpc('accept_group_invite', { _invite_id: inviteId });
      if (cancelled) return;

      if (error) {
        setState('error');
        setMessage(error.message);
        return;
      }

      setState('done');
      setTimeout(() => router.replace('/dashboard'), 900);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteId, router]);

  return (
    <div className="min-h-screen bg-ledger-paper">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        {state === 'checking' || state === 'joining' ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-ledger-teal" />
            <p className="mt-4 text-ledger-ink-muted">
              {state === 'joining' ? 'Joining group…' : 'Checking invitation…'}
            </p>
          </>
        ) : state === 'done' ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-ledger-teal" />
            <h1 className="mt-4 font-serif text-2xl font-semibold text-ledger-ink">You&apos;re in!</h1>
            <p className="mt-1 text-ledger-ink-muted">Taking you to your groups…</p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-ledger-red" />
            <h1 className="mt-4 font-serif text-2xl font-semibold text-ledger-ink">Couldn&apos;t join</h1>
            <p className="mt-1 text-ledger-ink-muted">{message || 'This invite may have expired or already been used.'}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 rounded-md bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark"
            >
              Go to dashboard
            </button>
          </>
        )}
      </main>
    </div>
  );
}
