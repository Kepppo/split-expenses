'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newName, setNewName] = useState('');
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
    fetchProfiles();

    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchProfiles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    setProfiles(data || []);
    setLoading(false);
  };

  const addProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to add profiles');
      return;
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      user_id: user.id,
      name: newName.trim(),
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewName('');
    fetchProfiles();
  };

  const deleteProfile = async (id: string) => {
    await supabase.from('profiles').delete().eq('id', id);
    fetchProfiles();
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
          <h1 className="text-3xl font-bold text-gray-900">Profiles</h1>
          <p className="mt-2 text-gray-600">Manage the people or groups you share expenses with</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={addProfile} className="mb-8 flex gap-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New profile name (e.g., Partner, Roommate)"
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Profile
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between rounded-lg bg-white p-6 shadow">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{profile.name}</h3>
                <p className="text-sm text-gray-500">
                  Created {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => deleteProfile(profile.id)}
                className="rounded-md p-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          {profiles.length === 0 && (
            <p className="col-span-full text-center text-gray-500">
              No profiles yet. Create your first profile above.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
