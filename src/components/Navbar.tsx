'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Wallet, Users, Tag, Receipt, ScrollText, LogOut } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Wallet },
  { href: '/profiles', label: 'Profiles', icon: Users },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/activity', label: 'Activity', icon: ScrollText },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
          <div className="flex items-center gap-4">
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
        </div>
      </div>
    </nav>
  );
}
