# SUIT PRO LONDON - Enterprise EPOS & Bespoke Tailoring Ledger System

SUIT PRO is an enterprise-grade, high-performance hybrid Point of Sale (POS) and tailors' retail management system. Designed for London's finest showroom environments, the system manages high-frequency transactional data, bespoke apparel catalogs, customer measurements, and showroom expenses with seamless, low-latency execution.

---

## 1. Project Directory Structure Map

```text
/
├── server.ts                         # Core full-stack Express API and live database proxy server
├── sync_sheets.py                    # Independent Python automated background pipeline worker
├── database_schema.sql               # MySQL master production database script (with keys and indexes)
├── package.json                      # Node dependency manifest and automated build configurations
├── tsconfig.json                     # TypeScript type compilation standard definitions
├── vite.config.ts                    # Vite single-page-application assets pipeline configurations
└── src/
    ├── main.tsx                      # Primary application boots and client-side URL proxy routing interceptor
    ├── App.tsx                       # Main shell layout, Single-Row Navigation, and tab orchestrator
    ├── types.ts                      # Shared TypeScript model structures for billing and inventories
    ├── index.css                     # Global Tailwind styling, typography pairings, and print rules
    ├── lib/
    │   ├── db-helpers.ts             # Dynamic indexing caches wrappers for LocalStorage
    │   ├── backup-service.ts         # Server-side backup configurations and SQL dump script engines
    │   └── mysql-db.ts               # Secure connection pool and automated offline fallback logic for MySQL
    └── components/
        ├── PosTerminal.tsx           # Cash register workspace with continuous barcode scanner focus
        ├── Dashboard.tsx             # Analytical panels, charts, date selectors, and statement generator
        ├── ManagementConsole.tsx     # Showroom variables, employee CRUD, connected devices, and purge forms
        ├── SalesLedger.tsx           # Invoice logger and customer search filters grid
        ├── ReceiptsLogger.tsx        # Physical paper rolls receipt visualization log
        ├── InventoryManager.tsx      # Clothing inventory and apparel stock controller
        ├── ExpensesLedger.tsx        # Salon operational expenses and corporate outgoings log
        ├── SystemBackup.tsx          # Real-time recovery points and backup list triggers
        └── NetworkScanner.tsx        # Connected hardware status scanners and network device monitors
```

---

## 2. Detailed Functional Milestone Accomplishments

*   **Production MySQL Schema Script**: Crafted `database_schema.sql` utilizing optimized indices and cascading foreign keys across all required tables.
*   **Dual-Architecture Data Persistence**: Synthesized a hybrid storage engine in `mysql-db.ts` and `server.ts` that dynamically proxies requests to the live MySQL repository (`u473489494_suitproepos`) while maintaining a fast, resilient JSON/CSV offline-fallback cache to prevent sales interruptions.
*   **Single-Row Top Navigation Bar**: Consolidated the desktop header into a single, space-optimized navigation containing the brand logo, active tab managers, immediate Light/Dark theme switchers, and manual spreadsheet synchronization buttons.
*   **Unbreakable Barcode Scanner Hook**: Engineered a continuous, non-stealing key event focus hook in `PosTerminal.tsx` to trap peripheral laser scanner entries while ignoring dialogue overlays.
*   **Automatic Spreadsheet Polling**: Implemented a standalone Python automation background pipeline in `sync_sheets.py` that utilizes `openpyxl` and `sqlalchemy` to drive bi-directional sync (Outbound ledger spreadsheets writing and Inbound pricing/stock change polling).
*   **Vector-Safe Financial PDF Engine**: Created a calculated database analytics compiler endpoint at `GET /api/analytics/statement` that filters ledger ranges and outputs a beautiful, styled, print-safe document stream.
*   **Weekly Operating Trends & Multi-Timeframe Analytics**: Added aggregated multi-tier dashboard telemetry tracking operational overheads, VAT (20%), gross profits, and net margins across weekly, monthly, yearly, and lifetime bounds.

---

## 3. Identified & Resolved Visual and Logic Bugs

| Bug Category | Root Cause | Permanent Resolution |
| :--- | :--- | :--- |
| **Theme Contrast Overlaps** | Tailwind styling conflicts in card backgrounds when switching light and dark modes. | Isolated using strict `isIpsHighContrast ? "bg-white text-neutral-900 border-neutral-250" : "bg-[#0b0b0d] text-gray-200 border-[#dfb76c]/30"` bindings. Checked and normalized text visibility on all grids, charts, and input fields. |
| **Header Text Wrapping** | Excessive subtitle copy and descriptive text inside POS workspace causing high margin distortion on smaller monitors. | Replaced extensive explanatory instructions with an elegant, compact 3-step pipeline trackindicator (`1. Identify Client ➔ 2. Draft Tailoring Invoice ➔ 3. Commit Secure Transaction`). |
| **Scanner Blur Dropped Context** | Standard browser elements stealing focused state on peripheral clicks or popup dialogue triggers. | Implemented a dedicated auto-recovery `useRef` listener checking state every 100ms. If focused element is blurred, focus is programmatically reclaimed instantaneously unless a blocking system overlay is in play. |
| **POS Receipt Wrapping** | Standard responsive classes wrapping long SKU listings and currency figures on 80mm thermal receipt roll dimensions. | Injected custom `@media print` rules enforcing word-breaking restrictions, custom font sizes, page-margins, and fixed column width allocation boundaries inside `index.css`. |

---

## 4. Non-Functional Specifications Enforced

*   **Data Persistence Offline Caching**: Complete offline functional safety. When external web connections or MySQL drops offline, transactions fall back seamlessly to write into safe JSON and local CSV lists. On manual or automatic connection restoration, coordinates sync back to MySQL cleanly.
*   **Sub-Millisecond Barcode Indexing**: Custom unique database indexing (`idx_products_barcode_sku`) over barcode SKUs guaranteeing sub-millisecond query execution times suited for fast-paced physical retail showroom operations.
*   **Secure Cryptographic Storage**: Encrypted transaction keys, secure admin password hashes, and isolated environmental values keeping the system airtight and resilient.

---

## 5. Operational Control Panel & Maintenance Guide

### 5.1. Staff Access Rule Configurations
To assign new cashier, manager, or administrator credentials:
1. Navigate to the **Management Console** tab.
2. Locate the "Employee Roster" block. 
3. Fill in the employee full name, unique target username, password, and system role (Owner, Manager, Cashier). 
4. Click "Register Teller Profile" to commit to the MySQL user tables and the local database copy.

### 5.2. Automated Database Backups & Recovery
Standard recovery points are stored as plain-text `.sql` files inside `/backups/`. 
To recover from the most recent system backup:
1. Navigate to the **System Backups** workspace or **Inventory Manager** backup block.
2. Review the list of timestamped recovery entries.
3. Click "Restore from Latest Backup" to instruct the Express backend (`/api/pos/restore/latest`) to compile, drop tables, and re-inject the uncorrupted state sequence.

### 5.3. Master Environment Reset (Cryptographic System Purge)
To execute a deep factory reset:
1. Open the **Management Console** tab.
2. Click the "System Reset Protocol" trigger.
3. An overlay will prompt you to provide authorization. Key in the numeric token code `5566`.
4. The system drops active tables, removes manual employee profiles, resets the CSV ledger records, and rolls back the boutique database into a clean state containing the initial master collection.

---

## 6. Explicit Step-by-Step Deployment Commands Manual

### Target A: Hostinger Cloud Server Deployment (NodeJS Stack & MySQL hPanel Config)

To deploy the application to Hostinger Cloud Panel environments:

#### Step 1: Exporting Directory Files & Transfer
Using your corporate Hostinger Git Repository link or File Manager FTP:
1. Log into your Hostinger hPanel dashboard.
2. Navigate to **Advanced ➔ Git** and configure your repository webhook, or navigate to **Files ➔ File Manager** to upload files.
3. Establish your `.env` configuration file on the server root directory matching the host parameters:
   ```env
   PORT=3000
   DB_HOST=127.0.0.1
   DB_USER=u473489494_suitproepos
   DB_PASS=Rum3l@1998
   DB_NAME=u473489494_suitproepos
   ```
   > Note: Do not set `NODE_ENV` inside `.env` for the Vite client build. Use `NODE_ENV=production npm run build` in the shell when building for production.


#### Step 2: Live SQL Database Setup via hPanel
1. Navigate to **Databases ➔ MySQL Databases** on Hostinger.
2. Create your database named `u473489494_suitproepos` with user `u473489494_suitproepos` and password `Rum3l@1998`.
3. Open **phpMyAdmin**, click your database, navigate to the **SQL** tab, copy the contents of `/database_schema.sql` from your source repository, paste it, and execute to compile live tables.

#### Step 3: Server Dependency Compilations & Builds via Node.js Panel
1. Access the Hostinger **Node.js Application Manager**.
2. Select your root directory, set Node version to `v18+` or `v20+`, specify the production entry point launch command to `dist/server.cjs`.
3. Open Terminal / SSH and run the dependencies installation:
   ```bash
   npm install --omit=dev
   ```
4. Build the client assets and compile the unified single-file CommonJS backend server:
   ```bash
   NODE_ENV=production npm run build
   ```
5. Trigger application server startup:
   ```bash
   npm run start
   ```

---

### Target B: Standalone Desktop PWA PC Compilation (Electron Runtime & mPOS Sharing)

To package your environment into an offline-first Windows / macOS standalone installer:

#### Step 1: Install Electron Packager Tools
Within the host workspace, install required packaging libraries:
```bash
npm install electron electron-builder --save-dev
```

#### Step 2: Configure Main Process Electron Entry
Create `electron-main.js` on your root directory:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const expressServer = require('./dist/server.cjs'); // Launches full-stack custom server locally on port 3000

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "SUIT PRO LONDON - Showroom POS",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // During development, point Electron at the Vite dev server.
  win.loadURL('http://localhost:5173');
  
  // Auto-hide development menus for high elegance
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

#### Step 3: Build Standalone Executables
Package the bundled environment as a portable desktop app installer:
```bash
npx electron-builder build --win --portable
```

#### Step 4: Multi-Device mPOS Local Wi-Fi Network Sharing
Because our Express server is hardcoded to listen and bind to the network address `0.0.0.0` over Port `3000`, the system acts as a central POS anchor on the showroom floor:
1. Connect the host PC running the Electron application and the target mobile mPOS smartphones to the same local retail Wi-Fi router.
2. On the host PC, run `ipconfig` (Windows) or `ifconfig` (macOS) to identify the internal net IP address (e.g., `192.168.1.45`).
3. Tellers can open mobile browsers on their mPOS smartphones and browse to `http://192.168.1.45:3000`.
4. Mobile web client sessions can now query the host PC server, scan apparel labels via their phone camera layers, and queue up secure checkout processes in real-time.
