import Dexie, { Table } from 'dexie';

export type TransactionType = 'income' | 'expense';
export type WalletType = 'cash' | 'bank' | 'ewallet';
export type DebtType = 'hutang' | 'piutang';

export interface Wallet {
  id?: number;
  userId?: string;
  name: string;
  type: WalletType;
  balance: number;
  initialBalance: number;
  color: string;
  createdAt: number;
}

export interface WalletTransfer {
  id?: number;
  userId?: string;
  fromWalletId: number;
  toWalletId: number;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  note: string;
  createdAt: number;
}

export interface Transaction {
  id?: number;
  userId?: string;
  walletId?: number;
  type: TransactionType;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  categoryId: number;
  note: string;
  createdAt: number;
}

export interface Category {
  id?: number;
  userId?: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  type?: 'expense' | 'income' | 'both';
}

export interface Budget {
  id?: number;
  userId?: string;
  categoryId: number;
  monthlyLimit: number;
}

export interface SavingsGoal {
  id?: number;
  userId?: string;
  name: string;
  targetAmount: number;
  deadline: string; // 'YYYY-MM-DD'
  savedAmount: number;
}

export interface RecurringBill {
  id?: number;
  userId?: string;
  name: string;
  amount: number;
  dueDay: number; // 1 - 31
  lastPaidMonth?: string; // 'YYYY-MM'
}

export interface Debt {
  id?: number;
  userId?: string;
  type: DebtType; // 'hutang' = saya pinjam, 'piutang' = orang pinjam
  personName: string;
  amount: number;
  dueDate?: string;
  note?: string;
  isPaid: boolean;
  paidAt?: number;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: any;
}

export interface LocalUser {
  id?: number;
  username: string;
  email: string;
  userId?: string;
  createdAt: number;
}

export class UangkuDatabase extends Dexie {
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, number>;
  budgets!: Table<Budget, number>;
  savingsGoals!: Table<SavingsGoal, number>;
  recurringBills!: Table<RecurringBill, number>;
  settings!: Table<Setting, string>;
  users!: Table<LocalUser, number>;
  wallets!: Table<Wallet, number>;
  transfers!: Table<WalletTransfer, number>;
  debts!: Table<Debt, number>;

  constructor() {
    super('UangkuDB');
    this.version(1).stores({
      transactions: '++id, userId, type, amount, date, categoryId, createdAt',
      categories: '++id, userId, name, isDefault',
      budgets: '++id, userId, categoryId',
      savingsGoals: '++id, userId, name, deadline',
      recurringBills: '++id, userId, name, dueDay, lastPaidMonth',
      settings: 'key',
      users: '++id, username, email, userId',
    });
    this.version(2).stores({
      transactions: '++id, userId, walletId, type, amount, date, categoryId, createdAt',
      categories: '++id, userId, name, isDefault',
      budgets: '++id, userId, categoryId',
      savingsGoals: '++id, userId, name, deadline',
      recurringBills: '++id, userId, name, dueDay, lastPaidMonth',
      settings: 'key',
      users: '++id, username, email, userId',
      wallets: '++id, userId, name, type, createdAt',
      transfers: '++id, userId, fromWalletId, toWalletId, date, createdAt',
      debts: '++id, userId, type, isPaid, dueDate, createdAt',
    });
  }
}

export const db = new UangkuDatabase();

/**
 * Lookup email from username in local IndexedDB
 */
export async function findEmailByUsername(username: string): Promise<string | null> {
  const cleanUsername = username.trim().toLowerCase();
  const found = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
  return found?.email || null;
}

/**
 * Register or update local user profile
 */
export async function saveLocalUser(username: string, email: string, userId?: string) {
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  const existingByUid = userId
    ? await db.users.where('userId').equals(userId).first()
    : undefined;
  const existingByName = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
  const existing = existingByUid || existingByName;

  if (existing?.id) {
    await db.users.update(existing.id, {
      username: cleanUsername,
      email: cleanEmail,
      userId: userId || existing.userId,
    });
  } else {
    await db.users.add({
      username: cleanUsername,
      email: cleanEmail,
      userId,
      createdAt: Date.now(),
    });
  }
}

// Default categories (no dummy transactions, budgets, savings, or bills are seeded)
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Makan', icon: 'Utensils', color: '#f97316', isDefault: true, type: 'expense' },
  { name: 'Transport', icon: 'Car', color: '#3b82f6', isDefault: true, type: 'expense' },
  { name: 'Belanja', icon: 'ShoppingBag', color: '#a855f7', isDefault: true, type: 'expense' },
  { name: 'Tagihan', icon: 'Receipt', color: '#ef4444', isDefault: true, type: 'expense' },
  { name: 'Hiburan', icon: 'Gamepad2', color: '#ec4899', isDefault: true, type: 'expense' },
  { name: 'Kesehatan', icon: 'HeartPulse', color: '#10b981', isDefault: true, type: 'expense' },
  { name: 'Pendidikan', icon: 'GraduationCap', color: '#06b6d4', isDefault: true, type: 'expense' },
  { name: 'Lainnya', icon: 'MoreHorizontal', color: '#64748b', isDefault: true, type: 'both' },
  { name: 'Gaji & Pendapatan', icon: 'Wallet', color: '#15803d', isDefault: true, type: 'income' },
];

/**
 * Initializes database with ONLY default categories and default currency setting.
 * User transactions, budgets, savings goals, and recurring bills start completely empty.
 */
export async function initializeDatabase() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
  }

  const currencySetting = await db.settings.get('currency');
  if (!currencySetting) {
    await db.settings.put({ key: 'currency', value: 'IDR' });
  }
}

/**
 * Ensures a new user has one empty default wallet ("Tunai" with Rp 0) if they have never initialized wallets.
 */
export async function ensureDefaultWallet(userId: string) {
  if (!userId || userId === 'guest') return;
  const flagKey = `uangku-wallet-init-${userId}`;
  if (typeof window !== 'undefined' && window.localStorage.getItem(flagKey)) {
    return;
  }
  const existingCount = await db.wallets.where('userId').equals(userId).count();
  if (existingCount === 0) {
    await db.wallets.add({
      userId,
      name: 'Tunai',
      type: 'cash',
      balance: 0,
      initialBalance: 0,
      color: '#10b981',
      createdAt: Date.now(),
    });
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(flagKey, '1');
  }
}

/**
 * Add transaction and atomically adjust selected wallet balance
 */
export async function addTransactionWithWallet(txData: Omit<Transaction, 'id'>): Promise<number> {
  return await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const newId = await db.transactions.add(txData as Transaction);
    if (txData.walletId) {
      const wallet = await db.wallets.get(txData.walletId);
      if (wallet?.id) {
        const delta = txData.type === 'income' ? txData.amount : -txData.amount;
        await db.wallets.update(wallet.id, {
          balance: (wallet.balance || 0) + delta,
        });
      }
    }
    return newId as number;
  });
}

/**
 * Update transaction and atomically reconcile old & new wallet balances
 */
export async function updateTransactionWithWallet(
  txId: number,
  newTxData: Omit<Transaction, 'id'>
): Promise<void> {
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const oldTx = await db.transactions.get(txId);
    if (oldTx?.walletId) {
      const oldWallet = await db.wallets.get(oldTx.walletId);
      if (oldWallet?.id) {
        const revertDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
        await db.wallets.update(oldWallet.id, {
          balance: (oldWallet.balance || 0) + revertDelta,
        });
      }
    }

    await db.transactions.update(txId, newTxData);

    if (newTxData.walletId) {
      const newWallet = await db.wallets.get(newTxData.walletId);
      if (newWallet?.id) {
        const applyDelta = newTxData.type === 'income' ? newTxData.amount : -newTxData.amount;
        await db.wallets.update(newWallet.id, {
          balance: (newWallet.balance || 0) + applyDelta,
        });
      }
    }
  });
}

/**
 * Delete transaction and atomically revert its effect on wallet balance
 */
export async function deleteTransactionWithWallet(txId: number): Promise<void> {
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const oldTx = await db.transactions.get(txId);
    if (oldTx?.walletId) {
      const wallet = await db.wallets.get(oldTx.walletId);
      if (wallet?.id) {
        const revertDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
        await db.wallets.update(wallet.id, {
          balance: (wallet.balance || 0) + revertDelta,
        });
      }
    }
    await db.transactions.delete(txId);
  });
}

/**
 * Atomically transfer funds between two wallets and log the transfer
 */
export async function transferBetweenWallets(params: {
  userId: string;
  fromWalletId: number;
  toWalletId: number;
  amount: number;
  date: string;
  note?: string;
}): Promise<number> {
  const { userId, fromWalletId, toWalletId, amount, date, note = '' } = params;
  if (fromWalletId === toWalletId) {
    throw new Error('Dompet asal dan dompet tujuan tidak boleh sama.');
  }
  if (!amount || amount <= 0) {
    throw new Error('Nominal transfer harus lebih dari 0.');
  }

  return await db.transaction('rw', [db.wallets, db.transfers], async () => {
    const fromWallet = await db.wallets.get(fromWalletId);
    const toWallet = await db.wallets.get(toWalletId);
    if (!fromWallet?.id || !toWallet?.id) {
      throw new Error('Dompet tidak ditemukan.');
    }

    await db.wallets.update(fromWallet.id, {
      balance: (fromWallet.balance || 0) - amount,
    });
    await db.wallets.update(toWallet.id, {
      balance: (toWallet.balance || 0) + amount,
    });

    const transferId = await db.transfers.add({
      userId,
      fromWalletId,
      toWalletId,
      amount,
      date,
      note: note.trim(),
      createdAt: Date.now(),
    });

    return transferId as number;
  });
}
