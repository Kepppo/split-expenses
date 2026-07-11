'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, GroupInvite } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Plus, Users, Check, X as XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [groupNamesByInvite, setGroupNamesByInvite] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
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

      // Pending invites addressed to me
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
      .insert({ name: newGroupName.trim(), created_by: user.id })
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
          <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
          <p className="mt-2 text-gray-600">Share expenses with the real people in your groups</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {invites.length > 0 && (
          <div className="mb-8 rounded-lg bg-indigo-50 p-6">
            <h2 className="mb-3 text-lg font-medium text-indigo-900">Pending invites</h2>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded-md bg-white p-4 shadow-sm">
                  <span className="text-sm text-gray-900">
                    You&apos;ve been invited to <strong>{groupNamesByInvite[invite.group_id] || 'a group'}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => declineInvite(invite.id)}
                      className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <XIcon className="mr-1 h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={createGroup} className="mb-8 flex gap-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New group name (e.g., Apartment, Iceland Trip)"
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex items-center justify-between rounded-lg bg-white p-6 shadow hover:shadow-md"
            >
              <div>
                <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                <p className="mt-1 flex items-center text-sm text-gray-500">
                  <Users className="mr-1 h-4 w-4" />
                  {memberCounts[group.id] || 1} member{(memberCounts[group.id] || 1) === 1 ? '' : 's'}
                </p>
              </div>
            </Link>
          ))}
          {groups.length === 0 && (
            <p className="col-span-full text-center text-gray-500">
              No groups yet. Create your first group above.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
