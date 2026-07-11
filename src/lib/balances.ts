import { Expense, ExpenseSplit, Settlement, Debt } from '@/types';

/**
 * Net balance per user within a group.
 * Positive => this user is owed money (should receive).
 * Negative => this user owes money (should pay).
 */
export function calculateNetBalances(
  memberIds: string[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  settlements: Settlement[]
): Record<string, number> {
  const net: Record<string, number> = {};
  memberIds.forEach((id) => (net[id] = 0));

  for (const expense of expenses) {
    net[expense.paid_by] = (net[expense.paid_by] ?? 0) + expense.amount;
  }

  for (const split of splits) {
    net[split.user_id] = (net[split.user_id] ?? 0) - split.amount;
  }

  for (const settlement of settlements) {
    net[settlement.paid_by] = (net[settlement.paid_by] ?? 0) + settlement.amount;
    net[settlement.paid_to] = (net[settlement.paid_to] ?? 0) - settlement.amount;
  }

  // Round to cents to avoid floating point dust.
  for (const id of Object.keys(net)) {
    net[id] = Math.round(net[id] * 100) / 100;
  }

  return net;
}

/**
 * Turns net balances into a minimal set of "who pays whom" transactions
 * (classic greedy debt-simplification, same idea Splitwise uses).
 */
export function simplifyDebts(net: Record<string, number>): Debt[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, amount] of Object.entries(net)) {
    if (amount > 0.005) creditors.push({ id, amount });
    else if (amount < -0.005) debtors.push({ id, amount: -amount });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts: Debt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    if (settled > 0.005) {
      debts.push({
        from: debtor.id,
        to: creditor.id,
        amount: Math.round(settled * 100) / 100,
      });
    }

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount <= 0.005) i++;
    if (creditor.amount <= 0.005) j++;
  }

  return debts;
}

/** Even split, cents distributed to the first N-1 people, remainder to the last. */
export function splitEqually(amount: number, memberIds: string[]): Record<string, number> {
  const shares: Record<string, number> = {};
  if (memberIds.length === 0) return shares;

  const perPerson = Math.floor((amount * 100) / memberIds.length) / 100;
  let allocated = 0;

  memberIds.forEach((id, idx) => {
    if (idx === memberIds.length - 1) {
      shares[id] = Math.round((amount - allocated) * 100) / 100;
    } else {
      shares[id] = perPerson;
      allocated += perPerson;
    }
  });

  return shares;
}
