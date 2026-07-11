'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, Category, Expense, ExpenseSplit, SplitType } from '@/types';
import { splitEqually } from '@/lib/balances';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { Avatar } from '@/components/Avatar';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

function ExpensesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>(searchParams.get('group') || '');
  const [members, setMembers] = useState<AppUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [includedMembers, setIncludedMembers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setCurrentUserId(user.id);
      }
    });
  }, [router]);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchGroupScopedData();

      const channel = supabase
        .channel(`expenses-${groupId}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () => fetchGroupScopedData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => fetchGroupScopedData())
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

  const fetchGroupScopedData = async () => {
    try {
      const { data: membersData } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
      const memberIds = (membersData || []).map((m: { user_id: string }) => m.user_id);
      const { data: usersData } = memberIds.length
        ? await supabase.from('users').select('*').in('id', memberIds)
        : { data: [] };

      const { data: categoriesData } = await supabase.from('categories').select('*').eq('group_id', groupId);
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      const expenseIds = (expensesData || []).map((e: Expense) => e.id);
      const { data: splitsData } = expenseIds.length
        ? await supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
        : { data: [] };

      setMembers(usersData || []);
      setCategories(categoriesData || []);
      setExpenses(expensesData || []);
      setSplits(splitsData || []);

      const included: Record<string, boolean> = {};
      (usersData || []).forEach((u: AppUser) => (included[u.id] = true));
      setIncludedMembers((prev) => (Object.keys(prev).length ? prev : included));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaidBy(currentUserId || '');
    setCategoryId('');
    setSplitType('equal');
    setSplitValues({});
    const included: Record<string, boolean> = {};
    members.forEach((m) => (included[m.id] = true));
    setIncludedMembers(included);
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!description.trim() || !amount || !date || !paidBy || !currentUserId) return;

    const amountNum = parseFloat(amount);
    const participantIds = members.filter((m) => includedMembers[m.id]).map((m) => m.id);
    if (participantIds.length === 0) {
      setError('Select at least one person to split this with');
      return;
    }

    let splitRows: { user_id: string; amount: number }[] = [];

    if (splitType === 'equal') {
      const shares = splitEqually(amountNum, participantIds);
      splitRows = participantIds.map((id) => ({ user_id: id, amount: shares[id] }));
    } else if (splitType === 'percentage') {
      splitRows = participantIds.map((id) => ({
        user_id: id,
        amount: Math.round(amountNum * (parseFloat(splitValues[id] || '0') / 100) * 100) / 100,
      }));
    } else {
      splitRows = participantIds.map((id) => ({
        user_id: id,
        amount: parseFloat(splitValues[id] || '0'),
      }));
    }

    const totalSplit = splitRows.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplit - amountNum) > 0.01) {
      setError(`Split amounts total $${totalSplit.toFixed(2)}, but the expense is $${amountNum.toFixed(2)}`);
      return;
    }

    try {
      if (editingId) {
        await supabase.from('expenses').update({
          description: description.trim(),
          amount: amountNum,
          date,
          paid_by: paidBy,
          category_id: categoryId || null,
        }).eq('id', editingId);

        await supabase.from('expense_splits').delete().eq('expense_id', editingId);
        for (const row of splitRows) {
          await supabase.from('expense_splits').insert({ expense_id: editingId, ...row });
        }
      } else {
        const { data: expense } = await supabase
          .from('expenses')
          .insert({
            group_id: groupId,
            created_by: currentUserId,
            description: description.trim(),
            amount: amountNum,
            date,
            paid_by: paidBy,
            category_id: categoryId || null,
          })
          .select()
          .single();

        if (expense) {
          for (const row of splitRows) {
            await supabase.from('expense_splits').insert({ expense_id: expense.id, ...row });
          }
        }
      }

      resetForm();
      fetchGroupScopedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setDate(expense.date);
    setPaidBy(expense.paid_by);
    setCategoryId(expense.category_id || '');

    const expenseSplits = splits.filter((s) => s.expense_id === expense.id);
    const values: Record<string, string> = {};
    const included: Record<string, boolean> = {};
    expenseSplits.forEach((s) => {
      values[s.user_id] = s.amount.toString();
      included[s.user_id] = true;
    });
    setSplitValues(values);
    setIncludedMembers(included);
    setSplitType('custom');
    setShowForm(true);
  };

  const deleteExpense = async (id: string) => {
    await supabase.from('expense_splits').delete().eq('expense_id', id);
    await supabase.from('expenses').delete().eq('id', id);
    fetchGroupScopedData();
  };

  const getUserName = (id: string) => members.find((m) => m.id === id)?.name || (id === currentUserId ? 'You' : 'Unknown');
  const getUser = (id: string): AppUser =>
    members.find((m) => m.id === id) || { id, email: '', name: 'Unknown', avatar_url: null, created_at: '' };
  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || 'Uncategorized';
  const getCategoryColor = (id: string | null) => categories.find((c) => c.id === id)?.color || '#ccc';

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

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-ledger-paper">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-ledger-ink-muted">
            You&apos;re not in any groups yet. Create one on the{' '}
            <a href="/groups" className="text-ledger-teal hover:underline">Groups</a> page first.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ledger-paper">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-ledger-ink">Expenses</h1>
            <p className="mt-2 text-ledger-ink-muted">Track and split expenses with your group</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={groupId}
              onChange={(e) => { setGroupId(e.target.value); setShowForm(false); }}
              className="rounded-sm border border-ledger-rule px-3 py-2 text-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center rounded-sm bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-sm bg-ledger-red-light p-4 text-sm text-ledger-red">{error}</div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-sm bg-ledger-card p-6 border border-ledger-rule">
            <h2 className="mb-4 font-serif text-lg font-semibold text-ledger-ink">
              {editingId ? 'Edit Expense' : 'New Expense'}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ledger-ink">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ledger-ink">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ledger-ink">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ledger-ink">Paid By</label>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                >
                  <option value="">Select who paid</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.id === currentUserId ? 'You' : m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ledger-ink">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ledger-ink">Split Type</label>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as SplitType)}
                  className="mt-1 block w-full rounded-sm border border-ledger-rule px-3 py-2 focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal"
                >
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-ledger-ink">Split Among</label>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!includedMembers[m.id]}
                      onChange={(e) => setIncludedMembers({ ...includedMembers, [m.id]: e.target.checked })}
                      className="rounded border-ledger-rule text-ledger-teal focus:ring-ledger-teal"
                    />
                    <Avatar user={m} size="sm" />
                    <span className="w-20 text-sm text-ledger-ink">{m.id === currentUserId ? 'You' : m.name}</span>
                    <input
                      type="text"
                      value={splitValues[m.id] || (splitType === 'equal' ? '' : '0')}
                      onChange={(e) => setSplitValues({ ...splitValues, [m.id]: e.target.value })}
                      placeholder={splitType === 'equal' ? 'Equal' : splitType === 'percentage' ? '%' : '$'}
                      disabled={splitType === 'equal' || !includedMembers[m.id]}
                      className="block w-full rounded-sm border border-ledger-rule px-3 py-1 text-sm focus:border-ledger-teal focus:outline-none focus:ring-ledger-teal disabled:bg-ledger-paper"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="submit"
                className="inline-flex items-center rounded-sm bg-ledger-teal px-4 py-2 text-sm font-medium text-white hover:bg-ledger-teal-dark"
              >
                {editingId ? 'Update' : 'Create'} Expense
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center rounded-sm border border-ledger-rule bg-ledger-card px-4 py-2 text-sm font-medium text-ledger-ink hover:bg-ledger-paper"
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
              <div key={expense.id} className="rounded-sm bg-ledger-card p-6 border border-ledger-rule">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(expense.category_id) }}
                      />
                      <Avatar user={getUser(expense.paid_by)} size="sm" />
                      <h3 className="font-serif text-lg font-semibold text-ledger-ink">{expense.description}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ledger-ink-muted">
                      <Money amount={expense.amount} neutral />
                      <span>Paid by {getUserName(expense.paid_by)}</span>
                      <span>{getCategoryName(expense.category_id)}</span>
                      <span>{new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-ledger-ink-muted">
                      {expenseSplits.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1.5">
                          <Avatar user={getUser(s.user_id)} size="sm" />
                          {getUserName(s.user_id)}: <Money amount={s.amount} neutral />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(expense)}
                      className="rounded-sm p-2 text-ledger-ink-muted hover:bg-ledger-paper"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="rounded-sm p-2 text-ledger-red hover:bg-ledger-red-light"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {expenses.length === 0 && (
            <p className="text-center text-ledger-ink-muted">No expenses yet. Add your first expense above.</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesPageInner />
    </Suspense>
  );
}
