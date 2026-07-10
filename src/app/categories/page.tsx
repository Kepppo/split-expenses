'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#06B6D4',
];

const SPLIT_TYPES = [
  { value: 'equal', label: 'Equal Split' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'custom', label: 'Custom' },
] as const;

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [splitType, setSplitType] = useState<Category['default_split_type']>('equal');
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
    fetchCategories();

    const channel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => fetchCategories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    setCategories(data || []);
    setLoading(false);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to add categories');
      return;
    }

    const { error: insertError } = await supabase.from('categories').insert({
      user_id: user.id,
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
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <p className="mt-2 text-gray-600">Organize expenses by category with default split rules</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={addCategory} className="mb-8 rounded-lg bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Groceries"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <div className="mt-1 flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      color === c ? 'border-gray-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Default Split</label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value as Category['default_split_type'])}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                {SPLIT_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </button>
            </div>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-lg bg-white p-6 shadow">
              <div className="flex items-center">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-500">
                    Default: {SPLIT_TYPES.find(st => st.value === category.default_split_type)?.label}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteCategory(category.id)}
                className="rounded-md p-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="col-span-full text-center text-gray-500">
              No categories yet. Create your first category above.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
