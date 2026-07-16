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
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-2 text-ink-muted">Manage how you appear to your groups</p>

        <div className="mt-8 rounded-2xl border border-rule bg-surface p-6 shadow-card">
          <div className="flex items-center gap-5">
            <div className="relative">
              {profile && <Avatar user={profile} size="lg" />}
              <label className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-rule bg-surface text-primary shadow-sm transition-colors hover:bg-surface-2">
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
              <p className="font-medium text-ink">{profile?.name}</p>
              <p className="text-sm text-ink-muted">{profile?.email}</p>
              {uploading && <p className="mt-1 text-xs text-primary">Uploading…</p>}
            </div>
          </div>

          <form onSubmit={saveName} className="mt-6 border-t border-rule pt-6">
            <label className="block text-sm font-medium text-ink">Display name</label>
            <div className="mt-2 flex gap-3">
              <div className="relative flex-1">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-xl border border-rule bg-surface pl-9 pr-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg disabled:opacity-50"
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
