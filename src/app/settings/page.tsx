'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import { Camera, User } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setProfile(data);
          setName(data?.name ?? '');
          setLoading(false);
        });
    });
  }, [router]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('users').update({ name: name.trim() }).eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    // keep auth metadata in sync so new invites show the right name
    await supabase.auth.updateUser({ data: { name: name.trim() } });
    toast('Profile updated');
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      if (dbErr) throw dbErr;
      setProfile({ ...profile, avatar_url: data.publicUrl });
      toast('Photo updated');
    } catch (err) {
      toast(
        err instanceof Error ? `${err.message} (create an "avatars" storage bucket first)` : 'Upload failed',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ledger-paper">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ledger-paper">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-semibold text-ledger-ink">Settings</h1>
        <p className="mt-2 text-ledger-ink-muted">Manage how you appear to your groups</p>

        <div className="mt-8 rounded-lg border border-ledger-rule bg-ledger-card p-6 shadow-card-sm">
          <div className="flex items-center gap-5">
            <div className="relative">
              {profile && <Avatar user={profile} size="lg" />}
              <label className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-ledger-rule bg-ledger-card text-ledger-teal shadow-card-sm hover:bg-ledger-paper">
                <Camera className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
              </label>
            </div>
            <div>
              <p className="font-medium text-ledger-ink">{profile?.name}</p>
              <p className="text-sm text-ledger-ink-muted">{profile?.email}</p>
              {uploading && <p className="mt-1 text-xs text-ledger-teal">Uploading…</p>}
            </div>
          </div>

          <form onSubmit={saveName} className="mt-6 border-t border-ledger-rule pt-6">
            <label className="block text-sm font-medium text-ledger-ink">Display name</label>
            <div className="mt-2 flex gap-3">
              <div className="relative flex-1">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-ink-muted" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-sm border border-ledger-rule py-2 pl-9 pr-3 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-sm bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
