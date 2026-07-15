'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, GroupMember, Expense, ExpenseSplit, Settlement } from '@/types';
import { calculateNetBalances, simplifyDebts } from '@/lib/balances';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { AvatarStack } from '@/components/Avatar';
import { SettleUpModal } from '@/components/SettleUpModal';
import { PlusCircle, Wallet, Users, CalendarDays, HandCoins } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GroupSummary {
  group: Group;
  members: AppUser[];
  myBalance: number;
  myTopCreditor?: { id: string; amount: number };
}

interface RecentEvent {
  id: string;
  type: 'expense' | 'settlement';
  groupId: string;
  groupName: string;
  label: string;
  amount: number;
  currency: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<GroupSummary[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [monthSpend, setMonthSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<GroupSummary | null>(null);

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

      const results: GroupSummary[] = [];
      const events: RecentEvent[] = [];
      const now = new Date();
      let spend = 0;

      for (const group of groups) {
        const { data: membersData } = await supabase.from('group_members').select('*').eq('group_id', group.id);
        const memberRows: GroupMember[] = membersData || [];
        const memberIds = memberRows.map((m) => m.user_id);

        const { data: usersData } = memberIds.length
          ? await supabase.from('users').select('*').in('id', memberIds)
          : { data: [] };
        const users: AppUser[] = usersData || [];

        const { data: expensesData } = await supabase.from('expenses').select('*').eq('group_id', group.id);
        const expenses: Expense[] = expensesData || [];

        const expenseIds = expenses.map((e) => e.id);
        const { data: splitsData } = expenseIds.length
          ? await supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
          : { data: [] };

        const { data: settlementsData } = await supabase.from('settlements').select('*').eq('group_id', group.id);
        const settlements: Settlement[] = (settlementsData || []) as Settlement[];

        const net = calculateNetBalances(memberIds, expenses, (splitsData || []) as ExpenseSplit[], settlements);
        const debts = simplifyDebts(net);
        const myDebt = debts.find((d) => d.from === currentUserId);

        results.push({
          group,
          members: users,
          myBalance: net[currentUserId!] ?? 0,
          myTopCreditor: myDebt ? { id: myDebt.to, amount: myDebt.amount } : undefined,
        });

        const getName = (id: string) => users.find((u) => u.id === id)?.name || 'Someone';

        for (const e of expenses) {
          if (e.date.slice(0, 7) === now.toISOString().slice(0, 7)) {
            spend += e.amount;
          }
          events.push({
            id: `expense-${e.id}`,
            type: 'expense',
            groupId: group.id,
            groupName: group.name,
            label: `${getName(e.paid_by)} added "${e.description}" in ${group.name}`,
            amount: e.amount,
            currency: group.currency,
            createdAt: e.created_at,
          });
        }
        for (const s of settlements) {
          events.push({
            id: `settlement-${s.id}`,
            type: 'settlement',
            groupId: group.id,
            groupName: group.name,
            label: `${getName(s.paid_by)} paid ${getName(s.paid_to)} in ${group.name}`,
            amount: s.amount,
            currency: group.currency,
            createdAt: s.created_at,
          });
        }
      }

      // Priority sort: whoever needs your attention most (biggest balance
      // either direction) floats to the top, instead of oldest-group-first.
      results.sort((a, b) => Math.abs(b.myBalance) - Math.abs(a.myBalance));
      events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setSummaries(results);
      setRecentEvents(events.slice(0, 6));
      setMonthSpend(spend);
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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-ledger-ink">Dashboard</h1>
            <p className="mt-2 text-ledger-ink-muted">Overview of your shared expenses</p>
          </div>
          <Link
            href="/expenses"
            className="inline-flex items-center rounded-md bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Expense
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-ledger-red-light p-4 text-sm text-ledger-red">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg bg-ledger-card p-6 border border-ledger-rule shadow-card-sm">
            <div className="flex items-center">
              <div className="rounded-md bg-ledger-teal-light p-3">
                <Wallet className="h-6 w-6 text-ledger-teal" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">Owed to you</p>
                <Money amount={totalOwedToMe} className="text-2xl" />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-ledger-card p-6 border border-ledger-rule shadow-card-sm">
            <div className="flex items-center">
              <div className="rounded-md bg-ledger-red-light p-3">
                <Wallet className="h-6 w-6 text-ledger-red" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">You owe</p>
                <Money amount={-totalIOwe} className="text-2xl" />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-ledger-card p-6 border border-ledger-rule shadow-card-sm">
            <div className="flex items-center">
              <div className="rounded-md bg-ledger-teal-light p-3">
                <Users className="h-6 w-6 text-ledger-teal" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">Groups</p>
                <p className="font-mono text-2xl font-medium text-ledger-ink">{summaries.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-ledger-card p-6 border border-ledger-rule shadow-card-sm">
            <div className="flex items-center">
              <div className="rounded-md bg-ledger-paper p-3">
                <CalendarDays className="h-6 w-6 text-ledger-ink-muted" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-ledger-ink-muted">Spent this month</p>
                <Money amount={monthSpend} neutral className="text-2xl" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-serif text-xl font-semibold text-ledger-ink">Your Groups</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {summaries.map((summary) => {
                const { group, members, myBalance, myTopCreditor } = summary;
                return (
                  <div
                    key={group.id}
                    className="rounded-lg bg-ledger-card p-6 border border-ledger-rule shadow-card-sm hover:border-ledger-teal"
                  >
                    <Link href={`/groups/${group.id}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-serif text-lg font-semibold text-ledger-ink">{group.name}</h3>
                          <p className="mt-1 text-sm text-ledger-ink-muted">
                            {members.length} member{members.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <AvatarStack users={members} max={3} />
                      </div>
                      <Money amount={myBalance} currency={summary.group.currency} className="mt-3 block text-2xl" />
                      <p className="mt-1 text-sm text-ledger-ink-muted">
                        {myBalance >= 0 ? 'owed to you' : 'you owe'}
                      </p>
                    </Link>
                    {myTopCreditor && (
                      <button
                        onClick={() => setSettleTarget(summary)}
                        className="mt-4 inline-flex items-center rounded-md border border-ledger-teal px-3 py-1.5 text-sm font-medium text-ledger-teal hover:bg-ledger-teal-light"
                      >
                        <HandCoins className="mr-1.5 h-4 w-4" />
                        Settle up
                      </button>
                    )}
                  </div>
                );
              })}
              {summaries.length === 0 && (
                <p className="col-span-full text-center text-ledger-ink-muted">
                  No groups yet.{' '}
                  <Link href="/groups" className="text-ledger-teal hover:underline">Create your first group</Link>{' '}
                  to get started.
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-xl font-semibold text-ledger-ink">Recent Activity</h2>
            <div className="mt-4 rounded-lg bg-ledger-card p-6 border border-ledger-rule shadow-card-sm">
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/groups/${event.groupId}`}
                    className="flex items-start justify-between gap-3 border-b border-ledger-rule pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ledger-ink">{event.label}</p>
                      <p className="text-xs text-ledger-ink-muted">{timeAgo(event.createdAt)}</p>
                    </div>
                    <Money amount={event.amount} currency={event.currency} neutral className="shrink-0 text-sm" />
                  </Link>
                ))}
                {recentEvents.length === 0 && (
                  <p className="text-sm text-ledger-ink-muted">Nothing recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {settleTarget && currentUserId && (
        <SettleUpModal
          groupId={settleTarget.group.id}
          currentUserId={currentUserId}
          members={settleTarget.members}
          defaultPayTo={settleTarget.myTopCreditor?.id}
          defaultAmount={settleTarget.myTopCreditor?.amount}
          currency={settleTarget.group.currency}
          onClose={() => setSettleTarget(null)}
          onSettled={fetchData}
        />
      )}
    </div>
  );
}
