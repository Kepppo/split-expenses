'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, GroupMember, Expense, ExpenseSplit, Settlement } from '@/types';
import { calculateNetBalances, simplifyDebts } from '@/lib/balances';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { Avatar, AvatarStack } from '@/components/Avatar';
import { SettleUpModal } from '@/components/SettleUpModal';
import { PlusCircle, Wallet, Users, CalendarDays, HandCoins, ArrowUpRight, ArrowDownRight, Edit, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CURRENCIES } from '@/lib/utils';
import { Select } from '@/components/Select';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState('EUR');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
      } else {
        router.push('/login');
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

        const { data: usersData } = await supabase.from('users').select('*').in('id', memberIds);
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
          const expense = expenses.find((e) => e.id === s.expense_id);
          events.push({
            id: `settlement-${s.id}`,
            type: 'settlement',
            groupId: group.id,
            groupName: group.name,
            label: expense
              ? `${getName(s.paid_by)} paid ${getName(s.paid_to)} for "${expense.description}" in ${group.name}`
              : `${getName(s.paid_by)} paid ${getName(s.paid_to)} in ${group.name}`,
            amount: s.amount,
            currency: group.currency,
            createdAt: s.created_at,
          });
        }
      }

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

  const startEdit = (group: Group) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditCurrency(group.currency);
  };

  const saveEdit = async (groupId: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('groups').update({
      name: editName.trim(),
      currency: editCurrency,
    }).eq('id', groupId);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    fetchData();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCurrency('EUR');
  };

  const totalOwedToMe = summaries.reduce((sum, s) => sum + Math.max(s.myBalance, 0), 0);
  const totalIOwe = summaries.reduce((sum, s) => sum + Math.max(-s.myBalance, 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-ink-muted">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
            <p className="mt-2 text-ink-muted">Overview of your shared expenses</p>
          </div>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg"
          >
            <PlusCircle className="h-4 w-4" />
            Add Expense
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-light p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Bento Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-rule bg-surface p-6 shadow-card lg:col-span-1">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <ArrowDownRight className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-ink-muted">Owed to you</p>
                <Money amount={totalOwedToMe} className="text-2xl font-bold" />
              </div>
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-rule bg-surface p-6 shadow-card lg:col-span-1">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-light text-danger">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-ink-muted">You owe</p>
                <Money amount={-totalIOwe} className="text-2xl font-bold" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-ink-muted">Groups</p>
                <p className="text-2xl font-bold text-ink">{summaries.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-ink-muted">Spent this month</p>
                <Money amount={monthSpend} neutral className="text-2xl font-bold" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold text-ink">Your Groups</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {summaries.map((summary) => {
                  const { group, members, myBalance, myTopCreditor } = summary;
                  return (
                    <div
                      key={group.id}
                      className="group relative overflow-hidden rounded-2xl border border-rule bg-surface p-6 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5"
                    >
                      {editingId === group.id ? (
                        <div className="relative z-10 space-y-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-xl border border-rule bg-surface-2 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            autoFocus
                          />
                          <Select
                            value={editCurrency}
                            onChange={(e) => setEditCurrency(e.target.value)}
                            className="w-full"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                            ))}
                          </Select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(group.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              <Check className="h-3.5 w-3.5" /> Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Link href={`/groups/${group.id}`} className="block">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-heading text-lg font-semibold text-ink">{group.name}</h3>
                                <p className="mt-1 text-sm text-ink-muted">
                                  {members.length} member{members.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              <AvatarStack users={members} max={3} />
                            </div>
                            <Money amount={myBalance} currency={summary.group.currency} className="mt-3 block text-2xl font-bold" />
                            <p className="mt-1 text-sm text-ink-muted">
                              {myBalance >= 0 ? 'owed to you' : 'you owe'}
                            </p>
                          </Link>
                          <div className="relative z-10 mt-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            {myTopCreditor && (
                              <button
                                onClick={() => setSettleTarget(summary)}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg"
                              >
                                <HandCoins className="h-4 w-4" />
                                Settle up
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.preventDefault(); startEdit(group); }}
                              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
                        </>
                      )}
                    </div>
                  );
                })}
              {summaries.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-rule bg-surface-2 px-6 py-12 text-center">
                  <p className="text-ink-muted">
                    No groups yet.{' '}
                    <Link href="/groups" className="text-primary hover:text-primary-dark">Create your first group</Link>{' '}
                    to get started.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-ink">Recent Activity</h2>
            <div className="mt-4 rounded-2xl border border-rule bg-surface p-6 shadow-card">
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/groups/${event.groupId}`}
                    className="flex items-start justify-between gap-3 border-b border-rule pb-3 last:border-0 last:pb-0 transition-colors hover:bg-surface-2 -mx-2 px-2 rounded-xl"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{event.label}</p>
                      <p className="text-xs text-ink-muted">{timeAgo(event.createdAt)}</p>
                    </div>
                    <Money amount={event.amount} currency={event.currency} neutral className="shrink-0 text-sm font-medium" />
                  </Link>
                ))}
                {recentEvents.length === 0 && (
                  <p className="text-sm text-ink-muted">Nothing recorded yet.</p>
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
