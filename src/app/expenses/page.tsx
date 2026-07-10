'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Category, Expense, ExpenseSplit, SplitType } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ExpensesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      }
    });
  }, [router]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [profileId, setProfileId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('expenses-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data: profilesData } = await supabase.from('profiles').select('*');
    const { data: categoriesData } = await supabase.from('categories').select('*');
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    const { data: splitsData } = await supabase.from('expense_splits').select('*');

    setProfiles(profilesData || []);
    setCategories(categoriesData || []);
    setExpenses(expensesData || []);
    setSplits(splitsData || []);
    setLoading(false);
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setProfileId('');
    setCategoryId('');
    setSplitType('equal');
    setSplitValues({});
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!description.trim() || !amount || !date || !profileId || !categoryId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to add expenses');
      return;
    }

    const amountNum = parseFloat(amount);
    let splitRows: { profile_id: string; amount: number }[] = [];

    if (splitType === 'equal') {
      const perPerson = amountNum / profiles.length;
      splitRows = profiles.map((p) => ({
        profile_id: p.id,
        amount: Math.round(perPerson * 100) / 100,
      }));
    } else if (splitType === 'percentage') {
      splitRows = profiles.map((p) => ({
        profile_id: p.id,
        amount: (amountNum * (parseFloat(splitValues[p.id] || '0') / 100)),
      }));
    } else if (splitType === 'fixed') {
      splitRows = profiles.map((p) => ({
        profile_id: p.id,
        amount: parseFloat(splitValues[p.id] || '0'),
      }));
    } else if (splitType === 'custom') {
      splitRows = profiles.map((p) => ({
        profile_id: p.id,
        amount: parseFloat(splitValues[p.id] || '0'),
      }));
    }

    const totalSplit = splitRows.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplit - amountNum) > 0.01) {
      setError('Split amounts must total the expense amount');
      return;
    }

    try {
      if (editingId) {
        await supabase.from('expenses').update({
          description: description.trim(),
          amount: amountNum,
          date,
          profile_id: profileId,
          category_id: categoryId,
        }).eq('id', editingId);

        await supabase.from('expense_splits').delete().eq('expense_id', editingId);
        for (const row of splitRows) {
          await supabase.from('expense_splits').insert({
            expense_id: editingId,
            ...row,
          });
        }
      } else {
        const { data: expense } = await supabase
          .from('expenses')
          .insert({
            user_id: user.id,
            description: description.trim(),
            amount: amountNum,
            date,
            profile_id: profileId,
            category_id: categoryId,
          })
          .select()
          .single();

        if (expense) {
          for (const row of splitRows) {
            await supabase.from('expense_splits').insert({
              expense_id: expense.id,
              ...row,
            });
          }
        }
      }

      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setDate(expense.date);
    setProfileId(expense.profile_id);
    setCategoryId(expense.category_id);

    const expenseSplits = splits.filter((s) => s.expense_id === expense.id);
    const values: Record<string, string> = {};
    expenseSplits.forEach((s) => {
      values[s.profile_id] = s.amount.toString();
    });
    setSplitValues(values);
    setShowForm(true);
  };

  const deleteExpense = async (id: string) => {
    await supabase.from('expense_splits').delete().eq('expense_id', id);
    await supabase.from('expenses').delete().eq('id', id);
    fetchData();
  };

  const getProfileName = (id: string) => profiles.find((p) => p.id === id)?.name || 'Unknown';
  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || 'Unknown';
  const getCategoryColor = (id: string) => categories.find((c) => c.id === id)?.color || '#ccc';

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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
            <p className="mt-2 text-gray-600">Track and split expenses across profiles</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-medium text-gray-900">
              {editingId ? 'Edit Expense' : 'New Expense'}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Paid By Profile</label>
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                >
                  <option value="">Select profile</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Split Type</label>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as SplitType)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                >
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Split Among</label>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {profiles.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{p.name}</span>
                    <input
                      type="text"
                      value={splitValues[p.id] || (splitType === 'equal' ? '' : '0')}
                      onChange={(e) => setSplitValues({ ...splitValues, [p.id]: e.target.value })}
                      placeholder={splitType === 'equal' ? 'Equal' : splitType === 'percentage' ? '%' : '$'}
                      disabled={splitType === 'equal'}
                      className="block w-full rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {editingId ? 'Update' : 'Create'} Expense
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {expenses.map((expense) => {
            const expenseSplits = splits.filter((s) => s.expense_id === expense.id);
            return (
              <div key={expense.id} className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(expense.category_id) }}
                      />
                      <h3 className="text-lg font-medium text-gray-900">{expense.description}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                      <span>${expense.amount.toFixed(2)}</span>
                      <span>Paid by {getProfileName(expense.profile_id)}</span>
                      <span>{getCategoryName(expense.category_id)}</span>
                      <span>{new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {expenseSplits.map((s) => (
                        <span key={s.id} className="mr-4">
                          {getProfileName(s.profile_id)}: ${s.amount.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(expense)}
                      className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {expenses.length === 0 && (
            <p className="text-center text-gray-500">No expenses yet. Add your first expense above.</p>
          )}
        </div>
      </main>
    </div>
  );
}
