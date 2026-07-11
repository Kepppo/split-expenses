'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Wallet, Users, Tag, Receipt, ScrollText, LogOut, Menu, X } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Wallet },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/activity', label: 'Activity', icon: ScrollText },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                SplitExpenses
              </Link>
            </div>
            {user && !isAuthPage && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'inline-flex items-center px-1 pt-1 text-sm font-medium',
                        isActive
                          ? 'border-b-2 border-indigo-500 text-gray-900'
                          : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      )}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              !isAuthPage && (
                <div className="flex items-center gap-4">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Get started
                  </Link>
                </div>
              )
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t sm:hidden">
          {user && !isAuthPage && (
            <div className="space-y-1 pb-3 pt-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center px-4 py-2 text-base font-medium',
                      isActive
                        ? 'border-l-4 border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-l-4 border-transparent text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
          <div className="border-t px-4 py-3">
            {user ? (
              <div className="space-y-3">
                <span className="block text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              !isAuthPage && (
                <div className="flex flex-col gap-3">
                  <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex w-fit items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Get started
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
