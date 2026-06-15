import { Product, SaleInvoice, Expense, ReceiptLog, SystemAuditLog } from "../types.ts";

const PRODUCTS_KEY = "suitpro_products";
const SALES_KEY = "suitpro_sales";
const EXPENSES_KEY = "suitpro_expenses";
const RECEIPTS_KEY = "suitpro_receipts";
const LOGS_KEY = "suitpro_logs";

// Mock catalog for first-time seeding
export const INITIAL_CATALOG: Product[] = [];

// Helper to get from localStorage with fallback
function getLocalItem<T>(key: string, fallback: T): T {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Helper to seed database if empty
export async function seedDatabaseIfEmpty() {
  try {
    const products = getLocalItem<Product[]>(PRODUCTS_KEY, []);
    if (products.length === 0) {
      setLocalItem(PRODUCTS_KEY, INITIAL_CATALOG);
      
      const logs = getLocalItem<SystemAuditLog[]>(LOGS_KEY, []);
      const bootLogId = `log-boot-${Date.now()}`;
      logs.push({
        id: bootLogId,
        type: "info",
        message: "System catalog database bootstrapped successfully in offline-first secure storage.",
        timestamp: new Date().toISOString()
      });
      setLocalItem(LOGS_KEY, logs);
    }
  } catch (err) {
    console.error("Local database seeding failed: ", err);
  }
}

// 1. PRODUCTS SERVICES
export async function getProducts(): Promise<Product[]> {
  await seedDatabaseIfEmpty();
  return getLocalItem<Product[]>(PRODUCTS_KEY, INITIAL_CATALOG);
}

export async function addProduct(p: Omit<Product, "id">): Promise<string> {
  const products = await getProducts();
  const newId = `p-${Date.now()}`;
  const newProd = { id: newId, ...p };
  products.push(newProd);
  setLocalItem(PRODUCTS_KEY, products);
  return newId;
}

export async function updateProduct(p: Product): Promise<void> {
  const products = await getProducts();
  const idx = products.findIndex(item => item.id === p.id);
  if (idx !== -1) {
    products[idx] = p;
    setLocalItem(PRODUCTS_KEY, products);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await getProducts();
  const filtered = products.filter(item => item.id !== id);
  setLocalItem(PRODUCTS_KEY, filtered);
}

// 2. SALES SERVICES
export async function getSales(): Promise<SaleInvoice[]> {
  return getLocalItem<SaleInvoice[]>(SALES_KEY, []);
}

export async function addSaleInvoice(sale: SaleInvoice): Promise<void> {
  const sales = await getSales();
  sales.push(sale);
  setLocalItem(SALES_KEY, sales);
  
  // Decrease inventory stock counts for checkout items in localstorage
  const products = await getProducts();
  for (const item of sale.items) {
    const idx = products.findIndex(p => p.id === item.id);
    if (idx !== -1) {
      products[idx].stock = Math.max(0, products[idx].stock - item.qty);
    }
  }
  setLocalItem(PRODUCTS_KEY, products);
}

// 3. EXPENSES SERVICES
export async function getExpenses(): Promise<Expense[]> {
  return getLocalItem<Expense[]>(EXPENSES_KEY, []);
}

export async function addExpense(exp: Expense): Promise<void> {
  const expenses = await getExpenses();
  expenses.push(exp);
  setLocalItem(EXPENSES_KEY, expenses);
}

// 4. RECEIPTS SERVICES
export async function getReceiptLogs(): Promise<ReceiptLog[]> {
  return getLocalItem<ReceiptLog[]>(RECEIPTS_KEY, []);
}

export async function addReceiptLog(receipt: ReceiptLog): Promise<void> {
  const receipts = await getReceiptLogs();
  receipts.push(receipt);
  setLocalItem(RECEIPTS_KEY, receipts);
}

// 5. OPERATIONAL AUDIT SYSTEM LOGS
export async function getSystemLogs(): Promise<SystemAuditLog[]> {
  return getLocalItem<SystemAuditLog[]>(LOGS_KEY, []);
}

export async function addSystemLog(log: Omit<SystemAuditLog, "id">): Promise<void> {
  const logs = await getSystemLogs();
  const newId = `log-${Date.now()}`;
  logs.push({ id: newId, ...log });
  setLocalItem(LOGS_KEY, logs);
}
