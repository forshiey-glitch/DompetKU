import Dexie, { Table } from 'dexie';

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: number;
  userId?: string;
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

export class DompetKuDatabase extends Dexie {
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, number>;
  budgets!: Table<Budget, number>;
  savingsGoals!: Table<SavingsGoal, number>;
  recurringBills!: Table<RecurringBill, number>;
  settings!: Table<Setting, string>;
  users!: Table<LocalUser, number>;

  constructor() {
    super('DompetKuDB');
    this.version(1).stores({
      transactions: '++id, type, amount, date, categoryId, createdAt',
      categories: '++id, name, isDefault',
      budgets: '++id, categoryId',
      savingsGoals: '++id, name, deadline',
      recurringBills: '++id, name, dueDay, lastPaidMonth',
      settings: 'key',
    });
    this.version(2).stores({
      transactions: '++id, userId, type, amount, date, categoryId, createdAt',
      categories: '++id, userId, name, isDefault',
      budgets: '++id, userId, categoryId',
      savingsGoals: '++id, userId, name, deadline',
      recurringBills: '++id, userId, name, dueDay, lastPaidMonth',
      settings: 'key',
    });
    this.version(3).stores({
      transactions: '++id, userId, type, amount, date, categoryId, createdAt',
      categories: '++id, userId, name, isDefault',
      budgets: '++id, userId, categoryId',
      savingsGoals: '++id, userId, name, deadline',
      recurringBills: '++id, userId, name, dueDay, lastPaidMonth',
      settings: 'key',
      users: '++id, username, email, userId',
    });
  }
}

export const db = new DompetKuDatabase();

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

  const existing = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
  if (existing?.id) {
    await db.users.update(existing.id, {
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

// Default 8 categories required by specification + default income category
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
 * Initializes database with default categories and sample starting data if fresh.
 */
export async function initializeDatabase() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
  }

  // Check if we need default settings
  const themeSetting = await db.settings.get('theme');
  if (!themeSetting) {
    await db.settings.put({ key: 'theme', value: 'light' });
  }

  const currencySetting = await db.settings.get('currency');
  if (!currencySetting) {
    await db.settings.put({ key: 'currency', value: 'IDR' });
  }
}

/**
 * Seed realistic Indonesian sample data for demonstration / quick start
 */
export async function seedSampleData(userId = 'default-user') {
  const count = await db.transactions.count();
  if (count > 0) return;

  const categories = await db.categories.toArray();
  const catMap: Record<string, number> = {};
  categories.forEach((c) => {
    if (c.id) catMap[c.name] = c.id;
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
  const prevYear = now.getMonth() === 0 ? year - 1 : year;

  // Add sample transactions
  await db.transactions.bulkAdd([
    {
      userId,
      type: 'income',
      amount: 8500000,
      date: `${year}-${month}-01`,
      categoryId: catMap['Gaji & Pendapatan'] || 9,
      note: 'Gaji Bulanan',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      type: 'expense',
      amount: 45000,
      date: `${year}-${month}-01`,
      categoryId: catMap['Makan'] || 1,
      note: 'Makan Siang Nasi Padang',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      type: 'expense',
      amount: 120000,
      date: `${year}-${month}-02`,
      categoryId: catMap['Transport'] || 2,
      note: 'Bensin Motor & Parkir',
      createdAt: Date.now() - 86400000,
    },
    {
      type: 'expense',
      amount: 350000,
      date: `${year}-${month}-02`,
      categoryId: catMap['Belanja'] || 3,
      note: 'Belanja Mingguan Supermarket',
      createdAt: Date.now() - 86400000,
    },
    {
      type: 'expense',
      amount: 250000,
      date: `${year}-${month}-03`,
      categoryId: catMap['Tagihan'] || 4,
      note: 'Tagihan Listrik PLN',
      createdAt: Date.now(),
    },
    // Previous month sample
    {
      type: 'income',
      amount: 8500000,
      date: `${prevYear}-${prevMonth}-01`,
      categoryId: catMap['Gaji & Pendapatan'] || 9,
      note: 'Gaji Bulan Lalu',
      createdAt: Date.now() - 86400000 * 32,
    },
    {
      type: 'expense',
      amount: 1800000,
      date: `${prevYear}-${prevMonth}-10`,
      categoryId: catMap['Makan'] || 1,
      note: 'Total Makan Bulan Lalu',
      createdAt: Date.now() - 86400000 * 25,
    },
    {
      type: 'expense',
      amount: 600000,
      date: `${prevYear}-${prevMonth}-15`,
      categoryId: catMap['Transport'] || 2,
      note: 'Transport Bulan Lalu',
      createdAt: Date.now() - 86400000 * 20,
    },
  ]);

  // Add default budgets
  if (catMap['Makan']) {
    await db.budgets.add({ categoryId: catMap['Makan'], monthlyLimit: 2000000 });
  }
  if (catMap['Transport']) {
    await db.budgets.add({ categoryId: catMap['Transport'], monthlyLimit: 800000 });
  }
  if (catMap['Belanja']) {
    await db.budgets.add({ categoryId: catMap['Belanja'], monthlyLimit: 1500000 });
  }
  if (catMap['Tagihan']) {
    await db.budgets.add({ categoryId: catMap['Tagihan'], monthlyLimit: 1000000 });
  }

  // Add default savings goals
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 6);
  const deadlineStr = targetDate.toISOString().split('T')[0];

  await db.savingsGoals.bulkAdd([
    {
      name: 'Dana Darurat 6 Bulan',
      targetAmount: 25000000,
      savedAmount: 12500000,
      deadline: deadlineStr,
    },
    {
      name: 'Liburan Akhir Tahun',
      targetAmount: 7000000,
      savedAmount: 3200000,
      deadline: `${year}-12-25`,
    },
  ]);

  // Add recurring bills
  await db.recurringBills.bulkAdd([
    {
      name: 'Internet & WiFi Rumah',
      amount: 375000,
      dueDay: 10,
      lastPaidMonth: `${prevYear}-${prevMonth}`,
    },
    {
      name: 'Langganan Streaming (Netflix/Spotify)',
      amount: 186000,
      dueDay: 15,
      lastPaidMonth: `${year}-${month}`,
    },
    {
      name: 'Iuran Pengelolaan Lingkungan (IPL)',
      amount: 150000,
      dueDay: 5,
      lastPaidMonth: `${prevYear}-${prevMonth}`,
    },
  ]);
}
