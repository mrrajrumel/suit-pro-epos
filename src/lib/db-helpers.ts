import { ParentProduct, Product, SaleInvoice, Expense, ReceiptLog, SystemAuditLog, POSHardwareDevice } from "../types.ts";
import { publishCatalog } from "./catalog-service.ts";

const PRODUCTS_KEY = "suitpro_products";
const SALES_KEY = "suitpro_sales";
const EXPENSES_KEY = "suitpro_expenses";
const RECEIPTS_KEY = "suitpro_receipts";
const LOGS_KEY = "suitpro_logs";
const HARDWARE_KEY = "suitpro_hardware_devices";
let saleWriteQueue: Promise<void> = Promise.resolve();

const INITIAL_HARDWARE: POSHardwareDevice[] = [
  {
    id: "hw-printer-1",
    name: "EPSON TM-T88VI Thermal Printer",
    type: "Printer",
    interfaceType: "USB",
    brandModel: "Epson TM-T88VI",
    connectionInfo: "USB VendorID: 0x04B8, ProductID: 0x0E15",
    status: "Active",
    isSimulated: false
  },
  {
    id: "hw-pax-1",
    name: "PAX A920 Pro Smart Android POS Terminal",
    type: "Card Terminal",
    interfaceType: "LAN",
    brandModel: "PAX A920 Pro",
    connectionInfo: "IP: 192.168.1.200 (Port 8080)",
    status: "Active",
    isSimulated: false
  },
  {
    id: "hw-terminal-1",
    name: "CardPlus Integrated IPS Reader",
    type: "Card Terminal",
    interfaceType: "LAN",
    brandModel: "IPS-v500 Smart Reader",
    connectionInfo: "IP: 192.168.1.185",
    status: "Active",
    isSimulated: false
  },
  {
    id: "hw-drawer-1",
    name: "Heavy Duty RJ11 Cash Drawer",
    type: "Cash Drawer",
    interfaceType: "USB",
    brandModel: "APG Series 100",
    connectionInfo: "Connected via Epson Printer Port",
    status: "Active",
    isSimulated: false
  }
];

// High-fidelity structured ParentProduct catalog for first-time seeding
export const INITIAL_CATALOG: ParentProduct[] = [
  {
    id: "p-tuxedo",
    name: "Savile Row Bespoke Tuxedo",
    category: "Tuxedo",
    brand: "Savile Row",
    supplier: "Huntsman Tailors",
    unit: "PCS",
    purchasePrice: 250,
    sellingPrice: 699,
    wholesalePrice: 550,
    discountPrice: 649,
    offerPrice: 0,
    taxRatePct: 20.00,
    minStockAlert: 3,
    images: ["https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&auto=format&fit=crop&q=60"],
    shortDescription: "Immaculately structured, satin-lapel bespoke tuxedo.",
    fullDescription: "Designed for premium formal galas. Handcrafted with traditional floating canvases, high-gorge peaked lapels finished in pure faille silk, and unhemmed trousers prepared for custom length adjustments.",
    specifications: "100% Tasmanian Merino Wool, Silk Faille Trim, Double Vent.",
    features: "Genuine horn buttons, working sleeve buttonholes, classic satin side-stripes.",
    warrantyInfo: "Lifetime warranty on seams, lapel structure, and hand-stitch elements.",
    returnPolicy: "Complimentary return within 30 days or standard fitting refits at showroom.",
    productNotes: "Dry clean only. Store on wide mahogany hangers.",
    attributes: [
      { name: "Color", values: ["Midnight Blue", "Classic Black"] },
      { name: "Size", values: ["38R", "40R", "42R"] }
    ],
    variations: [
      {
        id: "v-tux-mb-38",
        sku: "SR-TUX-MB-38",
        barcode: "5012345000018",
        purchasePrice: 250,
        sellingPrice: 699,
        wholesalePrice: 550,
        discountPrice: 649,
        offerPrice: 0,
        stock: 12,
        attributeValues: { "Color": "Midnight Blue", "Size": "38R" }
      },
      {
        id: "v-tux-mb-40",
        sku: "SR-TUX-MB-40",
        barcode: "5012345000025",
        purchasePrice: 250,
        sellingPrice: 699,
        wholesalePrice: 550,
        discountPrice: 649,
        offerPrice: 0,
        stock: 15,
        attributeValues: { "Color": "Midnight Blue", "Size": "40R" }
      },
      {
        id: "v-tux-mb-42",
        sku: "SR-TUX-MB-42",
        barcode: "5012345000032",
        purchasePrice: 250,
        sellingPrice: 699,
        wholesalePrice: 550,
        discountPrice: 649,
        offerPrice: 0,
        stock: 8,
        attributeValues: { "Color": "Midnight Blue", "Size": "42R" }
      },
      {
        id: "v-tux-cb-38",
        sku: "SR-TUX-CB-38",
        barcode: "5012345000049",
        purchasePrice: 255,
        sellingPrice: 699,
        wholesalePrice: 550,
        discountPrice: 649,
        offerPrice: 0,
        stock: 14,
        attributeValues: { "Color": "Classic Black", "Size": "38R" }
      },
      {
        id: "v-tux-cb-40",
        sku: "SR-TUX-CB-40",
        barcode: "5012345000056",
        purchasePrice: 255,
        sellingPrice: 699,
        wholesalePrice: 550,
        discountPrice: 649,
        offerPrice: 0,
        stock: 18,
        attributeValues: { "Color": "Classic Black", "Size": "40R" }
      },
      {
        id: "v-tux-cb-42",
        sku: "SR-TUX-CB-42",
        barcode: "5012345000063",
        purchasePrice: 255,
        sellingPrice: 699,
        wholesalePrice: 550,
        discountPrice: 649,
        offerPrice: 0,
        stock: 10,
        attributeValues: { "Color": "Classic Black", "Size": "42R" }
      }
    ]
  },
  {
    id: "p-tweed",
    name: "Chelsea Wool Tweed Blazer",
    category: "Jackets",
    brand: "Chelsea",
    supplier: "Scabal Fabrics",
    unit: "PCS",
    purchasePrice: 140,
    sellingPrice: 380,
    wholesalePrice: 310,
    discountPrice: 350,
    offerPrice: 0,
    taxRatePct: 20.00,
    minStockAlert: 2,
    images: ["https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format&fit=crop&q=60"],
    shortDescription: "Elegant heritage-check wool tweed sportcoat.",
    fullDescription: "An indispensable blazer for high-class country style or London casual days. Tailored in an structured wool tweed with rich elbow patches, double flapped pockets, and a soft suede lining trim.",
    specifications: "100% British Lambswool, Leather Elbow Patches, Double Vent.",
    features: "Notched lapels, standard three-button configuration, interior ticket pocket.",
    warrantyInfo: "2-year structural seam and material warranty.",
    returnPolicy: "Showroom return or alteration exchange within 14 business days.",
    productNotes: "Avoid moisture, brush surface lightly after wear.",
    attributes: [
      { name: "Color", values: ["Charcoal Grey", "Forest Green"] },
      { name: "Size", values: ["40R", "42R"] }
    ],
    variations: [
      {
        id: "v-twd-cg-40",
        sku: "CH-TWD-CG-40",
        barcode: "5012345000117",
        purchasePrice: 140,
        sellingPrice: 380,
        wholesalePrice: 310,
        discountPrice: 350,
        offerPrice: 0,
        stock: 8,
        attributeValues: { "Color": "Charcoal Grey", "Size": "40R" }
      },
      {
        id: "v-twd-cg-42",
        sku: "CH-TWD-CG-42",
        barcode: "5012345000124",
        purchasePrice: 140,
        sellingPrice: 380,
        wholesalePrice: 310,
        discountPrice: 350,
        offerPrice: 0,
        stock: 5,
        attributeValues: { "Color": "Charcoal Grey", "Size": "42R" }
      },
      {
        id: "v-twd-fg-40",
        sku: "CH-TWD-FG-40",
        barcode: "5012345000131",
        purchasePrice: 145,
        sellingPrice: 385,
        wholesalePrice: 315,
        discountPrice: 355,
        offerPrice: 0,
        stock: 6,
        attributeValues: { "Color": "Forest Green", "Size": "40R" }
      },
      {
        id: "v-twd-fg-42",
        sku: "CH-TWD-FG-42",
        barcode: "5012345000148",
        purchasePrice: 145,
        sellingPrice: 385,
        wholesalePrice: 315,
        discountPrice: 355,
        offerPrice: 0,
        stock: 4,
        attributeValues: { "Color": "Forest Green", "Size": "42R" }
      }
    ]
  }
];

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
    const products = getLocalItem<ParentProduct[]>(PRODUCTS_KEY, []);
    if (products.length === 0) {
      setLocalItem(PRODUCTS_KEY, INITIAL_CATALOG);
      
      const logs = getLocalItem<SystemAuditLog[]>(LOGS_KEY, []);
      const bootLogId = `log-boot-${Date.now()}`;
      logs.push({
        id: bootLogId,
        type: "info",
        message: "System dynamic catalog database bootstrapped successfully with robust variations in showroom storage.",
        timestamp: new Date().toISOString()
      });
      setLocalItem(LOGS_KEY, logs);
    }
  } catch (err) {
    console.error("Local database seeding failed: ", err);
  }
}

// 1. PRODUCTS SERVICES
export async function getProducts(): Promise<ParentProduct[]> {
  await seedDatabaseIfEmpty();
  return getLocalItem<ParentProduct[]>(PRODUCTS_KEY, INITIAL_CATALOG);
}

export async function addProduct(p: ParentProduct): Promise<string> {
  const products = await getProducts();
  products.push(p);
  publishCatalog(products);
  return p.id;
}

export async function updateProduct(p: ParentProduct): Promise<void> {
  const products = await getProducts();
  const idx = products.findIndex(item => item.id === p.id);
  if (idx !== -1) {
    products[idx] = p;
    publishCatalog(products);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await getProducts();
  const filtered = products.filter(item => item.id !== id);
  publishCatalog(filtered);
}

// 2. SALES SERVICES
export async function getSales(): Promise<SaleInvoice[]> {
  return getLocalItem<SaleInvoice[]>(SALES_KEY, []);
}

export async function addSaleInvoice(sale: SaleInvoice): Promise<void> {
  const write = saleWriteQueue.then(async () => {
    const sales = await getSales();
    if (sales.some((existingSale) => existingSale.id === sale.id)) return;

    const products = await getProducts();
    const requiredStock = new Map<string, number>();
    for (const item of sale.items) {
      const quantity = Math.trunc(Number(item.qty));
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for ${item.name || item.id}.`);
      }
      const barcode = String(item.barcode || "").trim().toLowerCase();
      const variation = products.flatMap((parent) => Array.isArray(parent.variations) ? parent.variations : [])
        .find((candidate) => candidate.id === item.id || (barcode && candidate.barcode.trim().toLowerCase() === barcode));
      if (variation) {
        requiredStock.set(variation.id, (requiredStock.get(variation.id) || 0) + quantity);
      } else if (!item.isCustomItem) {
        throw new Error(`Product ${item.name || item.id} is no longer present in inventory.`);
      }
    }
    for (const parent of products) {
      for (const variation of parent.variations || []) {
        const quantity = requiredStock.get(variation.id) || 0;
        if (quantity > variation.stock) {
          throw new Error(`Insufficient stock for ${variation.sku || variation.barcode}.`);
        }
      }
    }
    for (const parent of products) {
      for (const variation of parent.variations || []) {
        variation.stock -= requiredStock.get(variation.id) || 0;
      }
    }

    sales.push(sale);
    setLocalItem(SALES_KEY, sales);
    publishCatalog(products);
  });
  saleWriteQueue = write.catch(() => undefined);
  await write;
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

// 6. HARDWARE SERVICES
export async function getHardwareDevices(): Promise<POSHardwareDevice[]> {
  return getLocalItem<POSHardwareDevice[]>(HARDWARE_KEY, INITIAL_HARDWARE);
}

export async function addHardwareDevice(dev: POSHardwareDevice): Promise<void> {
  const devices = await getHardwareDevices();
  devices.push(dev);
  setLocalItem(HARDWARE_KEY, devices);
}

export async function updateHardwareDevice(dev: POSHardwareDevice): Promise<void> {
  const devices = await getHardwareDevices();
  const idx = devices.findIndex(item => item.id === dev.id);
  if (idx !== -1) {
    devices[idx] = dev;
    setLocalItem(HARDWARE_KEY, devices);
  }
}

export async function deleteHardwareDevice(id: string): Promise<void> {
  const devices = await getHardwareDevices();
  const filtered = devices.filter(item => item.id !== id);
  setLocalItem(HARDWARE_KEY, filtered);
}
