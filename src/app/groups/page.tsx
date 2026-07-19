'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, GroupInvite } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Plus, Users, Check, X as XIcon, Copy, Edit } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CURRENCIES } from '@/lib/utils';
import { Select } from '@/components/Select';

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [groupNamesByInvite, setGroupNamesByInvite] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('EUR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState('EUR');

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
      .channel('groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true });

      const { data: membersData } = await supabase.from('group_members').select('group_id');

      const counts: Record<string, number> = {};
      (membersData || []).forEach((m: { group_id: string }) => {
        counts[m.group_id] = (counts[m.group_id] || 0) + 1;
      });

      const { data: myUser } = await supabase.from('users').select('email').eq('id', user.id).single();
      let pendingInvites: GroupInvite[] = [];
      if (myUser?.email) {
        const { data: invitesData } = await supabase
          .from('group_invites')
          .select('*')
          .eq('email', myUser.email)
          .eq('status', 'pending');
        pendingInvites = invitesData || [];
      }

      const namesByInvite: Record<string, string> = {};
      if (pendingInvites.length > 0) {
        const groupIds = Array.from(new Set(pendingInvites.map((i) => i.group_id)));
        const { data: inviteGroups } = await supabase.from('groups').select('id, name').in('id', groupIds);
        (inviteGroups || []).forEach((g: { id: string; name: string }) => {
          namesByInvite[g.id] = g.name;
        });
      }

      setGroups(groupsData || []);
      setMemberCounts(counts);
      setInvites(pendingInvites);
      setGroupNamesByInvite(namesByInvite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newGroupName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: newGroupName.trim(),
        created_by: user.id,
        currency: newGroupCurrency,
      })
      .select()
      .single();

    if (groupError) {
      setError(groupError.message);
      return;
    }

    if (group) {
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
      });
    }

    setNewGroupName('');
    fetchData();
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

  const acceptInvite = async (inviteId: string) => {
    setError(null);
    const { error: rpcError } = await supabase.rpc('accept_group_invite', { _invite_id: inviteId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    fetchData();
  };

  const declineInvite = async (inviteId: string) => {
    await supabase.from('group_invites').update({ status: 'declined' }).eq('id', inviteId);
    fetchData();
  };

  const copyInviteLink = async (inviteId: string) => {
    const url = `${window.location.origin}/invite/${inviteId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">Groups</h1>
          <p className="mt-2 text-ink-muted">Create groups and invite people to split expenses</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-light p-4 text-sm text-danger">{error}</div>
        )}

        {invites.length > 0 && (
          <div className="mb-8 rounded-2xl border border-primary/20 bg-primary-light/50 p-6">
            <h2 className="mb-3 text-lg font-semibold text-primary">Pending invites</h2>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <span className="text-sm text-ink">
                      You&apos;ve been invited to <strong>{groupNamesByInvite[invite.group_id] || 'a group'}</strong>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyInviteLink(invite.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {copiedId === invite.id ? (
                        <><Check className="h-4 w-4" /> Copied</>
                      ) : (
                        <><Copy className="h-4 w-4" /> Copy link</>
                      )}
                    </button>
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark"
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => declineInvite(invite.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rule bg-surface px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <XIcon className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={createGroup} className="mb-8 rounded-2xl border border-rule bg-surface p-6 shadow-card">
          <h3 className="mb-4 font-heading text-base font-semibold text-ink">Create a new group</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Group name</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Apartment, Iceland Trip, Office"
                className="w-full rounded-xl border border-rule bg-surface px-4 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="sm:w-56">
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Currency</label>
              <Select
                value={newGroupCurrency}
                onChange={(e) => setNewGroupCurrency(e.target.value)}
                aria-label="Currency"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg"
            >
              <Plus className="h-4 w-4" />
              Create Group
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
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
                  <div className="relative z-10">
                    <Link href={`/groups/${group.id}`} className="block">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-heading text-lg font-semibold text-ink">{group.name}</h3>
                          <p className="mt-1.5 flex items-center text-sm text-ink-muted">
                            <Users className="mr-1.5 h-4 w-4" />
                            {memberCounts[group.id] || 1} member{(memberCounts[group.id] || 1) === 1 ? '' : 's'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(group); }}
                          className="rounded-lg p-1.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 hover:text-ink"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </Link>
                    <Link
                      href={`/groups/${group.id}`}
                      className="mt-4 flex items-center gap-2 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <span>View details</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
                </>
              )}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-rule bg-surface-2 px-6 py-12 text-center">
              <p className="text-ink-muted">
                No groups yet. Create your first group above.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
