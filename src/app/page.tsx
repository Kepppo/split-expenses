'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Tag, HandCoins, ArrowRight, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
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

  const features = [
    {
      icon: Users,
      title: 'Real groups, real people',
      desc: 'Invite the actual people you split with by email. Everyone sees their own balance from their own account.',
    },
    {
      icon: Tag,
      title: 'Category splits',
      desc: 'Organize expenses by category with equal, percentage, or fixed split rules.',
    },
    {
      icon: HandCoins,
      title: 'Settle up',
      desc: 'Record a payment and it nets against the balance immediately — no more guessing who\'s even.',
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden">
      <Navbar />

      <main className="relative">
        {/* Background blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="blob absolute -top-40 -right-40 h-[500px] w-[500px] bg-primary/30 animate-float" />
          <div className="blob absolute top-60 -left-20 h-[400px] w-[400px] bg-accent/30 animate-float" style={{ animationDelay: '2s' }} />
          <div className="blob absolute bottom-0 right-1/4 h-[300px] w-[300px] bg-primary/20 animate-float" style={{ animationDelay: '4s' }} />
        </div>

        {/* Hero */}
        <div className="relative">
          <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 lg:pt-32 lg:pb-28">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Open source &middot; Free forever
              </div>
              <h1 className="font-heading text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl lg:text-7xl">
                Split expenses
                <br />
                <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  without the awkward math
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-lg text-base text-ink-muted sm:text-lg md:mt-8 md:max-w-xl">
                Real people, real groups, real balances — track who paid, who owes, and settle up when it&apos;s time.
              </p>
              <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-glow transition-all duration-200 hover:bg-primary-dark hover:shadow-glow-lg hover:-translate-y-0.5 md:px-10 md:text-lg"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-rule bg-surface px-8 py-3.5 text-base font-semibold text-ink shadow-card transition-all duration-200 hover:bg-surface-2 hover:-translate-y-0.5 md:px-10 md:text-lg"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features - Bento Grid */}
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-rule bg-surface p-8 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
              >
                <div className="relative z-10">
                  <div className="inline-flex rounded-xl bg-primary-light p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
                </div>
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
