export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface ProductVariation {
  id: string;
  sku: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  discountPrice: number;
  offerPrice: number;
  stock: number;
  image?: string;
  attributeValues: Record<string, string>;
  damageStock?: number;
  stockAdjustments?: number;
}

export interface ParentProduct {
  id: string;
  name: string;
  category: string;
  brand: string;
  supplier: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  discountPrice: number;
  offerPrice: number;
  stock?: number;
  taxRatePct?: number;
  minStockAlert: number;
  images: string[];
  shortDescription: string;
  fullDescription: string;
  specifications: string;
  features: string;
  warrantyInfo: string;
  returnPolicy: string;
  productNotes: string;
  attributes: ProductAttribute[];
  variations: ProductVariation[];
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  size: string;
  colour: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  parentProductId?: string;
  isVariation?: boolean;
}

export interface CartesianItem extends Product {
  qty: number;
  customDescription?: string;
  isCustomItem?: boolean;
  manualPriceOverride?: number;
  manualVatRate?: number;
  itemDiscountAmount?: number;
  itemDiscountType?: "fixed" | "percent";
}

export interface SplitPaymentRecord {
  method: string;
  amount: number;
}

export interface SaleInvoice {
  id: string;
  items: CartesianItem[];
  subtotal: number;
  vat: number;
  total: number;
  profit: number;
  paymentMethod: string; // E.g., "Cash", "Card", "Visa", "Mastercard", "AMEX", "Apple Pay", "Google Pay", "Split", etc.
  splits?: SplitPaymentRecord[];
  amountTendered: number;
  changeDue: number;
  salesperson: string;
  timestamp: string;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
    vip?: boolean;
  };
  discountType?: "none" | "fixed" | "percent";
  discountValue?: number;
  discountAmount?: number;
  serviceCharge?: number;
  cardMachineStatus?: string;
  cardMachineReference?: string;
  digitalReceiptSent?: boolean;
  digitalReceiptMethod?: "email" | "whatsapp" | "sms" | "none";
}

export interface Expense {
  id: string;
  category: "Rent" | "Salaries" | "Utilities" | "Marketing" | "Logistics" | "Others";
  amount: number;
  reference: string;
  date: string;
  timestamp?: string;
}

export interface ReceiptLog {
  id: string;
  invoiceId: string;
  method: string;
  amount: number;
  timestamp: string;
}

export interface SystemAuditLog {
  id: string;
  type: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
}

// Supplier Management structures
export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  vatNumber: string;
  paymentTerms: string;
  notes: string;
  outstandingBalance: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  date: string;
  reference: string;
  notes: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  date: string;
  status: "Draft" | "Sent" | "Received" | "Cancelled";
  items: Array<{
    sku: string;
    name: string;
    qty: number;
    costPrice: number;
  }>;
  totalAmount: number;
}

// Business Capital structures
export interface CapitalSource {
  id: string;
  name: string; // e.g. "Cash Capital", "NatWest Account", "Revolut Account", "Business Loan", "Investor Capital", "Petty Cash", etc.
  type: "Cash" | "Bank" | "Loan" | "Investor" | "Custom";
  balance: number;
  accountNumber?: string;
}

export interface CapitalTransaction {
  id: string;
  sourceId: string;
  targetSourceId?: string; // For transfers
  type: "add" | "withdraw" | "transfer";
  amount: number;
  reference: string;
  date: string;
  timestamp: string;
}

// Inventory Adjustment / History
export interface InventoryAdjustment {
  id: string;
  sku: string;
  type: "Stock Adjustment" | "Damage Stock" | "Stock Audit" | "Supplier Return" | "Stock Transfer";
  qty: number; // positive or negative
  reason: string;
  date: string;
  timestamp: string;
}

export interface POSHardwareDevice {
  id: string;
  name: string;
  type: "Printer" | "Card Terminal" | "Cash Drawer" | "Barcode Scanner";
  interfaceType: "USB" | "Serial" | "LAN" | "Bluetooth" | "Virtual";
  brandModel: string;
  connectionInfo: string;
  status: "Active" | "Inactive";
  isSimulated: boolean;
}
