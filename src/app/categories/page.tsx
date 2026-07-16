'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Category, Group } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Plus, Trash2, Edit, Check, X as XIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/Select';

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#06B6D4',
];

const SPLIT_TYPES = [
  { value: 'equal', label: 'Equal Split' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
] as const;

function CategoriesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>(searchParams.get('group') || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [splitType, setSplitType] = useState<Category['default_split_type']>('equal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [editSplitType, setEditSplitType] = useState<Category['default_split_type']>('equal');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      }
    });
  }, [router]);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchCategories();

      const channel = supabase
        .channel(`categories-${groupId}-changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'categories', filter: `group_id=eq.${groupId}` },
          () => fetchCategories()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [groupId]);

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
    setGroups(data || []);
    if (!groupId && data && data.length > 0) {
      setGroupId(data[0].id);
    } else {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    setCategories(data || []);
    setLoading(false);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !groupId) return;

    const { error: insertError } = await supabase.from('categories').insert({
      group_id: groupId,
      name: name.trim(),
      color,
      default_split_type: splitType,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setColor(COLORS[0]);
    setSplitType('equal');
    fetchCategories();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditSplitType(cat.default_split_type);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('categories').update({
      name: editName.trim(),
      color: editColor,
      default_split_type: editSplitType,
    }).eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    fetchCategories();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor(COLORS[0]);
    setEditSplitType('equal');
  };

  const deleteCategory = async (id: string) => {
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    fetchCategories();
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

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-ink-muted">
            You&apos;re not in any groups yet. Create one on the{' '}
            <a href="/groups" className="text-primary hover:text-primary-dark">Groups</a> page first.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">Categories</h1>
            <p className="mt-2 text-ink-muted">Organize expenses by category with default split rules</p>
          </div>
          <Select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full sm:w-64"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-light p-4 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={addCategory} className="mb-8 rounded-2xl border border-rule bg-surface p-6 shadow-card">
          <h3 className="mb-4 font-heading text-base font-semibold text-ink">Add a new category</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Groceries, Rent, Transport"
                className="h-10 w-full rounded-xl border border-rule bg-surface px-3.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Color</label>
              <div className="flex flex-wrap items-center gap-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-8 w-8 rounded-full border-2 transition-all duration-150 hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? 'currentColor' : 'transparent',
                      boxShadow: color === c ? '0 0 0 2px rgba(0,0,0,0.2)' : 'none',
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Default Split</label>
              <Select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value as Category['default_split_type'])}
                className="h-10"
              >
                {SPLIT_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </div>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div key={category.id} className="group relative overflow-hidden rounded-2xl border border-rule bg-surface p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
              {editingId === category.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-rule bg-surface-2 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: editColor === c ? 'currentColor' : 'transparent',
                          boxShadow: editColor === c ? '0 0 0 2px rgba(0,0,0,0.2)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                  <Select
                    value={editSplitType}
                    onChange={(e) => setEditSplitType(e.target.value as Category['default_split_type'])}
                    className="w-full"
                  >
                    {SPLIT_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </Select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(category.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted"
                    >
                      <XIcon className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-xl"
                        style={{ backgroundColor: category.color + '20' }}
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-heading text-base font-semibold text-ink">{category.name}</h3>
                        <p className="text-sm text-ink-muted">
                          {SPLIT_TYPES.find(st => st.value === category.default_split_type)?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => startEdit(category)}
                        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-danger-light hover:text-danger"
                        aria-label="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-rule bg-surface-2 px-6 py-12 text-center">
              <p className="text-ink-muted">No categories yet. Create your first category above.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesPageInner />
    </Suspense>
  );
}
