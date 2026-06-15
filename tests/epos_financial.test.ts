import { CartesianItem, SaleInvoice } from "../src/types.ts";

/**
 * SUIT PRO - Financial Controller Audit Unit Tests
 * Assures exact UK Standard 20% VAT calculations, change dues,
 * and exact net margin tracking before invoices map into database DQL.
 */

function calculateTransaction(
  cart: CartesianItem[],
  amountTendered: number,
  isVatExempt: boolean = false
) {
  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.qty, 0);
  const vat = isVatExempt ? 0 : subtotal * 0.20; // 20% Standard UK rate
  const total = subtotal + vat;
  const totalCost = cart.reduce((sum, item) => sum + item.costPrice * item.qty, 0);
  const netProfit = subtotal - totalCost; // Financial margin profit (Selling minus Cost)
  
  const shortfall = Math.max(0, total - amountTendered);
  const changeDue = Math.max(0, amountTendered - total);

  return { subtotal, vat, total, netProfit, shortfall, changeDue };
}

// Simple test executor logging outputs cleanly to standard output
export function runEposTests() {
  console.log("\n[SUIT PRO TESTS] Running Enterprise Financial Verification...");

  const testCart: CartesianItem[] = [
    {
      id: "p1",
      barcode: "88001",
      name: "Slim-Fit Midnight Navy Wool Suit",
      size: "40R",
      colour: "Midnight Navy",
      costPrice: 300.00,
      sellingPrice: 800.00,
      stock: 10,
      qty: 2
    },
    {
      id: "p5",
      barcode: "88005",
      name: "Egyptian Giza Cotton Dress Shirt",
      size: "15.5",
      colour: "Pristine White",
      costPrice: 50.00,
      sellingPrice: 100.00,
      stock: 20,
      qty: 1
    }
  ];

  // Total Selling: 2 * 800 + 1 * 100 = 1700
  // Total Cost: 2 * 300 + 1 * 50 = 650
  // Expected Net Margin Profit: 1700 - 650 = 1050
  // Expected VAT (20%): 1700 * 0.2 = 340
  // Expected Grand Total Due: 1700 + 340 = 2040

  const results = calculateTransaction(testCart, 2100.00);

  // Assert calculations mathematically
  try {
    if (results.subtotal !== 1700.00) throw new Error(`Subtotal mismatch! Expected 1700.00, got ${results.subtotal}`);
    if (results.vat !== 340.00) throw new Error(`VAT mismatch! Expected 340.00, got ${results.vat}`);
    if (results.total !== 2040.00) throw new Error(`Total mismatch! Expected 2040.00, got ${results.total}`);
    if (results.netProfit !== 1050.00) throw new Error(`Net profit mismatch! Expected 1050.00, got ${results.netProfit}`);
    if (results.changeDue !== 60.00) throw new Error(`Change due mismatch! Expected 60.00, got ${results.changeDue}`);
    if (results.shortfall !== 0) throw new Error(`Shortfall mismatch! Expected 0, got ${results.shortfall}`);

    console.log("✔ TEST PASS: UK Traditional VAT (20%) validated.");
    console.log("✔ TEST PASS: Net profit margins audited successfully.");
    console.log("✔ TEST PASS: Cash register shortfall calculation accurate.");
    console.log("[SUIT PRO TESTS] Financial Controller audits completed successfully (3/3). All green.\n");
    return true;
  } catch (err: any) {
    console.error("✖ TEST FAIL:", err.message);
    return false;
  }
}
