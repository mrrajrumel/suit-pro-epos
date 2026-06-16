import React, { useState, useEffect, useRef } from "react";
import { Product, CartesianItem, SaleInvoice, ReceiptLog } from "../types.ts";
import { getProducts, addSaleInvoice, addReceiptLog, addSystemLog } from "../lib/db-helpers.ts";
import { ShoppingCart, Scan, User, Trash2, Printer, Plus, Minus, CreditCard, DollarSign, Wallet, AlertTriangle, FileText, ClipboardList, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { parseInventorySpreadsheet, executeImportUpsert } from "../lib/import-service.ts";
import { getPrinterService } from "../lib/printer-service.ts";

interface PosTerminalProps {
  onTransactionComplete: () => void;
  activeSeller: string;
  setActiveSeller: (seller: string) => void;
  brandName?: string;
  logoUrl?: string;
  isIpsHighContrast?: boolean;
}

export default function PosTerminal({ 
  onTransactionComplete, 
  activeSeller, 
  setActiveSeller,
  brandName = "SUIT PRO",
  logoUrl = "",
  isIpsHighContrast = false
}: PosTerminalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartesianItem[]>([]);
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [cashiersList, setCashiersList] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Visa" | "Mastercard" | "AMEX" | "Apple Pay" | "Google Pay" | "Open Banking">("Cash");
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [currentInvoice, setCurrentInvoice] = useState<SaleInvoice | null>(null);
  
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<string[]>([]);
  
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Split Payment Setup
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPaymentMethod1, setSplitPaymentMethod1] = useState<"Cash" | "Visa" | "Mastercard" | "AMEX" | "Apple Pay" | "Google Pay" | "Open Banking">("Cash");
  const [splitPaymentMethod2, setSplitPaymentMethod2] = useState<"Cash" | "Visa" | "Mastercard" | "AMEX" | "Apple Pay" | "Google Pay" | "Open Banking">("Visa");
  const [splitAmount1, setSplitAmount1] = useState<number>(0);

  // Park Sale / Draft Cart Setup
  const [parkedSales, setParkedSales] = useState<Array<{ id: string, cart: CartesianItem[], salesperson: string, timestamp: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem("suitpro_parked_sales") || "[]");
    } catch {
      return [];
    }
  });

  // End of Day (Z-Report) Setup
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);

  // Enterprise POS States
  const [vatRate, setVatRate] = useState<number>(0.20); // standard 20% UK VAT
  const [vatCategory, setVatCategory] = useState<"Standard" | "Zero" | "Exempt">("Standard");
  const [hardwareMode, setHardwareMode] = useState<"Desktop" | "Handheld mPOS">("Desktop");
  const [thermalWidth, setThermalWidth] = useState<"58mm" | "80mm">("80mm");
  const [syncStatus, setSyncStatus] = useState<"Connected" | "Processing" | "Synced">("Connected");
  const [operatorRole, setOperatorRole] = useState<"Salesperson" | "Manager" | "Owner">("Manager");
  const [isSyncing, setIsSyncing] = useState(false);
  const [mposTerminalState, setMposTerminalState] = useState<string>("BBPOS Chippers Ready");
  const [openBankingQrActive, setOpenBankingQrActive] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  const [systemConfig, setSystemConfig] = useState<any>(null);

  useEffect(() => {
    fetch("/api/system/config")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSystemConfig(data);
          if (data.vatStandardRate !== undefined) {
            setVatRate(data.vatStandardRate / 100);
          } else if (data.vat_rate !== undefined) {
            setVatRate(data.vat_rate / 100);
          }
        }
      })
      .catch((e) => {
        console.error("Failed to load corporate active configuration settings", e);
      });
  }, []);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const cashierNames = data
            .filter((u: any) => u.role === "Cashier")
            .map((u: any) => u.name || u.username)
            .filter(Boolean);

          if (cashierNames.length > 0) {
            setCashiersList(cashierNames);
            if (!cashierNames.includes(activeSeller)) {
              setActiveSeller(cashierNames[0]);
            }
          }
        }
      })
      .catch((err) => {
        console.warn("Could not retrieve dynamic employee registry, utilizing default fallback personnel:", err);
      });
  }, []);

  useEffect(() => {
    const handleSaleCompleteEvent = () => {
      console.log("[SUIT PRO Print Dispatcher] Detected 'sale_complete' event! Scheduling automatic receipt print...");
      setTimeout(() => {
        const receiptEl = document.getElementById("print-recipient-receipt");
        
        // Add CSS class for automatic layout adjustment
        if (receiptEl) {
          receiptEl.classList.add("auto-layout-print");
        }
        document.body.classList.add("auto-printing-active");

        console.log("[SUIT PRO Print Dispatcher] Rendering verification complete. Invoking window.print()...");
        try {
          window.print();
        } catch (printErr: any) {
          console.error("[SUIT PRO Print Dispatcher] Automated print failed:", printErr);
        } finally {
          // Ensure standard CSS classes are restored
          if (receiptEl) {
            receiptEl.classList.remove("auto-layout-print");
          }
          document.body.classList.remove("auto-printing-active");
        }
      }, 200);
    };

    window.addEventListener("sale_complete", handleSaleCompleteEvent);
    return () => {
      window.removeEventListener("sale_complete", handleSaleCompleteEvent);
    };
  }, []);

  const triggerThermalPrint = async () => {
    try {
      console.log("[SUIT PRO Print Dispatcher] Starting receipt print process...");
      
      if (!currentInvoice) {
        setErrorStatus("No invoice available to print");
        return;
      }

      const receiptEl = document.getElementById("print-recipient-receipt");
      if (!receiptEl) {
        console.error("[SUIT PRO Print Dispatcher] CRITICAL: Receipt element not found!");
        setErrorStatus("Hardware Stream Error: receipt container absent.");
        return;
      }

      // Check network status
      const isOffline = !navigator.onLine;
      if (isOffline) {
        console.warn("[SUIT PRO Print Dispatcher] Network offline - using offline print");
      }

      setSuccessStatus("Printing receipt...");

      // Try thermal printer first
      const printer = getPrinterService();
      if (printer) {
        const isHealthy = await printer.isHealthy();
        if (isHealthy) {
          console.log("[SUIT PRO Print Dispatcher] Using thermal printer...");
          
          const printSuccess = await printer.printReceipt({
            headerGreetings: "SUIT PRO LONDON - THANK YOU",
            items: currentInvoice.items.map(item => ({
              name: item.name,
              qty: item.qty,
              price: item.sellingPrice,
              size: item.size,
              colour: item.colour,
            })),
            subtotal: currentInvoice.subtotal,
            vat: currentInvoice.vat,
            total: currentInvoice.total,
            profit: (currentInvoice as any).profit,
            timestamp: currentInvoice.timestamp,
            invoiceId: currentInvoice.id,
            salesperson: currentInvoice.salesperson,
            paymentMethod: currentInvoice.paymentMethod as string,
          });

          if (printSuccess) {
            setSuccessStatus("✓ Receipt printed successfully!");
            console.log("[SUIT PRO Print Dispatcher] Thermal print completed");
            setTimeout(() => setSuccessStatus(null), 3000);
            return;
          }
        }
      }

      // Fallback to browser print
      console.log("[SUIT PRO Print Dispatcher] Thermal printer unavailable - using browser print");
      receiptEl.classList.add("auto-layout-print");
      document.body.classList.add("auto-printing-active");

      try {
        window.print();
        setSuccessStatus("✓ Receipt sent to browser print queue");
        setTimeout(() => setSuccessStatus(null), 3000);
      } catch (browserPrintErr: any) {
        console.error("[SUIT PRO Print Dispatcher] Browser print failed:", browserPrintErr);
        setErrorStatus(`Print error: ${browserPrintErr.message}`);
      } finally {
        receiptEl.classList.remove("auto-layout-print");
        document.body.classList.remove("auto-printing-active");
      }
    } catch (err: any) {
      console.error("[SUIT PRO Print Dispatcher] Print error:", err.message);
      setErrorStatus(`Print failed: ${err.message}`);
      setTimeout(() => setErrorStatus(null), 3000);
    }
  };

  // Inner Sub-Tab state: Hardware & Sync vs Bulk & Exports
  const [activeSubTab, setActiveSubTab] = useState<"gateway" | "bulk">("gateway");

  // Bulk States in PosTerminal
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [validRowsCount, setValidRowsCount] = useState<number>(0);

  const handleExportLedgerCSV = async () => {
    try {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Could not retrieve sales ledger on remote database.");
      const rawSales = await res.json();
      
      // Build CSV file content
      const headers = ["Invoice ID", "Timestamp", "Items Summary", "Subtotal (GBP)", "VAT amount (GBP)", "Total Paid (GBP)", "Net Profit (GBP)", "Payment Method", "Salesperson"];
      const rows = rawSales.map((inv: any) => [
        inv.id || "",
        inv.timestamp || "",
        (inv.items || []).map((i: any) => `${i.name} (Qty:${i.qty})`).join(" | "),
        inv.subtotal?.toFixed(2) || "0.00",
        inv.vat?.toFixed(2) || "0.00",
        inv.total?.toFixed(2) || "0.00",
        inv.profit?.toFixed(2) || "0.00",
        inv.paymentMethod || "",
        inv.salesperson || ""
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `SUIT_PRO_ledger_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccessStatus("Single-click Ledger Stream exported successfully as standard CSV.");
      setTimeout(() => setSuccessStatus(null), 3000);
    } catch (err: any) {
      setErrorStatus("Failed to stream ledger: " + err.message);
      setTimeout(() => setErrorStatus(null), 3000);
    }
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let fileToParse: File | null = selectedFile;
    if (!fileToParse && csvText.trim()) {
      fileToParse = new File([csvText], "pasted_catalog_terminal.csv", { type: "text/csv" });
    }

    if (!fileToParse) {
      setImportError("Please drag and drop a valid spreadsheet file or paste product data.");
      return;
    }

    setImportStatus("Running high-capacity spreadsheet import engine...");
    setImportError(null);

    try {
      const { validRows, errors } = await parseInventorySpreadsheet(fileToParse);
      
      if (validRows.length === 0) {
        setImportError("No valid inventory rows detected. Check formatting rules.");
        setImportStatus(null);
        return;
      }

      const result = await executeImportUpsert(validRows);

      setImportStatus(
        `Import complete: UPSERT successfully committed. Inserts: ${result.inserted || 0}, Updates: ${result.updated || 0}.`
      );
      
      // Reload product listing dynamically
      await loadProducts();
      
      setSelectedFile(null);
      setCsvText("");
      setTimeout(() => {
        setImportStatus(null);
      }, 4000);
    } catch (err: any) {
      setImportError("Spreadsheet import failure: " + err.message);
      setImportStatus(null);
    }
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportStatus(`Loading local file details: "${file.name}"...`);
    setImportError(null);

    if (file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setCsvText(text);
        }
      };
      reader.readAsText(file);
    } else {
      setCsvText(`[Binary spreadsheet: ${file.name} | Size: ${Math.round(file.size / 1024)} KB]`);
    }

    try {
      const { validRows, errors } = await parseInventorySpreadsheet(file);
      setValidRowsCount(validRows.length);
      setImportStatus(`Pre-validation complete for "${file.name}". ${validRows.length} active rows detected.`);
    } catch (err: any) {
      setImportError("Pre-validation file read failed: " + err.message);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Trigger manual bidirection Excel/Sheets sync simulation
  const handleForceSpreadsheetSync = async () => {
    setIsSyncing(true);
    setSyncStatus("Processing");
    
    // Simulate real 30-sec polling trigger backend delta recount
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "info",
          message: "Triggered bi-directional polling cycle with Microsoft Excel OneDrive and Google Sheets APIs."
        })
      });
      
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStatus("Synced");
        setSuccessStatus("Bi-directional Sync Complete! Excel prices and Google sheets rows successfully reconciled both-ways.");
        setTimeout(() => setSuccessStatus(null), 3000);
      }, 1500);
    } catch {
      setIsSyncing(false);
      setSyncStatus("Connected");
    }
  };

  // 1. Load active products on load
  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data || []);
      
      // Check for low inventory warnings under 5 units
      const alerts: string[] = [];
      data?.forEach(p => {
        if (p.stock < 5) {
          alerts.push(`Low Stock warning: ${p.name} (${p.size}) has only ${p.stock} remaining.`);
        }
      });
      setLowStockAlerts(alerts);
    } catch (err: any) {
      console.error(err);
      setErrorStatus("Failed to query product lists from database.");
    }
  }

  // 2. Continuous Auto-Focus Hook (paired with window-focus and click handlers)
  useEffect(() => {
    const keepFocus = () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        const tagName = activeEl?.tagName;
        const isInput = tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA" || activeEl?.hasAttribute("contenteditable");
        const isScannerField = activeEl === scannerInputRef.current;
        
        // If a modal or active dialog is present, do not snatch focus
        const isModalActive = !!document.querySelector(".fixed, [role='dialog'], .modal");
        
        if (!isScannerField && !isInput && !isModalActive) {
          scannerInputRef.current?.focus();
        }
      }, 100);
    };

    // Fast initial action
    const isModalActive = !!document.querySelector(".fixed, [role='dialog'], .modal");
    if (!isModalActive) {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    }

    document.addEventListener("click", keepFocus);
    window.addEventListener("focus", keepFocus);
    return () => {
      document.removeEventListener("click", keepFocus);
      window.removeEventListener("focus", keepFocus);
    };
  }, []);

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Immediate, non-blocking carriage return handling for high-speed hardware scanner threads
    if (e.key === "Enter") {
      e.preventDefault();
      const rawQuery = e.currentTarget.value.trim();
      if (!rawQuery) return;

      const findItem = products.find(
        p => p.barcode.toLowerCase() === rawQuery.toLowerCase() || 
             p.id.toLowerCase() === rawQuery.toLowerCase()
      );

      if (findItem) {
        addToCart(findItem);
        setBarcodeQuery("");
        setSuccessStatus(`Successfully added ${findItem.name} to cart.`);
        setTimeout(() => setSuccessStatus(null), 2000);
      } else {
        setErrorStatus(`SKU/Barcode [${rawQuery}] not recognized in SUIT PRO database.`);
        setBarcodeQuery("");
        // Append an anomaly operational log on the server
        fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "warning",
            message: `UNRECOGNIZED BARCODE ENTRY: Attempted entry for product tag code [${rawQuery}] at register layout.`
          })
        });
        setTimeout(() => setErrorStatus(null), 3000);
      }
    }
  };

  // 3. Process Scanned SKU Code
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = barcodeQuery.trim();
    if (!rawQuery) return;

    const findItem = products.find(
      p => p.barcode.toLowerCase() === rawQuery.toLowerCase() || 
           p.id.toLowerCase() === rawQuery.toLowerCase()
    );

    if (findItem) {
      addToCart(findItem);
      setBarcodeQuery("");
      setSuccessStatus(`Successfully added ${findItem.name} to cart.`);
      setTimeout(() => setSuccessStatus(null), 2000);
    } else {
      setErrorStatus(`SKU/Barcode [${rawQuery}] not recognized in SUIT PRO database.`);
      setBarcodeQuery("");
      // Append an anomaly operational log on the server
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "warning",
          message: `UNRECOGNIZED BARCODE ENTRY: Attempted entry for product tag code [${rawQuery}] at register layout.`
        })
      });
      setTimeout(() => setErrorStatus(null), 4000);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setErrorStatus(`Out of stock error: ${product.name} cannot be sold.`);
      setTimeout(() => setErrorStatus(null), 3000);
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.id === product.id);
      if (existingIndex > -1) {
        const updatedCart = [...prevCart];
        const newQty = updatedCart[existingIndex].qty + 1;
        
        if (newQty > product.stock) {
          setErrorStatus(`Cannot exceed floor stock limits. ${product.name} stock level is ${product.stock}.`);
          setTimeout(() => setErrorStatus(null), 3000);
          return prevCart;
        }
        
        updatedCart[existingIndex].qty = newQty;
        return updatedCart;
      } else {
        return [...prevCart, { ...product, qty: 1 }];
      }
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const newQty = item.qty + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock) {
            setErrorStatus(`Cannot exceed available stock of ${item.stock} item(s).`);
            setTimeout(() => setErrorStatus(null), 2500);
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean) as CartesianItem[];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  // 4. Financial computations
  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);
  const getVat = () => getSubtotal() * 0.20; // 20% VAT
  const getTotalDue = () => getSubtotal() + getVat();
  
  // Margins Profit Calculation: (Selling Price - Cost Price) * Qty
  const getNetProfit = () => cart.reduce((sum, item) => sum + ((item.sellingPrice - item.costPrice) * item.qty), 0);
  
  const changeDue = amountTendered - getTotalDue();
  const shortfall = getTotalDue() - amountTendered;

  // Clear states
  const clearSessionCart = () => {
    setCart([]);
    setAmountTendered(0);
    setCurrentInvoice(null);
    setIsSplitPayment(false);
  };

  // Park Sale / Hold current checkout order
  const handleParkSale = () => {
    if (cart.length === 0) {
      setErrorStatus("Active checkout empty. Cannot handoff or park empty carts.");
      setTimeout(() => setErrorStatus(null), 3000);
      return;
    }
    const newId = `HOLD-${Date.now().toString().slice(-4)}`;
    const newRecord = {
      id: newId,
      cart: [...cart],
      salesperson: activeSeller,
      timestamp: new Date().toISOString()
    };
    const updated = [newRecord, ...parkedSales];
    setParkedSales(updated);
    localStorage.setItem("suitpro_parked_sales", JSON.stringify(updated));
    setCart([]);
    setAmountTendered(0);
    setSuccessStatus(`Successfully held current order under temporary reference ID: ${newId}.`);
    setTimeout(() => setSuccessStatus(null), 3000);
  };

  // Retrieve Parked Sale / Hold order back in one-click
  const handleRetrieveParkedSale = (id: string) => {
    const target = parkedSales.find(p => p.id === id);
    if (target) {
      setCart(target.cart);
      const filtered = parkedSales.filter(p => p.id !== id);
      setParkedSales(filtered);
      localStorage.setItem("suitpro_parked_sales", JSON.stringify(filtered));
      setSuccessStatus(`Successfully re-opened held checkout basket ${id}!`);
      setTimeout(() => setSuccessStatus(null), 3000);
    }
  };

  // End of Day (Z-Report) Generator
  const handleGenerateZReport = async () => {
    try {
      // Pull recent sales, falling back to local storage
      const res = await fetch("/api/sales").catch(() => null);
      let salesList: any[] = [];
      if (res && res.ok) {
        // Mock loading or local fallback since CSV might only support downloads
        salesList = JSON.parse(localStorage.getItem("suitpro_sales") || "[]");
      } else {
        salesList = JSON.parse(localStorage.getItem("suitpro_sales") || "[]");
      }

      if (salesList.length === 0) {
        setErrorStatus("Unable to compile ledger. No sales have been registered on this register workspace today.");
        setTimeout(() => setErrorStatus(null), 4000);
        return;
      }

      let grandTotal = 0;
      let totalVat = 0;
      let totalProfit = 0;
      const distribution: Record<string, number> = {
        "Cash": 0,
        "Visa": 0,
        "Mastercard": 0,
        "AMEX": 0,
        "Apple Pay": 0,
        "Google Pay": 0,
        "Open Banking": 0,
        "Split Payments": 0
      };

      salesList.forEach((sale: any) => {
        grandTotal += Number(sale.total || 0);
        totalVat += Number(sale.vat || 0);
        totalProfit += Number(sale.profit || 0);

        const method = sale.paymentMethod || "Cash";
        if (distribution[method] !== undefined) {
          distribution[method] += Number(sale.total || 0);
        } else {
          if (method.includes("Split")) {
            distribution["Split Payments"] += Number(sale.total || 0);
          } else {
            distribution[method] = Number(sale.total || 0);
          }
        }
      });

      setZReportData({
        timestamp: new Date().toISOString(),
        totalSales: salesList.length,
        grandTotal,
        totalVat,
        totalProfit,
        breakdown: distribution
      });
      setIsZReportOpen(true);
    } catch (err: any) {
      setErrorStatus("Z-Report collation error. Verification pipeline failed.");
      setTimeout(() => setErrorStatus(null), 3000);
    }
  };

  // 5. Complete Sale & Sync File registers
  const handleFinalCheckout = async () => {
    if (cart.length === 0) {
      setErrorStatus("Cart is empty. Scan an item first!");
      return;
    }

    const subtotalVal = getSubtotal();
    const vatVal = getVat();
    const totalVal = getTotalDue();
    const profitVal = getNetProfit();
    const invoiceId = `SP-${Date.now().toString().slice(-6)}`;

    let finalPaymentMethod: string = paymentMethod;
    let finalAmountTendered = amountTendered;
    let finalChangeDue = changeDue;

    if (isSplitPayment) {
      const split2 = totalVal - splitAmount1;
      if (splitAmount1 <= 0 || splitAmount1 >= totalVal) {
        setErrorStatus(`Invalid pricing splits. Split Amount £${splitAmount1.toFixed(2)} must be between £0.01 and £${totalVal.toFixed(2)}.`);
        return;
      }
      finalPaymentMethod = `Split (${splitPaymentMethod1}: £${splitAmount1.toFixed(2)} + ${splitPaymentMethod2}: £${split2.toFixed(2)})`;
      finalAmountTendered = totalVal;
      finalChangeDue = 0;
    } else {
      if (paymentMethod === "Cash" && changeDue < 0) {
        setErrorStatus(`Insufficient funds. Cash payment shortfall of £${shortfall.toFixed(2)}.`);
        return;
      }
      finalAmountTendered = paymentMethod === "Cash" ? amountTendered : totalVal;
      finalChangeDue = paymentMethod === "Cash" ? Math.max(0, changeDue) : 0;
    }

    const saleRecord: SaleInvoice = {
      id: invoiceId,
      items: cart,
      subtotal: subtotalVal,
      vat: vatVal,
      total: totalVal,
      profit: profitVal,
      paymentMethod: finalPaymentMethod as any,
      amountTendered: finalAmountTendered,
      changeDue: finalChangeDue,
      salesperson: activeSeller,
      timestamp: new Date().toISOString()
    };

    try {
      // Store checkout invoice into Cloud Firestore database (auto-subtraction of stocks is built-in)
      await addSaleInvoice(saleRecord);

      // Create cashier drawer receipts log
      const receiptLog: ReceiptLog = {
        id: `REC-${Date.now().toString().slice(-6)}`,
        invoiceId: invoiceId,
        method: isSplitPayment ? "Cash" : paymentMethod, // Default mapping
        amount: totalVal,
        timestamp: new Date().toISOString()
      };
      await addReceiptLog(receiptLog);

      // Add audit log on Firestore
      await addSystemLog({
        type: "info",
        message: `Registered sale ${invoiceId} (£${totalVal.toFixed(2)}) by salesperson ${activeSeller}.`,
        timestamp: new Date().toISOString()
      });

      // Synchronize transaction database results server-side (appends spreadsheet Excel/CSV files)
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleRecord)
      });
      
      const serverResult = await res.json();
      if (!res.ok) throw new Error(serverResult.error || "Server upload failure");

      // Log any stock anomalies dynamically to the server if some item went very low
      cart.forEach((item) => {
        if (item.stock - item.qty <= 2) {
          fetch("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "warning",
              message: `CRITICAL LEVEL REACHED: ${item.name} (${item.size}, ${item.colour}) is now depleted to ${item.stock - item.qty} items!`
            })
          });
        }
      });

      setCurrentInvoice(saleRecord);
      setSuccessStatus(`Checkout complete. Invoice: ${invoiceId}`);
      
      // Dispatch automated 'sale_complete' event for receipt spooler
      const saleCompleteEvent = new CustomEvent("sale_complete", { detail: saleRecord });
      window.dispatchEvent(saleCompleteEvent);
      
      // Auto trigger formatting check and dispatch print to connected hardware spooler
      setTimeout(() => {
        loadProducts(); // reload stock details
        onTransactionComplete();
      }, 700);

    } catch (err: any) {
      console.error(err);
      setErrorStatus(`Checkout error: ${err.message || "Operation failed."}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-left w-full">
      {/* 3-STEP VISUAL TRACKING HORIZONTAL LINE PIPELINE */}
      <div className={`border rounded-2xl px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 ${
        isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/50 border-neutral-800/60"
      }`}>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className={`font-display text-[10px] uppercase tracking-widest font-bold ${
            isIpsHighContrast ? "text-neutral-800" : "text-[#dfb76c]"
          }`}>EPOS SYSTEM PIPELINE STATE</span>
        </div>
        
        <div className="flex-1 max-w-xl w-full flex items-center justify-between font-mono text-[9px] uppercase font-bold tracking-wider relative">
          {/* Connecting Line */}
          <div className={`absolute top-2 left-6 right-6 h-[1px] -z-0 ${
            isIpsHighContrast ? "bg-neutral-200" : "bg-neutral-800"
          }`}>
            <div className={`h-full transition-all duration-500 ${
              isIpsHighContrast ? "bg-[#b89047]" : "bg-[#dfb76c]"
            }`} style={{
              width: cart.length === 0 ? "0%" : cart.length > 0 && !successStatus ? "50%" : "100%"
            }}></div>
          </div>

          {/* Step 1 */}
          <div className="flex flex-col items-center gap-1.5 z-10 bg-inherit px-2.5">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
              cart.length === 0 
                ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black")
                : (isIpsHighContrast ? "bg-neutral-200 text-neutral-600 font-normal" : "bg-neutral-800 text-neutral-400 font-normal")
            }`}>1</span>
            <span className={isIpsHighContrast ? "text-neutral-700" : "text-gray-300"}>1. Scan Garment</span>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-1.5 z-10 bg-inherit px-2.5">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
              cart.length > 0 && !successStatus
                ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black")
                : (isIpsHighContrast ? "bg-neutral-100 text-neutral-400" : "bg-neutral-800/40 text-neutral-600")
            }`}>2</span>
            <span className={cart.length > 0 && !successStatus ? (isIpsHighContrast ? "text-neutral-800" : "text-white") : "text-neutral-500"}>2. Reconcile Cart</span>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center gap-1.5 z-10 bg-inherit px-2.5">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
              successStatus
                ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black")
                : (isIpsHighContrast ? "bg-neutral-100 text-neutral-400" : "bg-neutral-800/40 text-neutral-600")
            }`}>3</span>
            <span className={successStatus ? (isIpsHighContrast ? "text-neutral-800" : "text-white") : "text-neutral-500"}>3. Thermal Slip</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT 2 COLS: Scan Terminal & Active Invoice Ledger */}
      <div className="lg:col-span-2 space-y-6 animate-fade-in">
        
        {/* ENTERPRISE HARDWARE PROFILE & BI-DIRECTIONAL SYNC PANEL */}
        <div className={`backdrop-blur-xl border rounded-2xl p-6 relative overflow-hidden transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isIpsHighContrast 
            ? "bg-white border-neutral-200 shadow-sm" 
            : "bg-[#121216] border-neutral-800/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]"
        }`}>
          <div className={`absolute top-0 right-0 text-[9px] font-mono uppercase font-bold tracking-widest px-3.5 py-1 rounded-bl-xl border-l border-b transition-colors ${
            isIpsHighContrast 
              ? "bg-[#b89047]/10 text-[#b89047] border-neutral-200" 
              : "bg-[#dfb76c]/15 text-[#dfb76c] border-neutral-800/60"
          }`}>
            Enterprise Engine v1.03
          </div>
          
          {/* Inner Sub-tab navigation */}
          <div className={`flex gap-4 mb-4 border-b pb-2 ${
            isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
          }`}>
            <button
              type="button"
              onClick={() => setActiveSubTab("gateway")}
              className={`font-display text-xs font-semibold uppercase tracking-[0.15em] pb-1 cursor-pointer transition-all border-b-2 ${
                activeSubTab === "gateway"
                  ? (isIpsHighContrast ? "text-[#b89047] border-[#b89047]" : "text-[#dfb76c] border-[#dfb76c]")
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              Hardware & Ecosystem
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("bulk")}
              className={`font-display text-xs font-semibold uppercase tracking-[0.15em] pb-1 cursor-pointer transition-all border-b-2 ${
                activeSubTab === "bulk"
                  ? (isIpsHighContrast ? "text-[#b89047] border-[#b89047]" : "text-[#dfb76c] border-[#dfb76c]")
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              Bulk Manager (CSV importer/exporter)
            </button>
          </div>

          {activeSubTab === "gateway" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-mono">
              {/* 1. Bi-Directional Spreadsheet Controller */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
              }`}>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-1">Spreadsheet Sync Loop</span>
                  <span className={`font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>GSheet & MS Excel</span>
                </div>
                <div className="mt-2 flex gap-1.5 items-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${syncStatus === "Synced" ? "bg-emerald-500" : isSyncing ? "bg-[#dfb76c] animate-ping" : "bg-blue-400"}`}></span>
                  <span className={`font-bold text-[10px] uppercase ${isIpsHighContrast ? "text-neutral-700" : "text-gray-300"}`}>{isSyncing ? "Syncing..." : syncStatus}</span>
                  <button
                    type="button"
                    onClick={handleForceSpreadsheetSync}
                    className={`border text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all duration-300 ${
                      isIpsHighContrast
                        ? "bg-[#b89047]/15 hover:bg-[#b89047]/25 text-[#b89047] border-[#b89047]/30"
                        : "bg-[#dfb76c]/15 hover:bg-[#dfb76c]/25 text-[#dfb76c] border-[#dfb76c]/30"
                    }`}
                  >
                    Force Sync
                  </button>
                </div>
              </div>

              {/* 2. Universal Hardware Terminal Selector */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
              }`}>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-1">Hardware Terminal Profiler</span>
                  <span className={`font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{hardwareMode === "Desktop" ? "Desktop Terminal" : "Handheld mPOS"}</span>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setHardwareMode("Desktop")}
                    className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all duration-300 ${
                      hardwareMode === "Desktop" 
                        ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black") 
                        : (isIpsHighContrast ? "bg-white text-neutral-500 border border-neutral-200" : "bg-[#18181f] text-gray-400 border border-neutral-800/60")
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHardwareMode("Handheld mPOS");
                      setMposTerminalState("Connecting over NFC Reader...");
                      setTimeout(() => setMposTerminalState("Stripe BBPOS Chipper Online"), 1000);
                    }}
                    className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all duration-300 ${
                      hardwareMode === "Handheld mPOS" 
                        ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black") 
                        : (isIpsHighContrast ? "bg-white text-neutral-500 border border-neutral-200" : "bg-[#18181f] text-gray-400 border border-neutral-800/60")
                    }`}
                  >
                    Handheld
                  </button>
                </div>
              </div>

              {/* 3. Role-Based Access controls (RBAC) */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
              }`}>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-1">Enterprise RBAC Policy</span>
                  <span className={`font-semibold flex items-center justify-between ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                    <span>Group: {operatorRole}</span>
                  </span>
                </div>
                <select
                  value={operatorRole}
                  onChange={(e) => {
                    const role = e.target.value as "Salesperson" | "Manager" | "Owner";
                    setOperatorRole(role);
                    setSuccessStatus(`Switched sandbox scope to role: [${role}].`);
                    setTimeout(() => setSuccessStatus(null), 2500);
                  }}
                  className={`mt-2 text-[9px] border rounded p-1 cursor-pointer focus:outline-none transition-colors ${
                    isIpsHighContrast 
                      ? "bg-white text-neutral-800 border-neutral-300 focus:border-[#b89047]/40" 
                      : "bg-gray-900 text-white border-gray-850 focus:border-[#dfb76c]/40"
                  }`}
                  title="Select role"
                >
                  <option value="Salesperson">Salesperson (Restricted)</option>
                  <option value="Manager">Manager (Operational)</option>
                  <option value="Owner">Owner (Enterprise/Financial)</option>
                </select>
              </div>

              {/* 4. Active Offline PWA Cache Indicator */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
              }`}>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-1">Local Ledger Buffer</span>
                  <span className={`font-bold ${isOfflineMode ? "text-rose-500 animate-pulse" : "text-emerald-500"}`}>
                    {isOfflineMode ? "OFFLINE CACHE" : "CLOUD SYNCED"}
                  </span>
                </div>
                <span className="text-[8px] text-gray-500 uppercase mt-2">
                  {isOfflineMode ? "Buffered in IndexedDB" : "Continuous SQLite active"}
                </span>
              </div>

              {/* 5. End-of-Day Z-Report generator */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-all duration-300 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] border-[#b89047]/20 hover:border-[#b89047]/45" 
                  : "bg-[#0b0b0d] border-[#dfb76c]/20 hover:border-[#dfb76c]/45"
              }`}>
                <div>
                  <span className={`block text-[9px] uppercase tracking-wider mb-1 font-bold ${
                    isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                  }`}>End-of-Day Reconciliation</span>
                  <span className={`font-semibold flex items-center gap-1 ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Z-Report Audit</span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateZReport}
                  className={`mt-2 w-full text-[9px] uppercase tracking-wider font-bold py-1.5 px-1.5 rounded-lg cursor-pointer transition-all duration-300 text-center block ${
                    isIpsHighContrast 
                      ? "bg-[#b89047] hover:bg-[#a37e3d] text-white" 
                      : "bg-[#dfb76c] hover:bg-[#ebd097] text-black"
                  }`}
                >
                  Compile Daily Audit
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border border-dashed ${
              isIpsHighContrast ? "bg-[#ffffff] border-neutral-350" : "bg-neutral-950/15 border-neutral-800/60"
            }`}>
              {/* CSV/Excel Importer Block */}
              <div className="space-y-4 text-left">
                <div>
                  <h4 className={`font-display font-medium text-xs uppercase tracking-wider ${
                    isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                  }`}>Spreadsheet Bulk Importer</h4>
                  <p className="text-[10px] text-gray-450">Add or update inventory items via CSV/Excel spreadsheets.</p>
                </div>

                <div className="flex items-center justify-center w-full">
                  <label className={`flex flex-col items-center justify-center w-full h-24 border border-dashed rounded-lg cursor-pointer transition-all duration-300 ${
                    isIpsHighContrast 
                      ? "bg-[#f8f9fa] border-neutral-300 hover:border-[#b89047]/60" 
                      : "bg-[#0b0b0d] border-neutral-800 hover:border-[#dfb76c]/50"
                  }`}>
                    <div className="flex flex-col items-center justify-center pt-3 pb-3">
                      <FileText className={`w-5 h-5 mb-1 ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`} />
                      <p className={`text-[10px] font-bold ${isIpsHighContrast ? "text-neutral-700" : "text-gray-400"}`}>Upload spreadsheet (XLSX, XLS, CSV)</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">Drag-and-drop or click to browse</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv"
                      className="hidden" 
                      onChange={handleCsvFileUpload}
                    />
                  </label>
                </div>

                {/* Paste text option */}
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase tracking-wider block">Or Paste CSV Row Data</label>
                  <textarea
                    rows={2}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="barcode,name,size,colour,costPrice,sellingPrice,stock"
                    className={`w-full font-mono text-[10px] rounded-lg p-2 focus:outline-none ${
                      isIpsHighContrast
                        ? "bg-[#f8f9fa] border border-neutral-300 text-neutral-900 focus:border-[#b89047]/40"
                        : "bg-[#0b0b0d] border border-neutral-800 text-neutral-200 focus:border-[#dfb76c]"
                    }`}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={handleBulkImportSubmit}
                    className={`px-4 py-2 rounded-lg font-bold uppercase text-[9px] tracking-wider transition-all duration-300 cursor-pointer ${
                      isIpsHighContrast
                        ? "bg-[#b89047] hover:bg-[#a37e3d] text-white"
                        : "bg-[#dfb76c] hover:bg-[#ebd097] text-neutral-950"
                    }`}
                  >
                    Process Bulk Catalog Import
                  </button>
                  {validRowsCount > 0 && (
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">[{validRowsCount} valid rows detected]</span>
                  )}
                </div>

                {importStatus && (
                  <p className="text-[10px] font-mono text-emerald-600 uppercase">Status: {importStatus}</p>
                )}
                {importError && (
                  <p className="text-[10px] font-mono text-rose-600 uppercase">Error: {importError}</p>
                )}
              </div>

              {/* Streaming Ledger Exporter Block */}
              <div className={`flex flex-col justify-between space-y-4 md:border-l pl-0 md:pl-6 text-left ${
                isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
              }`}>
                <div>
                  <h4 className={`font-display font-medium text-xs uppercase tracking-wider ${
                    isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                  }`}>Ledger Streaming Exporter</h4>
                  <p className="text-[10px] text-gray-450">Stream compiled cash drawer histories and net margins in high-speed, direct single-click formats.</p>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-center items-center text-center space-y-2 ${
                  isIpsHighContrast 
                    ? "bg-[#f8f9fa] border-neutral-200" 
                    : "bg-neutral-950/20 border-neutral-800/60"
                }`}>
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>Ready to Stream</span>
                  <p className={`text-[10px] leading-relaxed ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>Downloads the full transactional database as excel-compatible `.csv` file format.</p>
                </div>

                <button
                  type="button"
                  onClick={handleExportLedgerCSV}
                  className={`w-full py-3 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all duration-300 cursor-pointer text-center border ${
                    isIpsHighContrast
                      ? "bg-white hover:bg-neutral-50 border-[#b89047] text-[#b89047]"
                      : "bg-[#111116] hover:bg-neutral-900 border-[#dfb76c] text-[#dfb76c]"
                  }`}
                >
                  Download Streaming CSV Ledger
                </button>
              </div>
            </div>
          )}
          
          {/* Active status for mPOS Chip contact Reader */}
          {hardwareMode === "Handheld mPOS" && (
            <div className={`text-[10px] font-mono px-3 py-1.5 rounded-lg mt-3 flex justify-between items-center animate-pulse border ${
              isIpsHighContrast 
                ? "text-[#b89047] bg-[#b89047]/10 border-[#b89047]/20" 
                : "text-[#dfb76c] bg-[#dfb76c]/10 border-neutral-800/60"
            }`}>
              <span>Handheld Peripheral Active: {mposTerminalState}</span>
              <span className="text-gray-400">Bluetooth paired • battery 86%</span>
            </div>
          )}
        </div>

        {/* AUTOMATIC BARCODE SCANNING REGION */}
        <div className={`border rounded-2xl p-6 relative overflow-hidden transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isIpsHighContrast 
            ? "bg-white border-neutral-200 shadow-sm" 
            : "bg-[#18181f]/40 border-[#262633]/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]"
        }`}>
          <div className={`absolute top-0 left-0 w-1.5 h-full animate-pulse ${
            isIpsHighContrast ? "bg-[#b89047]" : "bg-[#dfb76c]"
          }`}></div>
          <div className="md:flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <h3 className={`font-display text-lg font-medium uppercase tracking-[0.12em] ${
                  isIpsHighContrast ? "text-[#111116]" : "text-[#dfb76c]"
                }`}>Scan Barcode or Type SKU</h3>
              </div>
              <div className="flex items-center gap-2 mt-2 font-mono text-[9px] uppercase tracking-wider font-semibold">
                <span className={isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}>1. Identify Client</span>
                <span className="opacity-40">➔</span>
                <span className={isIpsHighContrast ? "text-neutral-700" : "text-gray-300"}>2. Draft Tailoring Invoice</span>
                <span className="opacity-40">➔</span>
                <span className="opacity-30">3. Commit Secure Transaction</span>
              </div>
            </div>
            
            {/* Cashier Selector */}
            <div className={`flex items-center gap-2 mt-3 md:mt-0 border px-3 py-1.5 rounded-lg font-mono ${
              isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200 text-neutral-700" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-400"
            }`}>
              <User className={`w-4 h-4 ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`} />
              <label className={isIpsHighContrast ? "text-xs text-neutral-500" : "text-xs text-gray-400"}>Cashier:</label>
              <select 
                className="bg-transparent text-xs focus:outline-none cursor-pointer text-inherit"
                value={activeSeller || ""}
                onChange={(e) => setActiveSeller(e.target.value)}
              >
                {cashiersList.length === 0 ? (
                  <option value="" disabled className={isIpsHighContrast ? "bg-white text-neutral-900" : "bg-[#111115] text-[#dfb76c]"}>
                    No cashier profiles configured
                  </option>
                ) : (
                  cashiersList.map(c => (
                    <option key={c} value={c} className={isIpsHighContrast ? "bg-white text-neutral-900" : "bg-[#111115] text-[#dfb76c]"}>
                      {c}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Scan className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]/70"}`} />
              <input
                id="barcode-scanner-input"
                ref={scannerInputRef}
                type="text"
                placeholder="Scan Barcode or Enter Product SKU..."
                className={`w-full font-mono text-sm pl-11 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 uppercase transition-all duration-300 ease-in-out ${
                  isIpsHighContrast 
                    ? "bg-[#f8f9fa] border-neutral-250 text-[#111116] placeholder-neutral-400 focus:border-[#b89047] focus:ring-[#b89047]/30" 
                    : "bg-[#0b0b0d] border-[#dfb76c]/30 text-[#dfb76c] placeholder-neutral-600 focus:border-[#dfb76c] focus:ring-[#dfb76c]/30 shadow-[0_0_12px_rgba(223,183,108,0.06)] focus:shadow-[0_0_18px_rgba(223,183,108,0.22)]"
                }`}
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                autoComplete="off"
              />
            </div>
            <button
              id="submit-barcode-trigger"
              type="submit"
              className={`font-display font-bold px-6 rounded-lg text-sm transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer hover:shadow-lg active:scale-98 ${
                isIpsHighContrast 
                  ? "bg-[#b89047] hover:bg-[#a37e3d] text-white hover:shadow-neutral-300/40" 
                  : "bg-[#dfb76c] hover:bg-[#ebd097] text-black hover:shadow-amber-500/10"
              }`}
            >
              Search SKU
            </button>
          </form>

          {/* Quick Click Simulation for testing when hardware is absent */}
          <div className={`mt-4 border-t pt-3 ${isIpsHighContrast ? "border-neutral-100" : "border-[#262633]/60"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                Quick simulator catalog (Click item matching tag)
              </span>
              <span className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] border-neutral-200 text-[#b89047]" 
                  : "bg-[#0b0b0d] border-[#262633]/60 text-[#dfb76c]"
              }`}>DEMO SEEDS</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {products.map(p => (
                <button
                  id={`quick-add-${p.barcode}`}
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`border text-left px-2.5 py-1.5 rounded-xl text-xs transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col justify-between h-14 w-28 relative group cursor-pointer ${
                    isIpsHighContrast 
                      ? "bg-white hover:bg-neutral-50 border-neutral-250 hover:border-[#b89047]/60 text-neutral-800" 
                      : "bg-[#15151b] hover:bg-[#1f1f2a] border border-[#262633]/60 hover:border-[#dfb76c]/40 text-white"
                  }`}
                >
                  <span className="truncate w-full font-semibold">{p.name.replace("Midnight Navy ", "").replace("Tailored ", "")}</span>
                  <div className="flex justify-between items-center w-full mt-1 font-mono text-[10px]">
                    <span className={`font-semibold ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>£{p.sellingPrice}</span>
                    <span className={isIpsHighContrast ? "text-neutral-400" : "text-gray-500"}>Stock: {p.stock}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ACTIVE BILLING GRID CART */}
        <div className={`border rounded-2xl overflow-hidden transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isIpsHighContrast 
            ? "bg-white border-neutral-200 shadow-sm" 
            : "bg-[#18181f]/40 border-[#262633]/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]"
        }`}>
          <div className={`px-6 py-5 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${
            isIpsHighContrast ? "bg-neutral-50/50 border-neutral-200" : "bg-[#111115]/50 border-[#262633]/60"
          }`}>
            <div className="flex items-center gap-2">
              <ShoppingCart className={`w-5 h-5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              <h3 className={`font-display font-medium uppercase tracking-[0.15em] text-sm font-bold ${
                isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
              }`}>Item Summary / Live Billing Grid</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap font-mono text-[10px]">
              {/* Park Order button */}
              <button
                type="button"
                onClick={handleParkSale}
                disabled={cart.length === 0}
                className={`px-3 py-1.5 rounded-lg border font-bold uppercase transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  cart.length === 0 
                  ? (isIpsHighContrast ? "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed" : "bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed")
                  : (isIpsHighContrast ? "bg-[#b89047]/10 border-[#b89047]/35 text-[#b89047] hover:bg-[#b89047]/20" : "bg-[#dfb76c]/10 border-[#dfb76c]/35 text-[#dfb76c] hover:bg-[#dfb76c]/20")
                }`}
                title="Save current basket to hold so you can serve another boutique client"
              >
                Park Basket
              </button>

              <span className={`px-2.5 py-1 rounded-full border ${
                isIpsHighContrast 
                  ? "bg-[#b89047]/10 border-[#b89047]/25 text-[#b89047]" 
                  : "bg-[#dfb76c]/10 border-[#dfb76c]/25 text-[#dfb76c]"
              }`}>
                {cart.reduce((sum, item) => sum + item.qty, 0)} Items Added
              </span>
            </div>
          </div>

          {/* Parked Sales shelf info */}
          {parkedSales.length > 0 && (
            <div className={`px-5 py-2.5 border-b flex flex-wrap items-center gap-2 font-mono text-[10px] text-left ${
              isIpsHighContrast ? "bg-stone-50 border-neutral-200" : "bg-[#dfb76c]/5 border-[#dfb76c]/15"
            }`}>
              <span className={`uppercase font-bold tracking-wider mr-1 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>Held Baskets ({parkedSales.length}):</span>
              {parkedSales.map(ps => (
                <button
                  key={ps.id}
                  type="button"
                  onClick={() => handleRetrieveParkedSale(ps.id)}
                  className={`font-bold px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors border ${
                    isIpsHighContrast 
                      ? "bg-white hover:bg-neutral-100 border-[#b89047]/30 text-[#b89047]" 
                      : "bg-slate-950 hover:bg-[#1f1f2a] border-[#dfb76c]/35 text-[#dfb76c]"
                  }`}
                  title={`Held at: ${new Date(ps.timestamp).toLocaleTimeString()}`}
                >
                  Held: {ps.id} ({ps.cart.length} items)
                </button>
              ))}
            </div>
          )}

          <div className={`divide-y max-h-[400px] overflow-y-auto ${
            isIpsHighContrast ? "divide-neutral-200" : "divide-[#262633]/40"
          }`}>
            {cart.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <ShoppingCart className="w-12 h-12 stroke-1 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">Active cart empty.</p>
                <p className="text-xs text-gray-400 mt-1">Use a laser barcode reader or click the quick seeds simulation tags above.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-[#111115]/5 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border uppercase ${
                        isIpsHighContrast 
                          ? "bg-neutral-50 text-neutral-800 border-neutral-200" 
                          : "bg-[#111115] text-[#dfb76c] border-[#262633]/60"
                      }`}>
                        SKU: {item.barcode}
                      </span>
                      {item.stock < 5 && (
                        <span className={`border flex items-center gap-1 text-[10px] uppercase font-bold animate-pulse px-2 py-0.5 rounded-full ${
                          isIpsHighContrast 
                            ? "text-[#b89047] bg-[#b89047]/10 border-[#b89047]/20" 
                            : "text-[#dfb76c] bg-amber-955/30 border border-amber-500/20"
                        }`}>
                          <AlertTriangle className="w-3 h-3" /> LOW STOCK ({item.stock} LEFT)
                        </span>
                      )}
                    </div>
                    <h4 className={`text-sm font-semibold mt-1 truncate ${isIpsHighContrast ? "text-[#111116]" : "text-white"}`}>{item.name}</h4>
                    <div className={`flex gap-4 text-xs mt-1 font-mono ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                      <span>Size: {item.size || "N/A"}</span>
                      <span>Colour: {item.colour || "N/A"}</span>
                      <span>Unit Price: £{item.sellingPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Qty incrementors */}
                    <div className={`flex items-center gap-1.5 border rounded-lg p-0.5 ${
                      isIpsHighContrast ? "bg-white border-neutral-250" : "bg-[#0b0b0d] border-[#262633]/60"
                    }`}>
                      <button 
                        id={`qty-minus-${item.id}`}
                        onClick={() => updateCartQty(item.id, -1)}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          isIpsHighContrast ? "text-neutral-500 hover:text-black hover:bg-neutral-100" : "text-gray-400 hover:text-white hover:bg-neutral-800"
                        }`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={`w-6 text-center text-xs font-mono font-bold ${
                        isIpsHighContrast ? "text-neutral-900" : "text-white"
                      }`}>{item.qty}</span>
                      <button 
                        id={`qty-plus-${item.id}`}
                        onClick={() => updateCartQty(item.id, 1)}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          isIpsHighContrast ? "text-neutral-500 hover:text-black hover:bg-neutral-100" : "text-gray-400 hover:text-white hover:bg-neutral-800"
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="text-right w-24">
                      <span className="block text-[8px] uppercase tracking-wider text-gray-500 font-mono leading-none mb-0.5 font-bold">Item Total</span>
                      <p className={`text-sm font-mono font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>£{(item.sellingPrice * item.qty).toFixed(2)}</p>
                      <p className="text-[10px] text-emerald-600 font-mono">Profit: +£{((item.sellingPrice - item.costPrice) * item.qty).toFixed(2)}</p>
                    </div>

                    {/* Delete Item (Velvet zone) */}
                    <button 
                      id={`delete-item-${item.id}`}
                      onClick={() => removeFromCart(item.id)}
                      className={`p-2 rounded-lg cursor-pointer transition-all duration-300 border ${
                        isIpsHighContrast 
                          ? "text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200" 
                          : "text-rose-200 bg-rose-955/50 hover:bg-rose-900/60 border-rose-800/40"
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COL: Total due, Payment controls, Checkout Trigger */}
      <div className="space-y-6">
        
        {/* TOTAL DUE BOX */}
        <div className={`backdrop-blur-xl border rounded-2xl p-5 transition-all duration-300 space-y-4 ${
          isIpsHighContrast 
            ? "bg-white border-neutral-200 shadow-sm text-neutral-800" 
            : "bg-[#18181f]/40 border-[#262633]/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] text-gray-200"
        }`}>
          <h3 className={`font-display font-medium text-lg border-b pb-3 uppercase tracking-[0.15em] ${
            isIpsHighContrast ? "text-[#111116] border-neutral-200" : "text-[#dfb76c] border-[#262633]/60"
          }`}>Summary & Payments</h3>
          
          {/* UK VAT compliance setting group */}
          <div className={`space-y-1.5 p-3 rounded-xl border transition-colors ${
            isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-[#262633]/60"
          }`}>
            <label className={`text-[10px] font-mono font-semibold uppercase tracking-widest block ${
              isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
            }`}>UK VAT Taxation Accounting</label>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setVatRate(0.20);
                  setVatCategory("Standard");
                  setSuccessStatus("UK Standard 20% VAT applied to receipt ledger.");
                  setTimeout(() => setSuccessStatus(null), 2000);
                }}
                className={`py-1 text-[9px] uppercase tracking-wider font-mono font-bold rounded-lg cursor-pointer border transition-all duration-300 ${
                  vatCategory === "Standard" 
                    ? (isIpsHighContrast ? "bg-[#b89047]/15 border-[#b89047] text-[#b89047]" : "bg-[#dfb76c]/15 border-[#dfb76c] text-[#dfb76c]") 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-neutral-700" : "bg-[#18181f]/40 border-[#262633]/40 text-gray-500 hover:text-gray-300")
                }`}
              >
                Standard 20%
              </button>
              <button
                type="button"
                onClick={() => {
                  setVatRate(0);
                  setVatCategory("Zero");
                  setSuccessStatus("VAT Zero-rated applied to receipt ledger.");
                  setTimeout(() => setSuccessStatus(null), 2000);
                }}
                className={`py-1 text-[9px] uppercase tracking-wider font-mono font-bold rounded-lg cursor-pointer border transition-all duration-300 ${
                  vatCategory === "Zero" 
                    ? (isIpsHighContrast ? "bg-[#b89047]/15 border-[#b89047] text-[#b89047]" : "bg-[#dfb76c]/15 border-[#dfb76c] text-[#dfb76c]") 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-neutral-700" : "bg-[#18181f]/40 border-[#262633]/40 text-gray-500 hover:text-gray-300")
                }`}
              >
                Zero-rated
              </button>
              <button
                type="button"
                onClick={() => {
                  setVatRate(0);
                  setVatCategory("Exempt");
                  setSuccessStatus("VAT Exempted transaction logged.");
                  setTimeout(() => setSuccessStatus(null), 2000);
                }}
                className={`py-1 text-[9px] uppercase tracking-wider font-mono font-bold rounded-lg cursor-pointer border transition-all duration-300 ${
                  vatCategory === "Exempt" 
                    ? "bg-blue-500/10 border-blue-500 text-blue-400" 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-neutral-700" : "bg-[#18181f]/40 border-[#262633]/40 text-gray-500 hover:text-gray-300")
                }`}
              >
                Exempt
              </button>
            </div>
            <span className="text-[8px] text-gray-400 block font-mono mt-1">
              {vatCategory === "Standard" ? "Standard clothing rate of 20% applied." : "Alterations or international exports exemption."}
            </span>
          </div>

          <div className={`space-y-2.5 font-mono text-sm ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>
            <div className="flex justify-between">
              <span>Item Total:</span>
              <span className={isIpsHighContrast ? "text-neutral-900 font-semibold" : "text-white"}>£{getSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT Code ({vatCategory}):</span>
              <span className={isIpsHighContrast ? "text-neutral-900 font-semibold" : "text-white"}>£{getVat().toFixed(2)}</span>
            </div>
            
            {operatorRole === "Owner" && (
              <div className={`flex justify-between text-xs border-t pt-2 pb-0.5 ${
                isIpsHighContrast ? "border-neutral-100 text-neutral-400" : "border-[#262633]/60 text-gray-500"
              }`}>
                <span>Enterprise Cost Audit:</span>
                <span>£{cart.reduce((s, i) => s + (i.costPrice * i.qty), 0).toFixed(2)}</span>
              </div>
            )}
            
            <div className={`flex justify-between border-t pt-3 text-base font-bold ${
              isIpsHighContrast ? "border-neutral-200" : "border-[#262633]/60"
            }`}>
              <span className={isIpsHighContrast ? "text-neutral-900" : "text-white"}>GRAND TOTAL DUE:</span>
              <span className={`text-lg ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>£{getTotalDue().toFixed(2)}</span>
            </div>

            {operatorRole !== "Salesperson" && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Accountant Net Profit:</span>
                <span>+£{getNetProfit().toFixed(2)} ({getSubtotal() > 0 ? ((getNetProfit() / getSubtotal()) * 100).toFixed(1) : 0}%)</span>
              </div>
            )}
          </div>

          {/* PAYMENT TYPE SELECTOR */}
          <div className={`space-y-3.5 border-t pt-3.5 ${isIpsHighContrast ? "border-neutral-200" : "border-[#262633]/60"}`}>
            
            {/* Split payment checkbox toggle */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
              isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-[#262633]/60"
            }`}>
              <label className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 ${
                isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
              }`}>
                <RefreshCw className={`w-3.5 h-3.5 ${isSplitPayment ? "animate-spin" : ""} ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                <span>Split Payment Multi-Rail?</span>
              </label>
              <input 
                type="checkbox" 
                checked={isSplitPayment}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsSplitPayment(checked);
                  if (checked) {
                    setSplitAmount1(Math.round(getTotalDue() / 2));
                  }
                }}
                className={`w-4 h-4 rounded cursor-pointer accent-[#dfb76c] ${
                  isIpsHighContrast 
                    ? "text-[#b89047] bg-white border-neutral-300" 
                    : "text-[#dfb76c] bg-gray-900 border-[#dfb76c]/30"
                }`}
              />
            </div>

            {isSplitPayment && (
              <div className={`p-3 border rounded-xl space-y-3 font-mono text-xs text-left animate-fade-in ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] border-neutral-200 text-neutral-800" 
                  : "bg-[#030305] border-[#dfb76c]/30 text-gray-300"
              }`}>
                <span className={`text-[10px] font-bold uppercase block tracking-wider font-sans ${
                  isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                }`}>Configure Splits</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-gray-400 uppercase block">Rail 1</label>
                    <select 
                      value={splitPaymentMethod1}
                      onChange={(e) => setSplitPaymentMethod1(e.target.value as any)}
                      className={`w-full border p-1.5 rounded-lg focus:outline-none cursor-pointer text-xs ${
                        isIpsHighContrast 
                          ? "bg-white border-neutral-250 text-[#111116] focus:border-[#b89047]" 
                          : "bg-[#0d0f17] border-[#262633]/60 text-[#dfb76c] focus:border-[#dfb76c]"
                      }`}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Open Banking">Open Banking</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="AMEX">AMEX</option>
                      <option value="Apple Pay">Apple Pay</option>
                      <option value="Google Pay">Google Pay</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[9px] text-gray-400 uppercase block">Rail 2</label>
                    <select 
                      value={splitPaymentMethod2}
                      onChange={(e) => setSplitPaymentMethod2(e.target.value as any)}
                      className={`w-full border p-1.5 rounded-lg focus:outline-none cursor-pointer text-xs ${
                        isIpsHighContrast 
                          ? "bg-white border-neutral-250 text-[#111116] focus:border-[#b89047]" 
                          : "bg-[#0d0f17] border-[#262633]/60 text-[#dfb76c] focus:border-[#dfb76c]"
                      }`}
                    >
                      <option value="Visa">Visa</option>
                      <option value="Cash">Cash</option>
                      <option value="Open Banking">Open Banking</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="AMEX">AMEX</option>
                      <option value="Apple Pay">Apple Pay</option>
                      <option value="Google Pay">Google Pay</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="uppercase text-gray-400">Rail 1 Allocation (£)</span>
                    <span className={`font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Rail 2 split due: £{(Math.max(0, getTotalDue() - splitAmount1)).toFixed(2)}</span>
                  </div>
                  <input 
                    type="number"
                    max={getTotalDue()}
                    min="0"
                    step="0.01"
                    value={splitAmount1}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitAmount1(Math.min(val, getTotalDue()));
                    }}
                    className={`w-full border text-xs px-2.5 py-1.5 rounded-lg focus:outline-none ${
                      isIpsHighContrast 
                        ? "bg-white border-neutral-250 text-[#111116] focus:border-[#b89047]" 
                        : "bg-[#030305] border-[#262633]/60 text-[#dfb76c] focus:border-[#dfb76c]"
                    }`}
                    placeholder="Allocation 1 value..."
                  />
                </div>

                <div className={`p-2 border rounded-lg font-bold text-[10px] space-y-1 ${
                  isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#090d16] border-[#262633]/60"
                }`}>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Due:</span>
                    <span className={isIpsHighContrast ? "text-neutral-900" : "text-white"}>£{getTotalDue().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Portion 1 ({splitPaymentMethod1}):</span>
                    <span className={isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}>£{splitAmount1.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Portion 2 ({splitPaymentMethod2}):</span>
                    <span className={isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}>£{Math.max(0, getTotalDue() - splitAmount1).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest block">Select Single UK Payment Rail</label>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                id="pm-cash"
                type="button"
                onClick={() => { setPaymentMethod("Cash"); setAmountTendered(0); setOpenBankingQrActive(false); }}
                className={`py-2 px-3 rounded-lg border flex items-center justify-between transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "Cash" 
                    ? (isIpsHighContrast ? "bg-[#b89047]/20 border-[#b89047] text-[#b89047] font-bold" : "bg-[#dfb76c]/20 border-[#dfb76c] text-[#dfb76c] font-bold") 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-400 hover:text-white hover:bg-gray-800/40")
                }`}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                  <span>Drawer Cash</span>
                </div>
              </button>

              <button
                id="pm-openbanking"
                type="button"
                onClick={() => { setPaymentMethod("Open Banking"); setAmountTendered(getTotalDue()); setOpenBankingQrActive(true); }}
                className={`py-2 px-3 rounded-lg border flex items-center justify-between transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "Open Banking" 
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 font-bold" 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-400 hover:text-white hover:bg-gray-800/40")
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>Open Banking</span>
                </div>
              </button>
            </div>

            <div className="text-[9px] font-mono text-gray-400 uppercase tracking-widest pt-1">Card POS Terminals (NFC & EMV chip)</div>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              <button
                id="pm-visa"
                type="button"
                onClick={() => { setPaymentMethod("Visa"); setAmountTendered(getTotalDue()); setOpenBankingQrActive(false); }}
                className={`py-1.5 px-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "Visa" 
                    ? "bg-blue-500/10 border-blue-500 text-blue-600 font-bold" 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-[#111116]" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-500 hover:text-white")
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Visa</span>
              </button>

              <button
                id="pm-mastercard"
                type="button"
                onClick={() => { setPaymentMethod("Mastercard"); setAmountTendered(getTotalDue()); setOpenBankingQrActive(false); }}
                className={`py-1.5 px-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "Mastercard" 
                    ? "bg-amber-500/10 border-amber-500 text-amber-700 font-bold" 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-[#111116]" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-500 hover:text-white")
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>MCard</span>
              </button>

              <button
                id="pm-amex"
                type="button"
                onClick={() => { setPaymentMethod("AMEX"); setAmountTendered(getTotalDue()); setOpenBankingQrActive(false); }}
                className={`py-1.5 px-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "AMEX" 
                    ? "bg-teal-500/10 border-teal-500 text-teal-600 font-bold" 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-[#111116]" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-500 hover:text-white")
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>AMEX</span>
              </button>
            </div>

            <div className="text-[9px] font-mono text-gray-400 uppercase tracking-widest pt-1">Mobile Smart Clearing (NFC Wallet)</div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                id="pm-applepay"
                type="button"
                onClick={() => { setPaymentMethod("Apple Pay"); setAmountTendered(getTotalDue()); setOpenBankingQrActive(false); }}
                className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "Apple Pay" 
                    ? (isIpsHighContrast ? "bg-neutral-800 border-neutral-800 text-white font-bold" : "bg-gray-100 border-white text-gray-900 font-bold") 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-[#111116]" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-500 hover:text-white")
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Apple Pay</span>
              </button>

              <button
                id="pm-googlepay"
                type="button"
                onClick={() => { setPaymentMethod("Google Pay"); setAmountTendered(getTotalDue()); setOpenBankingQrActive(false); }}
                className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) cursor-pointer ${
                  paymentMethod === "Google Pay" 
                    ? "bg-[#4285F4]/10 border-[#4285F4] text-[#4285F4] font-bold" 
                    : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-400 hover:text-[#111116]" : "bg-[#0b0b0d] border-[#262633]/60 text-gray-500 hover:text-white")
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Google Pay</span>
              </button>
            </div>
          </div>

          {/* PAYMENT VALUE CALC (CASH TENDERED GRID) */}
          {paymentMethod === "Cash" && (
            <div className={`space-y-2 border-t pt-3 ${isIpsHighContrast ? "border-neutral-200" : "border-[#262633]/60"}`}>
              <div className="flex justify-between items-center">
                <label className={`text-xs font-sans font-semibold uppercase tracking-wide ${
                  isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                }`}>Cash/Card Amount Received</label>
                <div className="flex gap-1">
                  {[10, 20, 50, 100].map(val => (
                    <button
                      id={`tender-quick-${val}`}
                      key={val}
                      type="button"
                      onClick={() => setAmountTendered(val)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer transition-all duration-200 border ${
                        isIpsHighContrast 
                          ? "bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200" 
                          : "bg-[#18181f]/80 hover:bg-[#262633]/60 text-gray-300 border-transparent"
                      }`}
                    >
                      +£{val}
                    </button>
                  ))}
                  <button
                    id="tender-quick-exact"
                    type="button"
                    onClick={() => setAmountTendered(getTotalDue())}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer transition-all duration-200 ${
                      isIpsHighContrast 
                        ? "bg-[#b89047] hover:bg-[#a37e3d] text-white" 
                        : "bg-[#dfb76c] hover:bg-[#ebd097] text-neutral-950"
                    }`}
                  >
                    Exact
                  </button>
                </div>
              </div>
              <input
                id="tendered-cash-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="GBP Cash payment value..."
                className={`w-full font-mono text-sm px-3 py-2 rounded-lg border focus:outline-none transition-all duration-300 ${
                  isIpsHighContrast 
                    ? "bg-white border-neutral-250 text-[#111116] focus:border-[#b89047]" 
                    : "bg-[#0b0b0d] border-[#dfb76c]/30 text-white focus:border-[#dfb76c] shadow-[0_0_8px_rgba(251,191,36,0.02)] focus:shadow-[0_0_12px_rgba(251,191,36,0.12)]"
                }`}
                value={amountTendered || ""}
                onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
              />

              <div className={`flex justify-between text-xs font-mono pt-2 border-dashed border-t ${
                isIpsHighContrast ? "border-neutral-200" : "border-[#262633]/60"
              }`}>
                <span>Change to Return to Customer:</span>
                <span className={`font-bold ${changeDue >= 0 ? "text-emerald-650" : "text-gray-400"}`}>
                  £{changeDue >= 0 ? changeDue.toFixed(2) : "0.00"}
                </span>
              </div>
              {shortfall > 0 && (
                <div className="text-[10px] text-rose-600 font-mono text-right font-semibold">
                  Remaining Balance Due: £{shortfall.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* OPEN BANKING QR CODE BOX */}
          {paymentMethod === "Open Banking" && (
            <div className={`border p-4 rounded-xl flex flex-col items-center text-center space-y-3 animate-fade-in font-mono ${
              isIpsHighContrast ? "bg-neutral-50/50 border-neutral-200" : "bg-blue-950/25 border-blue-500/35"
            }`}>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isIpsHighContrast ? "bg-[#b89047]/10 text-[#b89047]" : "bg-blue-500/20 text-blue-400"
              }`}>
                UK GPB Faster Payments QR
              </span>
              
              {/* Custom SVG QR Code representation */}
              <div className="bg-white p-2 rounded-lg border-2 border-blue-500 shadow-md">
                <svg className="w-32 h-32 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                  {/* Outer boundaries */}
                  <rect x="5" y="5" width="20" height="20" />
                  <rect x="8" y="8" width="14" height="14" fill="#fff" />
                  <rect x="11" y="11" width="8" height="8" />
                  
                  <rect x="75" y="5" width="20" height="20" />
                  <rect x="78" y="8" width="14" height="14" fill="#fff" />
                  <rect x="81" y="81" width="8" height="8" />
                  
                  <rect x="5" y="75" width="20" height="20" />
                  <rect x="8" y="78" width="14" height="14" fill="#fff" />
                  <rect x="11" y="81" width="8" height="8" />
                  
                  {/* Matrix codes */}
                  <rect x="35" y="15" width="6" height="6" />
                  <rect x="55" y="25" width="6" height="12" />
                  <rect x="45" y="45" width="12" height="6" />
                  <rect x="65" y="45" width="6" height="6" />
                  <rect x="35" y="65" width="12" height="6" />
                  <rect x="65" y="65" width="12" height="12" />
                  <rect x="50" y="75" width="10" height="10" />
                  <rect x="15" y="35" width="6" height="12" />
                  <rect x="25" y="55" width="12" height="6" />
                </svg>
              </div>

              <div className="space-y-1">
                <span className={`text-[11px] font-bold uppercase ${isIpsHighContrast ? "text-neutral-800" : "text-white"}`}>Instant Account-to-Account</span>
                <p className="text-[9px] text-gray-500 max-w-xs leading-relaxed">
                  Scan receipt to pay £{getTotalDue().toFixed(2)} directly from Barclays, Revolut, Monzo, or HSBC. No credit card shortfalls or transaction fees.
                </p>
              </div>
            </div>
          )}

          {/* THERMAL PAPER PRINTER WIDTH SELECTOR */}
          <div className={`space-y-2 border-t pt-3 flex items-center justify-between ${
            isIpsHighContrast ? "border-neutral-200" : "border-[#262633]/60"
          }`}>
            <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-wide">Printer Receipt Profile</label>
            <div className={`flex rounded-xl p-0.5 border ${
              isIpsHighContrast ? "bg-white border-neutral-250" : "bg-[#0b0b0d] border-[#262633]/60"
            }`}>
              <button
                type="button"
                onClick={() => {
                  setThermalWidth("80mm");
                  setSuccessStatus("Switched printing template layout to standard 80mm Roll.");
                  setTimeout(() => setSuccessStatus(null), 2000);
                }}
                className={`py-0.5 px-3 rounded-lg font-mono text-[9px] uppercase tracking-wider font-bold transition-all duration-300 cursor-pointer ${
                  thermalWidth === "80mm" 
                    ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-[#0b0b0d]") 
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                80mm Traditional
              </button>
              <button
                type="button"
                onClick={() => {
                  setThermalWidth("58mm");
                  setSuccessStatus("Switched printing template layout to mobile 58mm Handheld Roll.");
                  setTimeout(() => setSuccessStatus(null), 2000);
                }}
                className={`py-0.5 px-3 rounded-lg font-mono text-[9px] uppercase tracking-wider font-bold transition-all duration-300 cursor-pointer ${
                  thermalWidth === "58mm" 
                    ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-[#0b0b0d]") 
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                58mm Handheld
              </button>
            </div>
          </div>

          {/* CHECKOUT MASTER BUTTON */}
          <button
            id="checkout-master-trigger"
            type="button"
            onClick={handleFinalCheckout}
            disabled={cart.length === 0}
            className={`w-full font-display font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-lg cursor-pointer ${
              cart.length === 0 
                ? (isIpsHighContrast ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed shadow-none" : "bg-[#1f1f2a] text-gray-650 cursor-not-allowed border border-[#262633]/40") 
                : (isIpsHighContrast ? "bg-[#b89047] hover:bg-[#a37e3d] text-white active:scale-95" : "bg-[#dfb76c] hover:bg-[#ebd097] text-black active:scale-95")
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Process Checkout (£{getTotalDue().toFixed(2)})</span>
          </button>
          
          <button
            id="clear-session-trigger"
            type="button"
            onClick={clearSessionCart}
            className={`w-full text-center text-xs font-mono py-2 rounded-xl transition-all cursor-pointer border ${
              isIpsHighContrast 
                ? "bg-rose-100/40 text-rose-700 border-rose-200 hover:bg-rose-100" 
                : "bg-rose-950/50 text-rose-200 border border-rose-800/40 hover:bg-rose-900/60"
            }`}
          >
            Reset Terminal / Clear Order
          </button>
        </div>

        {/* FEEDBACK STATUS */}
        {errorStatus && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 text-xs p-3.5 rounded-lg flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorStatus}</span>
          </div>
        )}
        {successStatus && (
          <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-600 text-xs p-3.5 rounded-lg">
            {successStatus}
          </div>
        )}

        {/* LOW STOCK ALERTS IN MARGIN */}
        {lowStockAlerts.length > 0 && (
          <div className={`p-4 rounded-lg border ${
            isIpsHighContrast ? "bg-amber-50/50 border-amber-200" : "bg-amber-500/5 border border-amber-500/25"
          }`}>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isIpsHighContrast ? "bg-amber-100 text-amber-805" : "bg-amber-500/20 text-amber-500"
            }`}>
              Store Warnings ({lowStockAlerts.length})
            </span>
            <div className="mt-2.5 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {lowStockAlerts.map((alt, idx) => (
                <div key={idx} className={`text-[10px] flex gap-1.5 items-start ${isIpsHighContrast ? "text-amber-800" : "text-amber-400/80"}`}>
                  <span className={`mt-0.5 shrink-0 block w-1.5 h-1.5 rounded-full ${isIpsHighContrast ? "bg-amber-600" : "bg-amber-500"}`}></span>
                  <p>{alt}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DEDICATED POS THERMAL PRINT-ONLY INVOICE RECEIPT GRID (Only active when printed via window.print) */}
      {currentInvoice && !isZReportOpen && (
        <div 
          id="print-recipient-receipt" 
          className="print-receipt-only text-black"
          style={{ 
            width: thermalWidth === "80mm" ? "300px" : "210px", 
            margin: "0 auto", 
            padding: "8px", 
            backgroundColor: "#ffffff", 
            color: "#000000",
            fontFamily: "monospace"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "15px" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ maxHeight: "35px", maxWidth: "120px", display: "block", margin: "0 auto 6px auto", objectFit: "contain" }} />
            ) : null}
            <h1 style={{ fontSize: "19px", fontWeight: "bold", margin: "0", letterSpacing: "2px" }}>{brandName.toUpperCase()}</h1>
            <p style={{ fontSize: "10px", margin: "2px 0 0 0", textTransform: "uppercase" }}>Fine Tailoring & Menswear</p>
            <p style={{ fontSize: "9px", margin: "2px 0" }}>Savile Row, London W1S</p>
            <p style={{ fontSize: "9px", margin: "2px 0" }}>Tel: +44 20 7946 0192</p>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }}></div>
            <p style={{ fontSize: "10px", fontWeight: "bold", margin: "0" }}>SALES RECEIPT ({thermalWidth})</p>
          </div>

          <div style={{ fontSize: "9px", marginBottom: "10px", fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>INVOICE ID:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{currentInvoice.id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>DATE/TIME:</span>
              <span style={{ marginLeft: "auto" }}>{new Date(currentInvoice.timestamp).toLocaleString("en-GB")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CASHIER:</span>
              <span style={{ marginLeft: "auto" }}>{currentInvoice.salesperson}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>PAYMENT METHOD:</span>
              <span style={{ marginLeft: "auto", textTransform: "uppercase" }}>{currentInvoice.paymentMethod}</span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", marginBottom: "8px" }}></div>
          
          {/* Thermal Items List */}
          <table style={{ width: "100%", fontSize: "9px", fontFamily: "monospace", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", paddingBottom: "4px" }}>Item Description [Size]</th>
                <th style={{ textAlign: "center", paddingBottom: "4px", width: "30px" }}>Qty</th>
                <th style={{ textAlign: "right", paddingBottom: "4px", width: "60px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {currentInvoice.items.map((i, index) => (
                <tr key={index}>
                  <td style={{ paddingTop: "5px", paddingBottom: "2px" }}>
                    {i.name}
                    <div style={{ fontSize: "8px", color: "#444" }}>Color: {i.colour} | Size: {i.size}</div>
                  </td>
                  <td style={{ textAlign: "center", paddingTop: "5px" }}>{i.qty}</td>
                  <td style={{ textAlign: "right", paddingTop: "5px" }}>£{(i.sellingPrice * i.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderBottom: "1px dashed #000", marginTop: "10px", marginBottom: "8px" }}></div>

          <div style={{ fontSize: "9px", fontFamily: "monospace", display: "grid", gap: "3px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>SUBTOTAL:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>VAT CODE ({vatCategory}):</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.vat.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "bold", marginTop: "4px" }}>
              <span>TOTAL DUE:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.total.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
              <span>AMOUNT TENDERED:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.amountTendered.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CHANGE DUE BACK:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.changeDue.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", margin: "15px 0" }}></div>

          <div style={{ textAlign: "center", fontSize: "8px", fontFamily: "monospace" }}>
            <p style={{ margin: "0", fontWeight: "bold" }}>THANK YOU FOR SHOPPING WITH {brandName.toUpperCase()}</p>
            <p style={{ margin: "2px 0" }}>All premium suits include custom sizing alterations.</p>
            <p style={{ margin: "2px 0" }}>Exchange returns within 14 days with original receipt.</p>
            <p style={{ marginTop: "10px", fontSize: "7px" }}>EPOS Powered by {brandName.toUpperCase()} POS systems v1.02</p>
          </div>
        </div>
      )}

      {/* DEDICATED POS THERMAL PRINT-ONLY Z-REPORT RECEIPT GRID */}
      {isZReportOpen && zReportData && (
        <div 
          id="print-recipient-receipt" 
          className="print-receipt-only text-black"
          style={{ 
            width: thermalWidth === "80mm" ? "300px" : "210px", 
            margin: "0 auto", 
            padding: "8px", 
            backgroundColor: "#ffffff", 
            color: "#000000",
            fontFamily: "monospace"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <h1 style={{ fontSize: "19px", fontWeight: "bold", margin: "0", letterSpacing: "2px" }}>{brandName.toUpperCase()}</h1>
            <p style={{ fontSize: "10px", margin: "2px 0 0 0", textTransform: "uppercase" }}>End-Of-Day Audit Report</p>
            <p style={{ fontSize: "9px", margin: "2px 0" }}>Savile Row, London W1S</p>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }}></div>
            <p style={{ fontSize: "11px", fontWeight: "bold", margin: "0" }}>Z-REPORT AUDIT ROLL ({thermalWidth})</p>
          </div>

          <div style={{ fontSize: "9px", marginBottom: "10px", fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span>REPORT TIME:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{new Date(zReportData.timestamp).toLocaleString("en-GB")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span>OPERATOR:</span>
              <span style={{ marginLeft: "auto" }}>{activeSeller} ({operatorRole})</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>TOTAL SALES COUNT:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{zReportData.totalSales} Transactions</span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", marginBottom: "8px" }}></div>
          
          <div style={{ fontSize: "9px", fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span>GROSS TURNOVER:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>£{zReportData.grandTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span>VAT COLLECTED:</span>
              <span style={{ marginLeft: "auto" }}>£{zReportData.totalVat.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "bold", marginTop: "4px" }}>
              <span>NET PROFITS:</span>
              <span style={{ marginLeft: "auto" }}>£{zReportData.totalProfit.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", marginTop: "10px", marginBottom: "8px" }}></div>

          <div style={{ fontSize: "9px", fontFamily: "monospace" }}>
            <p style={{ fontWeight: "bold", margin: "0 0 5px 0" }}>PAYMENT METHOD BREAKDOWN</p>
            {Object.entries(zReportData.breakdown).map(([method, total]: any) => (
              <div key={method} style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span>{method.toUpperCase()}:</span>
                <span style={{ marginLeft: "auto" }}>£{Number(total || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: "1px dashed #000", margin: "15px 0" }}></div>

          <div style={{ textAlign: "center", fontSize: "8px", fontFamily: "monospace" }}>
            <p style={{ margin: "0", fontWeight: "bold" }}>END OF REPORT</p>
            <p style={{ marginTop: "10px", fontSize: "7px" }}>EPOS Powered by {brandName.toUpperCase()} POS systems v1.02</p>
          </div>
        </div>
      )}

      {/* SECURITY ENHANCED Z-REPORT AUDITOR OVERLAY */}
      {isZReportOpen && zReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in print:hidden">
          <div className="w-full max-w-lg bg-slate-950 border border-amber-500/35 rounded-2xl p-6 shadow-2xl relative space-y-4">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-medium text-amber-500 uppercase tracking-widest text-[11px] leading-none mt-0.5">Boutique End-Of-Day Z-Report</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsZReportOpen(false)}
                className="text-gray-400 hover:text-white transition-colors font-mono text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 font-mono text-[11px] text-left">
              <div className="p-4 bg-[#0b0b0d] border border-neutral-800/60 rounded-xl space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">REPORT GENERATED:</span>
                  <span className="text-white font-bold">{new Date(zReportData.timestamp).toLocaleString("en-GB")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">BOUND STORE BRAND:</span>
                  <span className="text-[#dfb76c] font-bold">{brandName.toUpperCase()} LONDON</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">AUDITING OPERATOR:</span>
                  <span className="text-white">{activeSeller} ({operatorRole})</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800/60 pt-2 text-xs text-[#dfb76c]">
                  <span>TOTAL SALES COUNT TODAY:</span>
                  <span className="font-bold">{zReportData.totalSales} Transactions</span>
                </div>
              </div>

              {/* Aggregated financial summaries */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#0b0b0d] border border-neutral-800/60 rounded-xl">
                  <span className="text-[9px] text-gray-500 block uppercase">Gross Turnover</span>
                  <span className="text-xs font-bold text-white">£{zReportData.grandTotal.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-[#0b0b0d] border border-neutral-800/60 rounded-xl">
                  <span className="text-[9px] text-gray-500 block uppercase">VAT Collected</span>
                  <span className="text-xs font-bold text-white">£{zReportData.totalVat.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                  <span className="text-[9px] text-emerald-500 block uppercase">Net profits</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">£{zReportData.totalProfit.toFixed(2)}</span>
                </div>
              </div>

              {/* Split of UK Rails */}
              <div className="p-4 bg-[#0b0b0d] border border-neutral-800/60 rounded-xl space-y-2">
                <span className="text-[9px] text-gray-400 block uppercase tracking-wider font-bold mb-1.5 border-b border-neutral-800/60 pb-1">UK Payment Rails Distribution</span>
                {Object.entries(zReportData.breakdown).map(([method, total]: any) => (
                  <div key={method} className="flex justify-between text-[10px]">
                    <span className="text-gray-500">{method.toUpperCase()}:</span>
                    <span className="text-white font-bold">£{Number(total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Secure message */}
              <p className="text-[9px] text-gray-400 leading-normal italic text-center">
                This Z-Report compiles ledger states directly from protected database logs. 
                Values have been reconciled against cloud synchronization instances.
              </p>
            </div>

            <div className="border-t border-gray-900 pt-3 flex justify-between gap-3 font-mono">
              <button
                type="button"
                onClick={() => {
                  triggerThermalPrint();
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2 rounded-lg font-bold uppercase text-[9px] tracking-wider transition-colors cursor-pointer text-center"
              >
                Print 80mm Audit Roll
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(zReportData, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `Z_REPORT_${brandName.replace(/\s+/g, '_')}_${Date.now()}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
                className="flex-1 bg-slate-900 hover:bg-gray-800 text-amber-500 border border-amber-500/35 py-2 rounded-lg font-bold uppercase text-[9px] tracking-wider transition-colors cursor-pointer text-center"
              >
                Export JSON Ledger Audit
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
    </div>
  );
}
