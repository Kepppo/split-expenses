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
          <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
          <p className="mt-2 text-gray-600">Audit trail of all changes</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-white shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {logs.map((log) => (
              <li key={log.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.action === 'create' ? 'Created' : log.action === 'update' ? 'Updated' : 'Deleted'} {log.entity_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      ID: {log.entity_id}
                    </p>
                    {Object.keys(log.changes_json).length > 0 && (
                      <pre className="mt-2 text-xs text-gray-600">
                        {JSON.stringify(log.changes_json, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
            {logs.length === 0 && (
              <li className="px-6 py-8 text-center text-gray-500">
                No activity yet.
              </li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
