'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ActivityLog, AppUser, Group } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { Avatar } from '@/components/Avatar';
import { Receipt, HandCoins, Tag, Users, ScrollText, Trash2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/Select';

const ENTITY_ICON: Record<string, typeof Receipt> = {
  expenses: Receipt,
  settlements: HandCoins,
  categories: Tag,
  groups: Users,
  group_members: Users,
  expense_splits: Receipt,
};

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

function describe(log: ActivityLog, actorName: string, groupName: string | undefined, expenses: Record<string, { description: string }> = {}): { verb: string; noun: string; amount?: number; currency?: string; detail?: string } {
  const action = log.action;
  const verb = action === 'create' ? 'added' : action === 'update' ? 'updated' : 'deleted';
  const noun = log.entity_type.replace(/_/g, ' ').replace(/s$/, '');
  let amount: number | undefined;
  let currency: string | undefined;
  let detail: string | undefined;
  if (log.entity_type === 'expenses' && log.changes_json) {
    amount = typeof log.changes_json.amount === 'number' ? log.changes_json.amount : undefined;
    currency = typeof log.changes_json.currency === 'string' ? log.changes_json.currency : undefined;
    detail = typeof log.changes_json.description === 'string' ? log.changes_json.description : undefined;
  }
  if (log.entity_type === 'settlements' && log.changes_json) {
    amount = typeof log.changes_json.amount === 'number' ? log.changes_json.amount : undefined;
    const expenseId = typeof log.changes_json.expense_id === 'string' ? log.changes_json.expense_id : null;
    if (expenseId && expenses[expenseId]) {
      detail = expenses[expenseId].description;
    }
  }
  return { verb, noun, amount, currency, detail };
}

export default function ActivityPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [actors, setActors] = useState<Record<string, AppUser>>({});
  const [expensesMap, setExpensesMap] = useState<Record<string, { description: string }>>({});
  const [filterGroup, setFilterGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
    });
  }, [router]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('activity-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAll = async () => {
    try {
      const { data: groupsData } = await supabase.from('groups').select('*');
      setGroups(groupsData || []);

      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      const logsData: ActivityLog[] = data || [];

      const actorIds = Array.from(new Set(logsData.map((l) => l.actor_id)));
      if (actorIds.length) {
        const { data: usersData } = await supabase.from('users').select('*').in('id', actorIds);
        const map: Record<string, AppUser> = {};
        (usersData || []).forEach((u: AppUser) => (map[u.id] = u));
        setActors(map);
      }

      const groupIds = Array.from(new Set(logsData.map((l) => l.group_id).filter((id): id is string => !!id)));
      if (groupIds.length) {
        const { data: expensesData } = await supabase.from('expenses').select('id, description').in('group_id', groupIds);
        const expMap: Record<string, { description: string }> = {};
        (expensesData || []).forEach((e) => { expMap[e.id] = { description: e.description }; });
        setExpensesMap(expMap);
      }

      setLogs(logsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  const visible = filterGroup ? logs.filter((l) => (l.group_id ?? '') === filterGroup) : logs;
  const groupName = (id?: string) => groups.find((g) => g.id === id)?.name;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">Activity</h1>
            <p className="mt-2 text-ink-muted">A readable trail of everything that happened</p>
          </div>
          {groups.length > 0 && (
            <Select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="sm:w-56"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {error && <div className="mb-4 rounded-lg bg-danger-light p-4 text-sm text-danger">{error}</div>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl border border-rule bg-surface p-4 shadow-card">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No activity yet"
            description="Changes you and your group make will show up here."
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((log) => {
              const Icon = ENTITY_ICON[log.entity_type] ?? ScrollText;
              const actor = actors[log.actor_id];
              const actorName = actor?.name ?? 'Someone';
              const d = describe(log, actorName, groupName(log.group_id ?? undefined), expensesMap);
              return (
                <li
                  key={log.id}
                  className="group relative overflow-hidden flex items-center gap-4 rounded-2xl border border-rule bg-surface p-4 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-light text-primary">
                    {log.action === 'delete' ? <Trash2 className="h-5 w-5" /> : log.action === 'update' ? <Pencil className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      <span className="font-medium">{actorName}</span> {d.verb} a {d.noun}
                      {d.detail && <span className="text-ink-muted"> — &ldquo;{d.detail}&rdquo;</span>}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {groupName(log.group_id ?? undefined) ?? 'General'} · {timeAgo(log.created_at)}
                    </p>
                  </div>
                  {typeof d.amount === 'number' && (
                    <Money amount={d.amount} currency={d.currency ?? 'EUR'} neutral className="shrink-0 text-sm" />
                  )}
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
