'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, GroupMember, GroupInvite, Expense, ExpenseSplit, Settlement } from '@/types';
import { calculateNetBalances, simplifyDebts } from '@/lib/balances';
import { Navbar } from '@/components/Navbar';
import { SettleUpModal } from '@/components/SettleUpModal';
import { Mail, UserMinus, HandCoins } from 'lucide-react';
import Link from 'next/link';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

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
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUserId(user.id);
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
      const { data: usersData } = memberIds.length
        ? await supabase.from('users').select('*').in('id', memberIds)
        : { data: [] };

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

    const { error: inviteError } = await supabase.from('group_invites').insert({
      group_id: groupId,
      email: inviteEmail.trim().toLowerCase(),
      invited_by: currentUserId,
    });

    if (inviteError) {
      setError(inviteError.message);
      return;
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

  const openSettleModal = (to?: string, amount?: number) => {
    setPrefill({ to, amount });
    setShowSettleModal(true);
  };

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

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500">Group not found, or you&apos;re not a member.</p>
        </main>
      </div>
    );
  }

  const memberIds = members.map((m) => m.user_id);
  const netBalances = calculateNetBalances(memberIds, expenses, splits, settlements);
  const debts = simplifyDebts(netBalances);
  const myDebts = currentUserId ? debts.filter((d) => d.from === currentUserId || d.to === currentUserId) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
            <p className="mt-2 text-gray-600">{members.length} member{members.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/expenses?group=${groupId}`}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View Expenses
            </Link>
            <button
              onClick={() => openSettleModal()}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <HandCoins className="mr-2 h-4 w-4" />
              Settle Up
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Balances</h2>
              <div className="space-y-3">
                {memberIds.map((id) => {
                  const balance = netBalances[id] ?? 0;
                  return (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-900">
                        {id === currentUserId ? 'You' : getUserName(id)}
                      </span>
                      <span className={`text-sm font-semibold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance >= 0 ? '+' : ''}${balance.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Who owes whom</h2>
              {debts.length === 0 ? (
                <p className="text-sm text-gray-500">Everyone&apos;s settled up. 🎉</p>
              ) : (
                <div className="space-y-3">
                  {debts.map((debt, idx) => {
                    const isMine = debt.from === currentUserId;
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          <strong>{debt.from === currentUserId ? 'You' : getUserName(debt.from)}</strong>
                          {' owe'}{debt.from === currentUserId ? '' : 's'}{' '}
                          <strong>{debt.to === currentUserId ? 'you' : getUserName(debt.to)}</strong>
                          {' '}${debt.amount.toFixed(2)}
                        </span>
                        {isMine && (
                          <button
                            onClick={() => openSettleModal(debt.to, debt.amount)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
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
                <p className="mt-3 text-xs text-gray-400">You&apos;re not part of any outstanding debts.</p>
              )}
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Settlement history</h2>
              <div className="space-y-3">
                {settlements.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      {s.paid_by === currentUserId ? 'You' : getUserName(s.paid_by)} paid{' '}
                      {s.paid_to === currentUserId ? 'you' : getUserName(s.paid_to)} ${s.amount.toFixed(2)}
                      {s.note ? ` — ${s.note}` : ''}
                    </span>
                    <span className="text-gray-400">{new Date(s.date).toLocaleDateString()}</span>
                  </div>
                ))}
                {settlements.length === 0 && (
                  <p className="text-sm text-gray-500">No settlements recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Members</h2>
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getUserName(m.user_id)} {m.user_id === currentUserId && '(you)'}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{m.role}</p>
                    </div>
                    {m.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove member"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {invites.length > 0 && (
                <div className="mt-4 space-y-2 border-t pt-4">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center">
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        {inv.email} (pending)
                      </span>
                      <button onClick={() => cancelInvite(inv.id)} className="text-xs text-red-600 hover:underline">
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={sendInvite} className="mt-4 flex gap-2 border-t pt-4">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by email"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
          defaultPayTo={prefill.to}
          defaultAmount={prefill.amount}
          onClose={() => setShowSettleModal(false)}
          onSettled={fetchData}
        />
      )}
    </div>
  );
}
