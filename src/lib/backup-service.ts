import fs from "fs";
import os from "os";
import path from "path";

// Paths aligned with server environment
const dataRoot = process.env.SUITPRO_DATA_DIR
  ? path.resolve(process.env.SUITPRO_DATA_DIR)
  : process.cwd();
const configDbPath = path.join(dataRoot, "data", "backup_config.json");
const auditLogPath = path.join(dataRoot, "suitpro_system_audits.log");
const FALLBACK_BACKUP_DIR = path.join(dataRoot, "backups");

function getDefaultBackupRoot(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "SuitPro", "Backups");
  }
  return path.join(os.homedir(), "SuitPro", "Backups");
}

export function resolveBackupStorageRoot(rawPath?: string): string {
  const configured = (rawPath || "").trim();
  if (!configured) {
    return getDefaultBackupRoot();
  }

  const normalized = configured.replace(/\\/g, "/").replace(/\/$/, "");
  return normalized || getDefaultBackupRoot();
}

export function ensureBackupDirectory(targetPath?: string): string {
  const targetDir = resolveBackupStorageRoot(targetPath);
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  } catch (err) {
    if (!fs.existsSync(FALLBACK_BACKUP_DIR)) {
      fs.mkdirSync(FALLBACK_BACKUP_DIR, { recursive: true });
    }
    return FALLBACK_BACKUP_DIR;
  }
}

// In-memory or persisted configuration
export interface BackupConfig {
  enabled: boolean;
  cronExpression: string; // e.g. "0 0 * * *" or "*/30 * * * *"
  lastRun: string | null;
  nextRun: string | null;
  backupDir?: string;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  cronExpression: "0 0 * * *", // Daily at Midnight
  lastRun: null,
  nextRun: null,
  backupDir: ""
};

export function getActualBackupDir(): string {
  const config = getBackupConfig();
  if (config.backupDir && config.backupDir.trim() !== "") {
    return ensureBackupDirectory(config.backupDir);
  }
  return ensureBackupDirectory("");
}

// Log system events to centralized corporate system logs
function logBackupEvent(type: "INFO" | "WARNING" | "CRITICAL", message: string) {
  const stamp = new Date().toISOString();
  const formatMsg = `[${stamp}] [${type}] [CRON-BACKUP] ${message}\n`;
  try {
    fs.appendFileSync(auditLogPath, formatMsg, "utf8");
  } catch (err) {
    // Fail-safe console fallback
  }
  console.log(`[BACKUP-SERVICE] ${formatMsg.trim()}`);
}

// Get scheduler config
export function getBackupConfig(): BackupConfig {
  try {
    if (fs.existsSync(configDbPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configDbPath, "utf8"));
      // Make sure we have estimated next run calculated if not present
      if (!savedConfig.nextRun && savedConfig.cronExpression) {
        savedConfig.nextRun = calculateNextRun(savedConfig.cronExpression);
      }
      return { ...DEFAULT_CONFIG, ...savedConfig };
    }
  } catch (err) {
    // Ignore and return defaults
  }
  const defaultConf = { ...DEFAULT_CONFIG };
  defaultConf.nextRun = calculateNextRun(defaultConf.cronExpression);
  return defaultConf;
}

// Save scheduler config
export function saveBackupConfig(config: Partial<BackupConfig>): BackupConfig {
  const current = getBackupConfig();
  const updated = { ...current, ...config };
  
  // Calculate next run on expression change or enable state change
  if (config.cronExpression || config.enabled !== undefined) {
    updated.nextRun = updated.enabled ? calculateNextRun(updated.cronExpression) : null;
  }
  
  try {
    const parentDir = path.dirname(configDbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(configDbPath, JSON.stringify(updated, null, 2), "utf8");
  } catch (err) {
    logBackupEvent("WARNING", `Failed to persist backup configurations: ${(err as Error).message}`);
  }
  return updated;
}

// Helper to calculate simple next estimated run coordinates for UI & tracking purposes
export function calculateNextRun(cronExpression: string): string {
  const now = new Date();
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    // Default fallback to 12 hours from now
    return new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  }

  // Handle common intervals quickly and gracefully
  const minutePart = parts[0];
  const hourPart = parts[1];

  let next = new Date(now.getTime());
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (minutePart.startsWith("*/")) {
    const step = parseInt(minutePart.split("/")[1], 10) || 30;
    const currentMin = next.getMinutes();
    const remaining = step - (currentMin % step);
    next.setMinutes(currentMin + remaining);
    return next.toISOString();
  } else if (hourPart.startsWith("*/")) {
    const step = parseInt(hourPart.split("/")[1], 10) || 12;
    const currentHour = next.getHours();
    const remaining = step - (currentHour % step);
    next.setMinutes(0);
    next.setHours(currentHour + remaining);
    return next.toISOString();
  } else {
    // Default Daily fallback (Next day at targeted minute/hour if specified, else next midnight)
    const targetMin = parseInt(minutePart, 10) || 0;
    const targetHour = parseInt(hourPart, 10) || 0;
    next.setHours(targetHour);
    next.setMinutes(targetMin);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }
}

// Zero-dependency Cron String time matcher
export function matchCronPart(currentVal: number, cronPart: string): boolean {
  if (cronPart === "*") return true;
  
  if (cronPart.includes(",")) {
    return cronPart.split(",").some(part => matchCronPart(currentVal, part));
  }
  
  if (cronPart.includes("/")) {
    const [range, stepStr] = cronPart.split("/");
    const step = parseInt(stepStr, 10);
    if (isNaN(step)) return false;
    
    if (range === "*") {
      return currentVal % step === 0;
    }
    if (range.includes("-")) {
      const [start, end] = range.split("-").map(Number);
      return currentVal >= start && currentVal <= end && (currentVal - start) % step === 0;
    }
    const val = parseInt(range, 10);
    return !isNaN(val) && currentVal >= val && (currentVal - val) % step === 0;
  }
  
  if (cronPart.includes("-")) {
    const [start, end] = cronPart.split("-").map(Number);
    return currentVal >= start && currentVal <= end;
  }
  
  return parseInt(cronPart, 10) === currentVal;
}

export function matchesCron(time: Date, cronExpression: string): boolean {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  const m = time.getMinutes();
  const h = time.getHours();
  const dom = time.getDate();
  const mon = time.getMonth() + 1; // 1-indexed for cron
  const dow = time.getDay(); // 0 is Sunday
  
  return (
    matchCronPart(m, parts[0]) &&
    matchCronPart(h, parts[1]) &&
    matchCronPart(dom, parts[2]) &&
    matchCronPart(mon, parts[3]) &&
    matchCronPart(dow, parts[4])
  );
}

// Create SQL relational schema and records representation
export function generateBackupSql(products: any[], ledgerData: string): string {
  let sqlContent = `-- =========================================================\n`;
  sqlContent += `-- SUIT PRO LONDON - AUTOMATIC RELATIONAL DATABASE BACKUP DUMP\n`;
  sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
  sqlContent += `-- =========================================================\n\n`;
  
  // Config schema and seed
  sqlContent += `CREATE TABLE IF NOT EXISTS system_config (id SERIAL PRIMARY KEY, brand_name VARCHAR(255), tax_rate_pct NUMERIC(5,2));\n`;
  sqlContent += `INSERT INTO system_config (id, brand_name, tax_rate_pct) VALUES (1, 'SUIT PRO', 20.00) ON CONFLICT DO NOTHING;\n\n`;

  // Products table schema
  sqlContent += `CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY, barcode_sku VARCHAR(64) UNIQUE, name VARCHAR(255), size VARCHAR(32), colour VARCHAR(64), cost_price NUMERIC(10,2), selling_price NUMERIC(10,2), stock_qty INT);\n`;
  products.forEach((p: any) => {
    const escapedName = p.name.replace(/'/g, "''");
    const escapedColour = (p.colour || "N/A").replace(/'/g, "''");
    sqlContent += `INSERT INTO products (barcode_sku, name, size, colour, cost_price, selling_price, stock_qty) VALUES ('${p.barcode}', '${escapedName}', '${p.size}', '${escapedColour}', ${p.costPrice}, ${p.sellingPrice}, ${p.stock}) ON CONFLICT (barcode_sku) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, stock_qty = EXCLUDED.stock_qty;\n`;
  });
  sqlContent += `\n`;

  // Sales table schema
  sqlContent += `CREATE TABLE IF NOT EXISTS sales_transactions (id UUID PRIMARY KEY, invoice_id VARCHAR(128) UNIQUE, subtotal NUMERIC(10,2), vat_amount NUMERIC(10,2), total_due NUMERIC(10,2), payment_method VARCHAR(50), amount_received NUMERIC(10,2), change_returned NUMERIC(10,2), remaining_balance NUMERIC(10,2), salesperson VARCHAR(100), net_profit NUMERIC(10,2), customer_name VARCHAR(255), customer_phone VARCHAR(64), customer_email VARCHAR(255), receipt_dispatch VARCHAR(50));\n`;
  const salesLines = ledgerData.split("\n");
  for (let i = 1; i < salesLines.length; i++) {
    const line = salesLines[i].trim();
    if (!line) continue;
    
    // Parse commas while respecting quotes
    const cols: string[] = [];
    let insideQuote = false;
    let entry = "";
    
    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        cols.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    cols.push(entry.trim());

    if (cols.length < 8) continue;
    const invoiceId = cols[0].replace(/^["']|["']$/g, "");
    const subtotal = parseFloat(cols[3]) || 0;
    const vat = parseFloat(cols[4]) || 0;
    const total = parseFloat(cols[5]) || 0;
    const profit = parseFloat(cols[6]) || 0;
    const method = cols[7].replace(/^["']|["']$/g, "");
    const seller = (cols[8] || "Cashier").replace(/^["']|["']$/g, "").replace(/'/g, "''");
    
    const cName = (cols[9] || "").replace(/^["']|["']$/g, "").replace(/'/g, "''");
    const cPhone = (cols[10] || "").replace(/^["']|["']$/g, "").replace(/'/g, "''");
    const cEmail = (cols[11] || "").replace(/^["']|["']$/g, "").replace(/'/g, "''");
    const cDispatch = (cols[12] || "none").replace(/^["']|["']$/g, "").replace(/'/g, "''");

    sqlContent += `INSERT INTO sales_transactions (invoice_id, subtotal, vat_amount, total_due, payment_method, salesperson, net_profit, customer_name, customer_phone, customer_email, receipt_dispatch) VALUES ('${invoiceId}', ${subtotal}, ${vat}, ${total}, '${method}', '${seller}', ${profit}, '${cName}', '${cPhone}', '${cEmail}', '${cDispatch}') ON CONFLICT (invoice_id) DO NOTHING;\n`;
  }
  return sqlContent;
}

// Perform active live database dump to the filesystem
export function runDatabaseDump(products: any[], ledgerData: string): { success: boolean; file_name: string; file_path: string } {
  try {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `suitpro_backup_${timestampStr}.sql`;
    const targetDir = getActualBackupDir();
    const targetFilePath = path.join(targetDir, backupFileName);

    const sqlContent = generateBackupSql(products, ledgerData);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.writeFileSync(targetFilePath, sqlContent, "utf8");
    logBackupEvent("INFO", `Created backup dump at '${targetFilePath}'`);
    
    // Update config lastRun coordinate
    saveBackupConfig({ lastRun: new Date().toISOString() });
    
    return {
      success: true,
      file_name: backupFileName,
      file_path: targetFilePath
    };
  } catch (err: any) {
    logBackupEvent("CRITICAL", `Incremental dump failed: ${err.message}`);
    throw err;
  }
}

// Verify backup file specification and security threats
export function verifyBackupFile(rawSqlText: string, name: string = "uploaded_backup.sql"): any {
  const sizeKb = Math.round(Buffer.byteLength(rawSqlText, "utf8") / 1024);
  
  const hasConfig = rawSqlText.includes("system_config");
  const hasProducts = rawSqlText.includes("INSERT INTO products");
  const hasSales = rawSqlText.includes("INSERT INTO sales_transactions");

  const lines = rawSqlText.split("\n");
  let productCount = 0;
  let transactionCount = 0;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("INSERT INTO products")) {
      productCount++;
    } else if (trimmed.startsWith("INSERT INTO sales_transactions")) {
      transactionCount++;
    }
  });

  const isSecure = !rawSqlText.includes("DROP DATABASE") && !rawSqlText.includes("TRUNCATE");
  const isValid = (rawSqlText.includes("CREATE TABLE") || rawSqlText.includes("INSERT INTO")) && isSecure;

  return {
    success: true,
    file_name: name,
    size_kb: sizeKb,
    isValid,
    isSecure,
    productCount,
    transactionCount,
    hasConfig,
    hasProducts,
    hasSales,
    timestamp: new Date().toISOString()
  };
}

// Restore database and replace items safely
export function executeRestore(
  rawSql: string, 
  writeProductsFn: (products: any[]) => void, 
  ledgerPath: string
): { success: boolean; restored_products: number; restored_transactions: number } {
  if (!rawSql.includes("CREATE TABLE") || !rawSql.includes("INSERT INTO")) {
    throw new Error("Validation failed: Candidate backup does not contain valid SUIT PRO relational queries.");
  }

  const lines = rawSql.split("\n");
  const restoredProducts: any[] = [];
  let salesCount = 0;

  const newLedgerRows = ["Invoice ID,Timestamp,Items Summary,Subtotal (GBP),VAT 20% (GBP),Total Due (GBP),Net Margin Profit (GBP),Payment Method,Salesperson,Customer Name,Customer Phone,Customer Email,Receipt Dispatch Method\n"];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("INSERT INTO products")) {
      const prodMatch = trimmed.match(/VALUES \('(.*?)', '(.*?)', '(.*?)', '(.*?)', (.*?), (.*?), (.*?)\)/);
      if (prodMatch) {
        restoredProducts.push({
          id: `p-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          barcode: prodMatch[1],
          name: prodMatch[2].replace(/''/g, "'"),
          size: prodMatch[3],
          colour: prodMatch[4].replace(/''/g, "'"),
          costPrice: parseFloat(prodMatch[5]),
          sellingPrice: parseFloat(prodMatch[6]),
          stock: parseInt(prodMatch[7])
        });
      }
    } else if (trimmed.startsWith("INSERT INTO sales_transactions")) {
      const valuePartMatch = trimmed.match(/VALUES \((.*)\)/i);
      if (valuePartMatch) {
        const rawValues = valuePartMatch[1];
        const tokens: string[] = [];
        let insideStr = false;
        let token = "";
        for (let idx = 0; idx < rawValues.length; idx++) {
          const char = rawValues[idx];
          if (char === "'") {
            insideStr = !insideStr;
          } else if (char === "," && !insideStr) {
            tokens.push(token.trim());
            token = "";
          } else {
            token += char;
          }
        }
        tokens.push(token.trim());

        if (tokens.length >= 7) {
          const invoiceId = tokens[0].replace(/^'|'$/g, "");
          const subtotal = parseFloat(tokens[1]) || 0;
          const vat = parseFloat(tokens[2]) || 0;
          const total = parseFloat(tokens[3]) || 0;
          const method = tokens[4].replace(/^'|'$/g, "");
          const seller = tokens[5].replace(/^'|'$/g, "").replace(/''/g, "'");
          const profit = parseFloat(tokens[6]) || 0;
          const timestamp = new Date().toISOString();

          const cName = tokens[7] ? tokens[7].replace(/^'|'$/g, "").replace(/''/g, "'") : "";
          const cPhone = tokens[8] ? tokens[8].replace(/^'|'$/g, "").replace(/''/g, "'") : "";
          const cEmail = tokens[9] ? tokens[9].replace(/^'|'$/g, "").replace(/''/g, "'") : "";
          const cDispatch = tokens[10] ? tokens[10].replace(/^'|'$/g, "").replace(/''/g, "'") : "none";

          newLedgerRows.push(`"${invoiceId}","${timestamp}","Restored checkout items via recovery manager",${subtotal},${vat},${total},${profit},"${method}","${seller}","${cName.replace(/"/g, '""')}","${cPhone.replace(/"/g, '""')}","${cEmail.replace(/"/g, '""')}","${cDispatch}"\n`);
          salesCount++;
        }
      }
    }
  });

  if (restoredProducts.length > 0) {
    writeProductsFn(restoredProducts);
  }
  if (newLedgerRows.length > 1) {
    fs.writeFileSync(ledgerPath, newLedgerRows.join(""), "utf8");
  }

  logBackupEvent("INFO", `Reconstructed active database indexes. Items re-injected: ${restoredProducts.length}, Cashflows remapped: ${salesCount}`);
  
  return {
    success: true,
    restored_products: restoredProducts.length,
    restored_transactions: salesCount
  };
}

// Scheduled Cron Worker instance
let schedulerInterval: NodeJS.Timeout | null = null;
let lastRanMinute: number = -1;

export function initBackupScheduler(
  getProductsFn: () => any[],
  getLedgerFn: () => string
) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  logBackupEvent("INFO", "Corporate dynamic backup scheduler loaded.");

  schedulerInterval = setInterval(() => {
    const config = getBackupConfig();
    if (!config.enabled) return;

    const now = new Date();
    const currentMinute = now.getMinutes();

    // Prevent multiple executions in the exact same minute tick
    if (currentMinute !== lastRanMinute) {
      if (matchesCron(now, config.cronExpression)) {
        lastRanMinute = currentMinute;
        logBackupEvent("INFO", `Chronograph matched expression '${config.cronExpression}'! Triggering auto-dump.`);
        try {
          const prods = getProductsFn();
          const ledger = getLedgerFn();
          runDatabaseDump(prods, ledger);
        } catch (err: any) {
          logBackupEvent("CRITICAL", `Auto-dump tick operation failed: ${err.message}`);
        }
      }
    }
  }, 30000); // Poll clock alignment state every 30 seconds
}
