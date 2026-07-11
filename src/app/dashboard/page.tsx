'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, GroupMember, Expense, ExpenseSplit, Settlement } from '@/types';
import { calculateNetBalances, simplifyDebts } from '@/lib/balances';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { PlusCircle, Wallet, Receipt, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GroupSummary {
  group: Group;
  members: AppUser[];
  myBalance: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<GroupSummary[]>([]);
  const [totalExpenseCount, setTotalExpenseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUserId(user.id);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchData();

    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchData = async () => {
    try {
      const { data: groupsData } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
      const groups: Group[] = groupsData || [];

      let expenseCount = 0;
      const results: GroupSummary[] = [];

      for (const group of groups) {
        const { data: membersData } = await supabase.from('group_members').select('*').eq('group_id', group.id);
        const memberRows: GroupMember[] = membersData || [];
        const memberIds = memberRows.map((m) => m.user_id);

        const { data: usersData } = memberIds.length
          ? await supabase.from('users').select('*').in('id', memberIds)
          : { data: [] };

        const { data: expensesData } = await supabase.from('expenses').select('*').eq('group_id', group.id);
        const expenses: Expense[] = expensesData || [];
        expenseCount += expenses.length;

        const expenseIds = expenses.map((e) => e.id);
        const { data: splitsData } = expenseIds.length
          ? await supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
          : { data: [] };

        const { data: settlementsData } = await supabase.from('settlements').select('*').eq('group_id', group.id);

        const net = calculateNetBalances(
          memberIds,
          expenses,
          (splitsData || []) as ExpenseSplit[],
          (settlementsData || []) as Settlement[]
        );

        results.push({
          group,
          members: usersData || [],
          myBalance: net[currentUserId!] ?? 0,
        });
      }

      setSummaries(results);
      setTotalExpenseCount(expenseCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const totalOwedToMe = summaries.reduce((sum, s) => sum + Math.max(s.myBalance, 0), 0);
  const totalIOwe = summaries.reduce((sum, s) => sum + Math.max(-s.myBalance, 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-ledger-paper">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-ledger-ink-muted">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ledger-paper">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-ledger-ink">Dashboard</h1>
          <p className="mt-2 text-ledger-ink-muted">Overview of your shared expenses</p>
        </div>

        {error && (
          <div className="mb-4 rounded-sm bg-ledger-red-light p-4 text-sm text-ledger-red">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-sm bg-ledger-card p-6 border border-ledger-rule">
            <div className="flex items-center">
              <div className="rounded-sm bg-ledger-teal-light p-3">
                <Wallet className="h-6 w-6 text-ledger-teal" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">Owed to you</p>
                <Money amount={totalOwedToMe} className="text-2xl" />
              </div>
            </div>
          </div>

          <div className="rounded-sm bg-ledger-card p-6 border border-ledger-rule">
            <div className="flex items-center">
              <div className="rounded-sm bg-ledger-red-light p-3">
                <Wallet className="h-6 w-6 text-ledger-red" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">You owe</p>
                <Money amount={-totalIOwe} className="text-2xl" />
              </div>
            </div>
          </div>

          <div className="rounded-sm bg-ledger-card p-6 border border-ledger-rule">
            <div className="flex items-center">
              <div className="rounded-sm bg-ledger-teal-light p-3">
                <Users className="h-6 w-6 text-ledger-teal" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">Groups</p>
                <p className="font-mono text-2xl font-medium text-ledger-ink">{summaries.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-sm bg-ledger-card p-6 border border-ledger-rule">
            <div className="flex items-center">
              <div className="rounded-sm bg-ledger-paper p-3">
                <Receipt className="h-6 w-6 text-ledger-ink-muted" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">Transactions</p>
                <p className="font-mono text-2xl font-medium text-ledger-ink">{totalExpenseCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-ledger-ink">Your Groups</h2>
            <Link
              href="/expenses"
              className="inline-flex items-center rounded-sm bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Expense
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map(({ group, members, myBalance }) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="rounded-sm bg-ledger-card p-6 border border-ledger-rule hover:border-ledger-teal"
              >
                <h3 className="font-serif text-lg font-semibold text-ledger-ink">{group.name}</h3>
                <p className="mt-1 text-sm text-ledger-ink-muted">{members.length} member{members.length === 1 ? '' : 's'}</p>
                <Money amount={myBalance} className="mt-3 block text-2xl" />
                <p className="mt-1 text-sm text-ledger-ink-muted">
                  {myBalance >= 0 ? 'owed to you' : 'you owe'}
                </p>
              </Link>
            ))}
            {summaries.length === 0 && (
              <p className="col-span-full text-center text-ledger-ink-muted">
                No groups yet.{' '}
                <Link href="/groups" className="text-ledger-teal hover:underline">Create your first group</Link>{' '}
                to get started.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
