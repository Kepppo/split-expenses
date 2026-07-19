'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, GroupMember, GroupInvite, Expense, ExpenseSplit, Settlement } from '@/types';
import { calculateNetBalances, simplifyDebts } from '@/lib/balances';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { Avatar, AvatarStack } from '@/components/Avatar';
import { SettleUpModal } from '@/components/SettleUpModal';
import { Mail, UserMinus, HandCoins, Receipt, Plus } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const toast = useToast();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberUsers, setMemberUsers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [prefill, setPrefill] = useState<{ to?: string; amount?: number }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
      } else {
        router.push('/login');
      }
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    try {
      const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single();
      const { data: membersData } = await supabase.from('group_members').select('*').eq('group_id', groupId);
      const { data: invitesData } = await supabase
        .from('group_invites')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'pending');

      const memberIds = (membersData || []).map((m: GroupMember) => m.user_id);
      const { data: usersData } = await supabase.from('users').select('*').in('id', memberIds);

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      const expenseIds = (expensesData || []).map((e: Expense) => e.id);
      const { data: splitsData } = expenseIds.length
        ? await supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
        : { data: [] };

      const { data: settlementsData } = await supabase
        .from('settlements')
        .select('*')
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      setGroup(groupData || null);
      setMembers(membersData || []);
      setMemberUsers(usersData || []);
      setInvites(invitesData || []);
      setExpenses(expensesData || []);
      setSplits(splitsData || []);
      setSettlements(settlementsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`group-${groupId}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites', filter: `group_id=eq.${groupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchData]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inviteEmail.trim() || !currentUserId) return;

    const { data: created, error: inviteError } = await supabase.from('group_invites').insert({
      group_id: groupId,
      email: inviteEmail.trim().toLowerCase(),
      invited_by: currentUserId,
    }).select().single();

    if (inviteError) {
      setError(inviteError.message);
      return;
    }

    if (created) {
      const url = `${window.location.origin}/invite/${created.id}`;
      try {
        await navigator.clipboard.writeText(url);
        toast('Invite link copied to clipboard — share it anywhere');
      } catch {
        toast('Invite created');
      }
    }

    setInviteEmail('');
    fetchData();
  };

  const removeMember = async (memberRowId: string) => {
    await supabase.from('group_members').delete().eq('id', memberRowId);
    fetchData();
  };

  const cancelInvite = async (inviteId: string) => {
    await supabase.from('group_invites').delete().eq('id', inviteId);
    fetchData();
  };

  const getUserName = (id: string) => memberUsers.find((u) => u.id === id)?.name || 'Unknown';
  const getUser = (id: string): AppUser =>
    memberUsers.find((u) => u.id === id) || { id, email: '', name: 'Unknown', avatar_url: null, created_at: '' };

  const openSettleModal = (to?: string, amount?: number) => {
    setPrefill({ to, amount });
    setShowSettleModal(true);
  };

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

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-ink-muted">Group not found, or you&apos;re not a member.</p>
        </main>
      </div>
    );
  }

  const memberIds = members.map((m) => m.user_id);
  const netBalances = calculateNetBalances(memberIds, expenses, splits, settlements);
  const debts = simplifyDebts(netBalances);
  const myDebts = currentUserId ? debts.filter((d) => d.from === currentUserId || d.to === currentUserId) : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">{group.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <AvatarStack users={memberUsers} />
              <p className="text-sm text-ink-muted">{members.length} member{members.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/expenses?group=${groupId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-rule bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-card transition-colors hover:bg-surface-2"
            >
              <Receipt className="h-4 w-4" />
              View Expenses
            </Link>
            <button
              onClick={() => openSettleModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg"
            >
              <HandCoins className="h-4 w-4" />
              Settle Up
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-light p-3.5 text-sm text-danger">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
              <h2 className="mb-4 font-heading text-lg font-semibold text-ink">Balances</h2>
              <div className="space-y-3">
                {memberIds.map((id) => {
                  const balance = netBalances[id] ?? 0;
                  return (
                    <div key={id} className="flex items-center justify-between rounded-xl bg-surface-2/50 px-4 py-3">
                      <span className="flex items-center gap-2.5 text-sm text-ink">
                        <Avatar user={getUser(id)} size="sm" />
                        {id === currentUserId ? 'You' : getUserName(id)}
                      </span>
                      <Money amount={balance} currency={group.currency} className="text-sm font-semibold" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
              <h2 className="mb-4 font-heading text-lg font-semibold text-ink">Who owes whom</h2>
              {debts.length === 0 ? (
                <p className="text-sm text-ink-muted">Books are balanced — nothing owed either way.</p>
              ) : (
                <div className="space-y-3">
                  {debts.map((debt, idx) => {
                    const isMine = debt.from === currentUserId;
                    return (
                      <div key={idx} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2/50 px-4 py-3">
                        <span className="text-sm text-ink">
                          <strong>{debt.from === currentUserId ? 'You' : getUserName(debt.from)}</strong>
                          {' owe'}{debt.from === currentUserId ? '' : 's'}{' '}
                          <strong>{debt.to === currentUserId ? 'you' : getUserName(debt.to)}</strong>
                          {' '}
                          <Money amount={debt.amount} currency={group.currency} neutral />
                        </span>
                        {isMine && (
                          <button
                            onClick={() => openSettleModal(debt.to, debt.amount)}
                            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {myDebts.length === 0 && debts.length > 0 && (
                <p className="mt-3 text-xs text-ink-muted">You&apos;re not part of any outstanding debts.</p>
              )}
            </div>

            <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
              <h2 className="mb-4 font-heading text-lg font-semibold text-ink">Settlement history</h2>
              <div className="space-y-3">
                {settlements.map((s) => {
                  const expense = s.expense_id ? expenses.find((e) => e.id === s.expense_id) : undefined;
                  return (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">
                        {s.paid_by === currentUserId ? 'You' : getUserName(s.paid_by)} paid{' '}
                        {s.paid_to === currentUserId ? 'you' : getUserName(s.paid_to)}{' '}
                        {expense && <>(for &ldquo;{expense.description}&rdquo;) </>}
                        <Money amount={s.amount} currency={group.currency} neutral />
                        {s.note ? ` — ${s.note}` : ''}
                      </span>
                      <span className="text-ink-muted">{new Date(s.date).toLocaleDateString()}</span>
                    </div>
                  );
                })}
                {settlements.length === 0 && (
                  <p className="text-sm text-ink-muted">No settlements recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-semibold text-ink">Members</h2>
                <span className="text-xs text-ink-muted">{members.length} total</span>
              </div>
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar user={getUser(m.user_id)} />
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {getUserName(m.user_id)} {m.user_id === currentUserId && '(you)'}
                        </p>
                        <p className="text-xs text-ink-muted capitalize">{m.role}</p>
                      </div>
                    </div>
                    {m.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-danger-light hover:text-danger"
                        title="Remove member"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {invites.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-rule pt-4">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 text-sm text-ink-muted">
                      <span className="flex min-w-0 items-center">
                        <Mail className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{inv.email} (pending)</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/invite/${inv.id}`;
                            navigator.clipboard?.writeText(url);
                            toast('Invite link copied');
                          }}
                          className="text-xs font-medium text-primary hover:text-primary-dark"
                        >
                          Copy link
                        </button>
                        <button onClick={() => cancelInvite(inv.id)} className="text-xs font-medium text-danger hover:text-danger">
                          Cancel
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={sendInvite} className="mt-4 flex gap-2 border-t border-rule pt-4">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by email"
                  className="flex-1 rounded-xl border border-rule bg-surface px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark"
                >
                  Invite
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {showSettleModal && currentUserId && (
        <SettleUpModal
          groupId={groupId}
          currentUserId={currentUserId}
          members={memberUsers}
          expenses={expenses}
          splits={splits}
          defaultPayTo={prefill.to}
          defaultAmount={prefill.amount}
          currency={group.currency}
          onClose={() => setShowSettleModal(false)}
          onSettled={fetchData}
        />
      )}
    </div>
  );
}
