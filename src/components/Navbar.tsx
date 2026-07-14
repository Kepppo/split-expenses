'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AppUser } from '@/types';
import { Avatar } from '@/components/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wallet, Users, Tag, Receipt, ScrollText, Settings, LogOut } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Wallet },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/activity', label: 'Activity', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => {
      setProfile(data);
    });
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isActive = (href: string) => pathname === href;

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-ledger-rule bg-ledger-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-ledger-ink">
              Split<span className="text-ledger-teal">Expenses</span>
            </Link>

            {user && !isAuthPage && (
              <div className="ml-2 hidden items-center gap-1 md:flex">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href) ? 'text-ledger-teal' : 'text-ledger-ink-muted hover:text-ledger-ink'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    <span
                      className={cn(
                        'absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-ledger-teal transition-opacity',
                        isActive(item.href) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/settings" className="hidden items-center gap-2 sm:flex">
                  {profile && <Avatar user={profile} size="sm" />}
                  <span className="max-w-[12rem] truncate text-sm text-ledger-ink-muted">{user.email}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  className="inline-flex items-center gap-2 rounded-md border border-ledger-rule bg-ledger-card px-3 py-2 text-sm font-medium text-ledger-ink transition-colors hover:bg-ledger-paper"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              !isAuthPage && (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-ledger-ink-muted hover:text-ledger-ink"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-md bg-ledger-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ledger-teal-dark"
                  >
                    Get started
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      {user && !isAuthPage && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ledger-rule bg-ledger-card/95 backdrop-blur md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive(item.href) ? 'text-ledger-teal' : 'text-ledger-ink-muted'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
