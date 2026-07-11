'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ActivityLog } from '@/types';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';

export default function ActivityPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
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
    fetchLogs();

    const channel = supabase
      .channel('activity-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log' },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="font-serif text-3xl font-semibold text-ledger-ink">Activity Log</h1>
          <p className="mt-2 text-ledger-ink-muted">Audit trail of all changes</p>
        </div>

        {error && (
          <div className="mb-4 rounded-sm bg-ledger-red-light p-4 text-sm text-ledger-red">
            {error}
          </div>
        )}

        <div className="rounded-sm bg-ledger-card border border-ledger-rule overflow-hidden">
          <ul className="divide-y divide-ledger-rule">
            {logs.map((log) => (
              <li key={log.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ledger-ink">
                      {log.action === 'create' ? 'Created' : log.action === 'update' ? 'Updated' : 'Deleted'} {log.entity_type}
                    </p>
                    <p className="text-sm text-ledger-ink-muted">
                      ID: {log.entity_id}
                    </p>
                    {Object.keys(log.changes_json).length > 0 && (
                      <pre className="mt-2 text-xs text-ledger-ink-muted">
                        {JSON.stringify(log.changes_json, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="text-sm text-ledger-ink-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
            {logs.length === 0 && (
              <li className="px-6 py-8 text-center text-ledger-ink-muted">
                No activity yet.
              </li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
