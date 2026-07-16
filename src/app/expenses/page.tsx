'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { AppUser, Group, Category, Expense, ExpenseSplit, SplitType } from '@/types';
import { splitEqually } from '@/lib/balances';
import { formatMoney, currencySymbol } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';
import { Money } from '@/components/LedgerCard';
import { Avatar } from '@/components/Avatar';
import { Plus, Trash2, Edit, ChevronDown, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/Select';
import { cn } from '@/lib/utils';

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
      if (user) {
        setCurrentUserId(user.id);
        setPaidBy(user.id);
      } else {
        router.push('/login');
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
      setError(`Split amounts total ${formatMoney(totalSplit, groups.find(g => g.id === groupId)?.currency || 'EUR')}, but the expense is ${formatMoney(amountNum, groups.find(g => g.id === groupId)?.currency || 'EUR')}`);
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
    setSplitType('fixed');
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
  const groupCurrency = groups.find((g) => g.id === groupId)?.currency || 'EUR';

  const includedIds = members.filter((m) => includedMembers[m.id]).map((m) => m.id);
  const amountNum = parseFloat(amount) || 0;
  const allocated = includedIds.reduce((sum, id) => sum + (parseFloat(splitValues[id] || '0') || 0), 0);
  const remaining =
    splitType === 'percentage' ? Math.round((100 - allocated) * 100) / 100 : Math.round((amountNum - allocated) * 100) / 100;

  const distributeEvenly = () => {
    if (includedIds.length === 0) return;
    const next = { ...splitValues };
    if (splitType === 'percentage') {
      const each = (100 / includedIds.length).toFixed(2);
      includedIds.forEach((id) => (next[id] = each));
    } else {
      const shares = splitEqually(amountNum, includedIds);
      includedIds.forEach((id) => (next[id] = (shares[id] ?? 0).toFixed(2)));
    }
    setSplitValues(next);
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
            <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">Expenses</h1>
            <p className="mt-2 text-ink-muted">Track and split expenses with your group</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={groupId}
              onChange={(e) => { setGroupId(e.target.value); setShowForm(false); }}
              className="w-60"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-light p-4 text-sm text-danger">{error}</div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-rule bg-surface p-6 shadow-card">
            <h2 className="mb-4 font-heading text-lg font-semibold text-ink">
              {editingId ? 'Edit Expense' : 'New Expense'}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="e.g., Grocery run, Uber ride"
                  className="mt-1.5 block w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">
                  Amount <span className="text-ink-muted">({currencySymbol(groupCurrency)})</span>
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                    {currencySymbol(groupCurrency)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="block w-full rounded-xl border border-rule bg-surface pl-9 pr-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Paid By</label>
                <Select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  required
                  className="mt-1.5"
                >
                  <option value="">Select who paid</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.id === currentUserId ? 'You' : m.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Category</label>
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Split Type</label>
                <Select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as SplitType)}
                  className="mt-1.5"
                >
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </Select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-ink mb-2">Split Among</label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-rule bg-surface-2/50 p-3">
                    <input
                      type="checkbox"
                      checked={!!includedMembers[m.id]}
                      onChange={(e) => setIncludedMembers({ ...includedMembers, [m.id]: e.target.checked })}
                      className="h-4 w-4 rounded border-rule text-primary focus:ring-primary"
                    />
                    <Avatar user={m} size="sm" />
                    <span className="flex-1 text-sm text-ink">{m.id === currentUserId ? 'You' : m.name}</span>
                    <input
                      type="text"
                      value={splitValues[m.id] || (splitType === 'equal' ? '' : '0')}
                      onChange={(e) => setSplitValues({ ...splitValues, [m.id]: e.target.value })}
                      placeholder={splitType === 'equal' ? 'Equal' : splitType === 'percentage' ? '%' : formatMoney(0, groupCurrency)}
                      disabled={splitType === 'equal' || !includedMembers[m.id]}
                      className="w-20 rounded-lg border border-rule bg-surface px-2 py-1.5 text-right text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-2 disabled:text-ink-muted"
                    />
                  </div>
                ))}
              </div>
            </div>

            {splitType !== 'equal' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    Math.abs(remaining) < 0.01 ? 'text-primary' : 'text-danger'
                  )}
                >
                  {splitType === 'percentage'
                    ? `Unallocated: ${remaining.toFixed(2)}%`
                    : `Remaining: ${formatMoney(Math.abs(remaining), groupCurrency)}`}
                </span>
                <button
                  type="button"
                  onClick={distributeEvenly}
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                >
                  Distribute evenly
                </button>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-dark hover:shadow-glow-lg"
              >
                {editingId ? 'Update' : 'Create'} Expense
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center rounded-xl border border-rule bg-surface px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
              <div key={expense.id} className="group relative overflow-hidden rounded-2xl border border-rule bg-surface shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
                <div className="relative z-10 flex items-start gap-4 p-6">
                  <div
                    className="mt-1 h-12 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryColor(expense.category_id) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <Avatar user={getUser(expense.paid_by)} size="sm" />
                      <h3 className="font-heading text-lg font-semibold text-ink">{expense.description}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
                      <Money amount={expense.amount} currency={groupCurrency} neutral />
                      <span>Paid by {getUserName(expense.paid_by)}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: getCategoryColor(expense.category_id) }}
                        />
                        {getCategoryName(expense.category_id)}
                      </span>
                      <span>{new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-muted">
                      {expenseSplits.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1.5">
                          <Avatar user={getUser(s.user_id)} size="sm" />
                           {getUserName(s.user_id)}: <Money amount={s.amount} currency={groupCurrency} neutral />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(expense)}
                      className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-danger-light hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
              </div>
            );
          })}
          {expenses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-rule bg-surface-2 px-6 py-12 text-center">
              <p className="text-ink-muted">No expenses yet. Add your first expense above.</p>
            </div>
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
