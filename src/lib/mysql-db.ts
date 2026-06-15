import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Production MySQL configuration parameters
const MYSQL_HOST = process.env.MYSQL_HOST || process.env.DB_HOST || "localhost";
const MYSQL_USER = process.env.MYSQL_USER || process.env.DB_USER || "u473489494_suitproepos";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "Rum3l@1998";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || process.env.DB_NAME || "u473489494_suitproepos";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || "3306", 10);

let pool: mysql.Pool | null = null;
let mysqlConnected = false;

/**
 * Checks whether the MySQL database is active and connected
 */
export function isMysqlActive(): boolean {
  return mysqlConnected;
}

/**
 * Establishes or retrieves the active connection pool
 */
export async function getMysqlPool() {
  if (pool) return pool;

  try {
    pool = mysql.createPool({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      port: MYSQL_PORT,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      connectTimeout: 6000
    });

    const connection = await pool.getConnection();
    console.log(`[MYSQL-PROD] Connected successfully: pool opened for '${MYSQL_DATABASE}' @ '${MYSQL_HOST}:${MYSQL_PORT}'`);
    connection.release();
    mysqlConnected = true;
    return pool;
  } catch (err: any) {
    console.log(`[MYSQL-OFFLINE-MODE] Local persistent data ledger active. Standing by for remote database sync. (Host default: ${MYSQL_HOST})`);
    mysqlConnected = false;
    pool = null;
    return null;
  }
}

/**
 * Execute standard query on active MySQL database
 */
export async function dbQuery(sql: string, params: any[] = []): Promise<any> {
  const activePool = await getMysqlPool();
  if (!activePool) {
    throw new Error("Local database isolation active: MySQL is unreachable");
  }
  const [rows] = await activePool.execute(sql, params);
  return rows;
}

/**
 * Create necessary MySQL tables automatically on database startup if they don't exist
 */
export async function bootstrapSchema() {
  const activePool = await getMysqlPool();
  if (!activePool) {
    console.warn("[MYSQL SCHEMA] Offline storage operational, bypassing remote migrations.");
    return;
  }

  try {
    console.log("[MYSQL SCHEMA] Bootstrapping production table indexes...");

    // 1. system_config table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        brand_name VARCHAR(255) NOT NULL DEFAULT 'SUIT PRO',
        brand_logo_url TEXT NULL,
        tax_rate_pct DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
        default_invoice_greeting VARCHAR(255) NOT NULL DEFAULT 'Thank you for shopping with SUIT PRO London'
      );
    `);

    // 2. users table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL
      );
    `);

    // 3. products table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        barcode_sku VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        size VARCHAR(32) NOT NULL,
        colour VARCHAR(64) NOT NULL,
        cost_price DECIMAL(10, 2) NOT NULL,
        selling_price DECIMAL(10, 2) NOT NULL,
        stock_qty INT NOT NULL DEFAULT 0
      );
    `);

    // 4. sales_transactions table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS sales_transactions (
        id VARCHAR(64) PRIMARY KEY,
        invoice_id VARCHAR(128) UNIQUE NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        vat_amount DECIMAL(10, 2) NOT NULL,
        total_due DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        amount_received DECIMAL(10, 2) NOT NULL,
        change_returned DECIMAL(10, 2) NOT NULL,
        remaining_balance DECIMAL(10, 2) NOT NULL,
        salesperson VARCHAR(100) NOT NULL,
        net_profit DECIMAL(10, 2) NOT NULL,
        timestamp VARCHAR(64) NULL
      );
    `);

    // 5. sales_items table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS sales_items (
        id VARCHAR(64) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        qty INT NOT NULL,
        item_total DECIMAL(10, 2) NOT NULL
      );
    `);

    // 6. expenses_ledger table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS expenses_ledger (
        id VARCHAR(64) PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        reference VARCHAR(255) NOT NULL,
        date VARCHAR(64) NOT NULL,
        timestamp VARCHAR(64) NOT NULL
      );
    `);

    // Seed Owner "Rumel" (Master owner) / Passcode: "123456" into MySQL if absent
    const users = await dbQuery("SELECT * FROM users WHERE username = 'Rumel'");
    if (users.length === 0) {
      await dbQuery(
        "INSERT INTO users (id, username, password_hash, full_name, user_role) VALUES (?, ?, ?, ?, ?)",
        ["user-owner-rumel", "Rumel", "123456", "Rumel Ahmed", "Owner"]
      );
      console.log("[MYSQL SCHEMA] Seeded System Owner profile 'Rumel Ahmed' / Passcode '123456'.");
    }

    console.log("[MYSQL SCHEMA] Production MySQL setup successfully completed.");
  } catch (err: any) {
    console.log(`[MYSQL SCHEMA] Table initialization: standby mode active.`);
  }
}

/**
 * Retrieve unified products catalog from MySQL if available
 */
export async function getMysqlProducts(): Promise<any[] | null> {
  if (!isMysqlActive()) return null;
  try {
    const rows = await dbQuery("SELECT * FROM products");
    return rows.map((r: any) => ({
      id: r.id,
      barcode: r.barcode_sku,
      name: r.name,
      size: r.size,
      colour: r.colour,
      costPrice: parseFloat(r.cost_price),
      sellingPrice: parseFloat(r.selling_price),
      stock: parseInt(r.stock_qty, 10)
    }));
  } catch (err) {
    console.log("[MYSQL-PROD] Readying local ledger state representation.");
    return null;
  }
}

/**
 * Adds or Updates products in MySQL database
 */
export async function writeMysqlProduct(p: any): Promise<boolean> {
  if (!isMysqlActive()) return false;
  try {
    await dbQuery(`
      INSERT INTO products (id, barcode_sku, name, size, colour, cost_price, selling_price, stock_qty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        barcode_sku = VALUES(barcode_sku),
        name = VALUES(name),
        size = VALUES(size),
        colour = VALUES(colour),
        cost_price = VALUES(cost_price),
        selling_price = VALUES(selling_price),
        stock_qty = VALUES(stock_qty)
    `, [p.id, p.barcode, p.name, p.size, p.colour, p.costPrice, p.sellingPrice, p.stock]);
    return true;
  } catch (err) {
    console.log(`[MYSQL-PROD] SKU writing ${p.barcode} handled via local cache fallback.`);
    return false;
  }
}

/**
 * Deletes product from MySQL database
 */
export async function deleteMysqlProduct(id: string): Promise<boolean> {
  if (!isMysqlActive()) return false;
  try {
    await dbQuery("DELETE FROM products WHERE id = ?", [id]);
    return true;
  } catch (err) {
    console.log(`[MYSQL-PROD] ID purging ${id} handled via local cache fallback.`);
    return false;
  }
}
