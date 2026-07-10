'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Expense, ExpenseSplit } from '@/types';
import { Navbar } from '@/components/Navbar';
import { PlusCircle, Wallet, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      }
    });
  }, [router]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      const { data: splitsData } = await supabase
        .from('expense_splits')
        .select('*');

      setProfiles(profilesData || []);
      setExpenses(expensesData || []);
      setSplits(splitsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalance = (profileId: string): number => {
    let balance = 0;
    for (const expense of expenses) {
      const expenseSplits = splits.filter((s) => s.expense_id === expense.id);
      const profileSplit = expenseSplits.find((s) => s.profile_id === profileId);
      if (profileSplit) {
        if (expense.profile_id === profileId) {
          balance += expense.amount - profileSplit.amount;
        } else {
          balance -= profileSplit.amount;
        }
      }
    }
    return balance;
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Overview of your shared expenses</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-md bg-indigo-100 p-3">
                <Wallet className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                <p className="text-2xl font-semibold text-gray-900">${totalExpenses.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-md bg-green-100 p-3">
                <PlusCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Profiles</p>
                <p className="text-2xl font-semibold text-gray-900">{profiles.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-md bg-blue-100 p-3">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Transactions</p>
                <p className="text-2xl font-semibold text-gray-900">{expenses.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Balances by Profile</h2>
            <Link
              href="/expenses"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Expense
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => {
              const balance = calculateBalance(profile.id);
              return (
                <div key={profile.id} className="rounded-lg bg-white p-6 shadow">
                  <h3 className="text-lg font-medium text-gray-900">{profile.name}</h3>
                  <p
                    className={`mt-2 text-2xl font-bold ${
                      balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {balance >= 0 ? '+' : ''}${balance.toFixed(2)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {balance >= 0 ? 'owed to you' : 'you owe'}
                  </p>
                </div>
              );
            })}
            {profiles.length === 0 && (
              <p className="col-span-full text-center text-gray-500">
                No profiles yet. Create your first profile to get started.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
