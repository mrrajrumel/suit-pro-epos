export interface Product {
  id: string;
  barcode: string;
  name: string;
  size: string;
  colour: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
}

export interface CartesianItem extends Product {
  qty: number;
}

export interface SaleInvoice {
  id: string;
  items: CartesianItem[];
  subtotal: number;
  vat: number;
  total: number;
  profit: number;
  paymentMethod: "Cash" | "Visa" | "Mastercard" | "AMEX" | "Apple Pay" | "Google Pay" | "Open Banking";
  amountTendered: number;
  changeDue: number;
  salesperson: string;
  timestamp: string;
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
  method: "Cash" | "Visa" | "Mastercard" | "AMEX" | "Apple Pay" | "Google Pay" | "Open Banking";
  amount: number;
  timestamp: string;
}

export interface SystemAuditLog {
  id: string;
  type: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
}
