import React, { useState, useEffect, useRef } from "react";
import { Product, ParentProduct, CartesianItem, SaleInvoice, ReceiptLog, POSHardwareDevice } from "../types.ts";
import { getProducts, addSaleInvoice, addReceiptLog, addSystemLog, getHardwareDevices } from "../lib/db-helpers.ts";
import { catalogUpdatedEvent, refreshCatalogFromServer } from "../lib/catalog-service.ts";
import { ShoppingCart, Scan, User, Trash2, Printer, Plus, Minus, CreditCard, DollarSign, Wallet, AlertTriangle, FileText, ClipboardList, ShieldAlert, Sparkles, RefreshCw, Download } from "lucide-react";
import { parseInventorySpreadsheet, executeImportUpsert } from "../lib/import-service.ts";
import { resolveSyncTargetPath } from "../lib/sync-path.ts";
import { calculateVatInclusiveBreakdown } from "../lib/pricing.ts";
import { requestPrintPreview } from "../lib/print-preview.ts";

interface PosTerminalProps {
  onTransactionComplete: () => void;
  activeSeller: string;
  setActiveSeller: (seller: string) => void;
  brandName?: string;
  logoUrl?: string;
  storagePath?: string;
  isIpsHighContrast?: boolean;
  currentUserRole?: string;
}

export default function PosTerminal({ 
  onTransactionComplete, 
  activeSeller, 
  setActiveSeller,
  brandName = "SUIT PRO",
  logoUrl = "",
  storagePath = "C:\\Users\\Administrator\\Documents\\SuitPro-Records\\",
  isIpsHighContrast = false,
  currentUserRole = "Cashier"
}: PosTerminalProps) {
  const [products, setProducts] = useState<ParentProduct[]>([]);
  const [activeOptionsProduct, setActiveOptionsProduct] = useState<ParentProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartesianItem[]>([]);
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [cashiersList, setCashiersList] = useState<string[]>(["Rumel Ahmed", "Sophie Sinclair", "Liam Vance"]);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [currentInvoice, setCurrentInvoice] = useState<SaleInvoice | null>(null);
  
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<string[]>([]);
  
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Split Payment Setup
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPaymentMethod1, setSplitPaymentMethod1] = useState<string>("Cash");
  const [splitPaymentMethod2, setSplitPaymentMethod2] = useState<string>("Visa");
  const [splitAmount1, setSplitAmount1] = useState<number>(0);

  // Advanced Cart & Checkout Customizations
  const [cartDiscountType, setCartDiscountType] = useState<"none" | "fixed" | "percent">("none");
  const [cartDiscountValue, setCartDiscountValue] = useState<number>(0);
  const [managerOverrideCode, setManagerOverrideCode] = useState("");
  const [isManagerOverrideApplied, setIsManagerOverrideApplied] = useState(false);
  const [managerOverrideChecking, setManagerOverrideChecking] = useState(false);
  const [managerOverrideAuthorized, setManagerOverrideAuthorized] = useState(false);
  const [serviceCharge, setServiceCharge] = useState<number>(0);

  // Custom Extra Product inputs
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [customItemVat, setCustomItemVat] = useState<number>(20); // default 20% VAT

  // Card Machine POS Integration
  const [isCardMachineProcessing, setIsCardMachineProcessing] = useState(false);
  const [cardMachineStatusText, setCardMachineStatusText] = useState("");
  const [cardMachineSuccess, setCardMachineSuccess] = useState<boolean | null>(null);

  // Lead Generation virtual receipts
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [digitalReceiptMethod, setDigitalReceiptMethod] = useState<"none" | "email" | "whatsapp">("none");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);

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
  const [excelSyncPath, setExcelSyncPath] = useState(() => {
    return localStorage.getItem("suitpro_excel_sync_path") || "C:\\SuitPro\\ExcelSync\\sales_sync.csv";
  });
  const [isEditingExcelPath, setIsEditingExcelPath] = useState(false);
  const [tempExcelPathInput, setTempExcelPathInput] = useState(() => {
    return localStorage.getItem("suitpro_excel_sync_path") || "C:\\SuitPro\\ExcelSync\\sales_sync.csv";
  });
  const [isSelectingSyncPath, setIsSelectingSyncPath] = useState(false);
  const [mposTerminalState, setMposTerminalState] = useState<string>("BBPOS Chippers Ready");
  const [openBankingQrActive, setOpenBankingQrActive] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [isAutoDrawerOpen, setIsAutoDrawerOpen] = useState(false);
  const [scannerBuffer, setScannerBuffer] = useState("");
  const scannerBufferRef = useRef("");
  const [dispatchStatus, setDispatchStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const clearScannerBuffer = () => {
    scannerBufferRef.current = "";
    setScannerBuffer("");
  };

  useEffect(() => {
    if (!scannerBufferRef.current) return;
    const timer = window.setTimeout(() => {
      clearScannerBuffer();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [scannerBuffer]);
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [isVipSaved, setIsVipSaved] = useState(false);
  const [savedLeads, setSavedLeads] = useState<any[]>([]);
  const [matchedLead, setMatchedLead] = useState<any | null>(null);

  const loadSavedLeads = () => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSavedLeads(data);
        }
      })
      .catch((err) => console.warn("Failed to load customer profiles:", err));
  };

  useEffect(() => {
    loadSavedLeads();
  }, []);

  // Auto-match pre-registered client on phone/email typing
  useEffect(() => {
    if (!savedLeads || savedLeads.length === 0) {
      setMatchedLead(null);
      return;
    }
    
    const trimmedPhone = (customerPhone || "").replace(/[^0-9]/g, "");
    const trimmedEmail = (customerEmail || "").trim().toLowerCase();
    
    if (!trimmedPhone && !trimmedEmail) {
      setMatchedLead(null);
      return;
    }

    const match = savedLeads.find(lead => {
      const leadPhone = (lead.phone || "").replace(/[^0-9]/g, "");
      const leadEmail = (lead.email || "").trim().toLowerCase();
      
      const phoneMatch = trimmedPhone && leadPhone && (leadPhone.endsWith(trimmedPhone) || trimmedPhone.endsWith(leadPhone));
      const emailMatch = trimmedEmail && leadEmail && leadEmail === trimmedEmail;
      
      return phoneMatch || emailMatch;
    });

    if (match) {
      setMatchedLead(match);
    } else {
      setMatchedLead(null);
    }
  }, [customerPhone, customerEmail, savedLeads]);

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

  // Listen for runtime config updates (from ManagementConsole or other tabs)
  useEffect(() => {
    const onConfigUpdated = (ev: Event) => {
      try {
        // CustomEvent carries detail with nextConfig
        const ce = ev as CustomEvent;
        const cfg = ce.detail;
        if (cfg && cfg.vatStandardRate !== undefined) {
          setVatRate(Number(cfg.vatStandardRate) / 100);
        }
      } catch (e) {
        // ignore
      }
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'suitpro_vat_rate') {
        const v = Number(ev.newValue || localStorage.getItem('suitpro_vat_rate') || 20);
        setVatRate((v || 20) / 100);
      }
    };

    window.addEventListener('suitpro_config_updated', onConfigUpdated as EventListener);
    window.addEventListener('storage', onStorage as EventListener);
    return () => {
      window.removeEventListener('suitpro_config_updated', onConfigUpdated as EventListener);
      window.removeEventListener('storage', onStorage as EventListener);
    };
  }, []);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((u: any) => u.name || u.username);
          setCashiersList(names);
        }
      })
      .catch((err) => {
        console.warn("Could not retrieve dynamic employee registry, utilizing default fallback personnel:", err);
      });
  }, []);

  useEffect(() => {
    const handleSaleCompleteEvent = () => {
      // sale_complete event received — automatic printing is disabled
      // to support preview-first checkout flow. Manual printing
      // is available from the receipt preview modal.
    };

    window.addEventListener("sale_complete", handleSaleCompleteEvent);
    return () => {
      window.removeEventListener("sale_complete", handleSaleCompleteEvent);
    };
  }, [digitalReceiptMethod]);

  const processBarcodeScan = (value: string) => {
    const rawQuery = value.trim();
    if (!rawQuery) return;

    const findItem = findVariationByBarcode(rawQuery);

    if (findItem) {
      addToCart(findItem);
      setBarcodeQuery("");
      setSuccessStatus(`Successfully added ${findItem.name} to cart.`);
      setTimeout(() => setSuccessStatus(null), 2000);
    } else {
      setErrorStatus(`SKU/Barcode [${rawQuery}] not recognized in SUIT PRO database.`);
      setBarcodeQuery("");
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "warning",
          message: `UNRECOGNIZED BARCODE ENTRY: Attempted entry for product tag code [${rawQuery}] at register layout.`
        })
      }).catch(() => {});
      setTimeout(() => setErrorStatus(null), 4000);
    }
  };

  useEffect(() => {
    const handleGlobalScannerKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.closest("input, textarea, [contenteditable='true']")));
      if (isEditable) {
        return;
      }

      if (event.key === "Enter") {
        const currentScan = scannerBufferRef.current.trim();
        if (!currentScan) return;
        event.preventDefault();
        processBarcodeScan(currentScan);
        scannerBufferRef.current = "";
        setScannerBuffer("");
        return;
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const nextChar = event.key;
        if (/^[A-Za-z0-9._/\-]$/.test(nextChar)) {
          scannerBufferRef.current = `${scannerBufferRef.current}${nextChar}`.slice(-48);
          setScannerBuffer(scannerBufferRef.current);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalScannerKeydown);
    return () => window.removeEventListener("keydown", handleGlobalScannerKeydown);
  }, [products]);

  const persistPendingSales = (pending: SaleInvoice[]) => {
    const key = "suitpro_pending_sales";
    const value = JSON.stringify(pending);
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("Offline queue write failed; trimming and archiving oldest entries.", error);
      try {
        const trimmed = pending.slice(-25);
        localStorage.setItem(key, JSON.stringify(trimmed));
        return true;
      } catch (trimError) {
        try {
          const archiveKey = "suitpro_pending_sales_archive";
          const existingArchive: SaleInvoice[] = JSON.parse(localStorage.getItem(archiveKey) || "[]");
          const nextArchive = [...existingArchive, ...pending].slice(-50);
          localStorage.setItem(archiveKey, JSON.stringify(nextArchive));
          localStorage.setItem(key, JSON.stringify([]));
          return false;
        } catch {
          return false;
        }
      }
    }
  };

  const triggerThermalPrint = async (target: "receipt" | "audit" = "receipt") => {
    if (target === "receipt" && currentInvoice) {
      openReceiptPreviewWindow(currentInvoice);
      return;
    }

    const targetId = target === "audit" ? "print-zreport-thermal-document" : "print-receipt-thermal-document";
    const targetEl = document.getElementById(targetId);

    console.log(`[SUIT PRO Print Dispatcher] Opening print preview flow for the ${target} thermal stream...`);
    if (!targetEl) {
      console.error(`[SUIT PRO Print Dispatcher] CRITICAL: ${targetId} thermal stream element was not found in active document body!`);
      setErrorStatus("Hardware Stream Error: receipt container absent.");
      return;
    }

    const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${target} print</title><style>
      body{margin:0;background:#fff;color:#000;font-family:monospace;font-size:11px;line-height:1.25}
      .print-receipt-only{display:block;width:72mm;max-width:72mm;margin:0;padding:2mm;box-sizing:border-box;overflow:hidden;overflow-wrap:anywhere;word-break:break-word}
      table{width:100%;table-layout:fixed;border-collapse:collapse}td,th{word-break:break-word;white-space:normal}
    </style></head><body>${targetEl.outerHTML}</body></html>`;
    requestPrintPreview({
      title: target === "audit" ? "Audit Roll Preview" : "Receipt Preview",
      html: documentHtml,
      paperSize: thermalWidth
    });
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
        .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `SUIT_PRO_ledger_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessStatus(`Ledger export completed. Download saved to your default browser downloads folder.`);
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

  const handleSelectSyncPath = async () => {
    if (typeof window === "undefined") return;

    const isElectron = Boolean((window as Window & { electronAPI?: { selectLocalPath?: () => Promise<string | null> } }).electronAPI?.selectLocalPath);

    if (!isElectron) {
      setIsEditingExcelPath(true);
      setIsSelectingSyncPath(false);
      return;
    }

    setIsSelectingSyncPath(true);
    try {
      const chosenPath = await (window as Window & { electronAPI?: { selectLocalPath?: () => Promise<string | null> } }).electronAPI?.selectLocalPath?.();
      if (chosenPath) {
        const resolvedPath = resolveSyncTargetPath(chosenPath);
        localStorage.setItem("suitpro_excel_sync_path", resolvedPath);
        setExcelSyncPath(resolvedPath);
        setTempExcelPathInput(resolvedPath);
        setSuccessStatus(`Spreadsheet sync path updated to ${resolvedPath}`);
        setTimeout(() => setSuccessStatus(null), 3000);
      }
    } catch (error) {
      console.error('Failed to select spreadsheet path:', error);
      setErrorStatus('Unable to open the local file chooser.');
      setTimeout(() => setErrorStatus(null), 3000);
    } finally {
      setIsSelectingSyncPath(false);
    }
  };

  // Trigger manual bidirection Excel sync simulation
  const handleForceSpreadsheetSync = async () => {
    setIsSyncing(true);
    setSyncStatus("Processing");
    
    // Simulate real polling trigger with manually configured local path
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "info",
          message: `Triggered bi-directional spreadsheet sync with local MS Excel file at path: ${excelSyncPath}.`
        })
      });
      
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStatus("Synced");
        setSuccessStatus(`MS Excel Sync Complete! Prices and ledger reconciled both-ways via local file path: ${excelSyncPath}.`);
        setTimeout(() => setSuccessStatus(null), 4000);
      }, 1500);
    } catch {
      setIsSyncing(false);
      setSyncStatus("Connected");
    }
  };

  // Automatic background flusher for offline sales queue (sync between local PC and cloud backup server)
  useEffect(() => {
    let syncInterval: any;

    const flushOfflineQueue = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const pendingStr = localStorage.getItem("suitpro_pending_sales");
        if (!pendingStr) return;
        let pending: SaleInvoice[] = [];
        try {
          pending = JSON.parse(pendingStr);
        } catch (parseErr) {
          console.warn("Invalid pending queue payload detected; resetting queue.", parseErr);
          localStorage.setItem("suitpro_pending_sales", JSON.stringify([]));
          return;
        }
        if (!Array.isArray(pending) || pending.length === 0) return;

        console.log(`[SUIT PRO Sync] Found ${pending.length} pending sale records in local queue. Attempting upload to remote database...`);
        setIsSyncing(true);
        setSyncStatus("Processing");

        const remaining: SaleInvoice[] = [];
        for (const sale of pending) {
          try {
            const res = await fetch("/api/sales", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sale)
            });
            if (res.ok) {
              console.log(`[SUIT PRO Sync] Successfully synchronized offline invoice ${sale.id} with central backup server.`);
            } else {
              remaining.push(sale);
            }
          } catch (err) {
            console.error(`[SUIT PRO Sync] Connection attempt failed for invoice ${sale.id}, keeping in queue:`, err);
            remaining.push(sale);
          }
        }

        persistPendingSales(remaining);
        
        if (remaining.length === 0) {
          setSyncStatus("Synced");
          setSuccessStatus("All local offline checkouts have been successfully synchronized with the central backup ledger!");
          setTimeout(() => setSuccessStatus(null), 4000);
        } else {
          setSyncStatus("Connected");
        }
      } catch (err) {
        console.error("Error in background synchronization process:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Run check on mount and when connection triggers online
    flushOfflineQueue();

    if (typeof window !== "undefined") {
      window.addEventListener("online", flushOfflineQueue);
    }
    
    // Periodically scan and sync offline sales every 15 seconds
    syncInterval = setInterval(flushOfflineQueue, 15000);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", flushOfflineQueue);
      }
      clearInterval(syncInterval);
    };
  }, []);

  const queueOfflineSale = (sale: SaleInvoice) => {
    try {
      const key = "suitpro_pending_sales";
      const pending: SaleInvoice[] = JSON.parse(localStorage.getItem(key) || "[]");
      pending.push(sale);

      const serialized = JSON.stringify(pending);
      if (serialized.length > 4_500_000) {
        const trimmed = pending.slice(Math.max(0, pending.length - 25));
        persistPendingSales(trimmed);
        console.warn("[SUIT PRO] Offline queue exceeded storage budget. Trimmed oldest queued sales to keep the local cache operational.");
      } else {
        persistPendingSales(pending);
      }

      setSuccessStatus("Offline Mode Active: Sale has been saved locally and queued for remote backup synchronization.");
      setTimeout(() => setSuccessStatus(null), 4000);
    } catch (err) {
      console.error("Could not append offline sale to local queue storage:", err);
      try {
        const fallback: SaleInvoice[] = [];
        localStorage.setItem("suitpro_pending_sales", JSON.stringify(fallback));
      } catch {
        console.warn("[SUIT PRO] Offline queue storage is full and fallback pruning failed.");
      }
    }
  };

  // 1. Load active products on load
  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const handleCatalogUpdated = (event: Event) => {
      const products = (event as CustomEvent<ParentProduct[]>).detail;
      if (Array.isArray(products)) {
        setProducts(products);
        setActiveOptionsProduct((current) => current ? products.find((product) => product.id === current.id) || null : null);
      }
    };
    const handleCatalogStorage = (event: StorageEvent) => {
      if (event.key === "suitpro_products") {
        loadProducts();
      }
    };
    window.addEventListener(catalogUpdatedEvent, handleCatalogUpdated);
    window.addEventListener("storage", handleCatalogStorage);
    return () => {
      window.removeEventListener(catalogUpdatedEvent, handleCatalogUpdated);
      window.removeEventListener("storage", handleCatalogStorage);
    };
  }, []);

  async function loadProducts() {
    try {
      const data = await refreshCatalogFromServer().catch(() => getProducts());
      setProducts(data || []);
      
      // Check for low inventory warnings under 5 units at variation level
      const alerts: string[] = [];
      data?.forEach(parent => {
        if (parent.variations) {
          parent.variations.forEach(v => {
            if (v.stock < 5) {
              const combo = Object.values(v.attributeValues || {}).join(" / ");
              alerts.push(`Low Stock: ${parent.name} (${combo || "Default"}) has only ${v.stock} units left.`);
            }
          });
        }
      });
      setLowStockAlerts(alerts);
    } catch (err: any) {
      console.error(err);
      setErrorStatus("Failed to query product lists from database.");
    }
  }

  // Find variation by barcode or SKU
  const findVariationByBarcode = (query: string) => {
    const rawQuery = query.trim().toLowerCase();
    type QrPayload = { productId?: string; variationId?: string; sku?: string; barcode?: string };
    let qrPayload: QrPayload | null = null;
    try {
      const parsed = JSON.parse(query) as unknown;
      if (parsed && typeof parsed === "object") qrPayload = parsed as QrPayload;
    } catch {
      // Scanner input is normally a plain barcode/SKU.
    }
    const lookupValues = new Set([rawQuery, qrPayload?.productId?.trim().toLowerCase(), qrPayload?.variationId?.trim().toLowerCase(), qrPayload?.sku?.trim().toLowerCase(), qrPayload?.barcode?.trim().toLowerCase()].filter(Boolean));
    for (const parent of products) {
      if (parent.variations && parent.variations.length > 0) {
        for (const v of parent.variations) {
          const variationText = Object.values(v.attributeValues || {}).join(" ").toLowerCase();
          if (lookupValues.has(v.barcode?.trim().toLowerCase()) || lookupValues.has(v.sku?.trim().toLowerCase()) || lookupValues.has(v.id?.trim().toLowerCase()) || lookupValues.has(parent.id.trim().toLowerCase()) || parent.name.trim().toLowerCase() === rawQuery || variationText.includes(rawQuery)) {
            return {
              id: v.id,
              barcode: v.barcode,
              name: `${parent.name}${v.attributeValues && Object.keys(v.attributeValues).length > 0 ? " - " + Object.values(v.attributeValues).join(" / ") : ""}`,
              size: v.attributeValues?.["Size"] || v.attributeValues?.["size"] || "N/A",
              colour: v.attributeValues?.["Color"] || v.attributeValues?.["color"] || "N/A",
              costPrice: Number(v.purchasePrice ?? parent.purchasePrice ?? 0),
              sellingPrice: Number(v.sellingPrice ?? parent.sellingPrice ?? 0),
              stock: Number(v.stock ?? 0),
              parentProductId: parent.id,
              isVariation: true
            };
          }
        }
      } else {
        if (parent.id.toLowerCase() === rawQuery) {
          return {
            id: `${parent.id}-default`,
            barcode: parent.id,
            name: parent.name,
            size: "N/A",
            colour: "N/A",
            costPrice: Number(parent.purchasePrice || 0),
            sellingPrice: Number(parent.sellingPrice || 0),
            stock: Number(parent.stock ?? 0),
            parentProductId: parent.id
          };
        }
      }
    }
    return null;
  };

  const visibleProducts = products.filter((parent) => {
    const query = barcodeQuery.trim().toLowerCase();
    if (!query) return true;
    const parentText = [parent.id, parent.name, parent.category, parent.sellingPrice, parent.purchasePrice].join(" ").toLowerCase();
    const variationText = (parent.variations || []).map((variation) => [
      variation.id,
      variation.sku,
      variation.barcode,
      ...Object.values(variation.attributeValues || {})
    ].join(" ")).join(" ").toLowerCase();
    return `${parentText} ${variationText}`.includes(query);
  });

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
    if (e.key === "Enter") {
      e.preventDefault();
      processBarcodeScan(e.currentTarget.value);
      e.currentTarget.value = "";
      setBarcodeQuery("");
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcodeScan(barcodeQuery);
  };

  const getParentTotalStock = (parent: ParentProduct) => {
    if (!parent.variations) return 0;
    return parent.variations.reduce((sum, v) => sum + (v.stock || 0), 0);
  };

  const handleProductClick = (parent: ParentProduct) => {
    if (parent.variations && parent.variations.length > 0) {
      setActiveOptionsProduct(parent);
      // Auto-select first values for convenience
      const initial: Record<string, string> = {};
      parent.attributes.forEach(attr => {
        if (attr.values.length > 0) {
          initial[attr.name] = attr.values[0];
        }
      });
      setSelectedOptions(initial);
    } else {
      // Treat as simple product with a default virtual variation
      const flatItem: Product = {
        id: `${parent.id}-default`,
        barcode: parent.id,
        name: parent.name,
        size: "N/A",
        colour: "N/A",
        costPrice: Number(parent.purchasePrice || 0),
        sellingPrice: Number(parent.sellingPrice || 0),
        stock: Number(parent.stock ?? 0)
      };
      addToCart(flatItem);
    }
  };

  const handleAddConfiguredVariation = () => {
    if (!activeOptionsProduct) return;
    
    // Find variation matching all selected options
    const match = activeOptionsProduct.variations.find(v => {
      return Object.entries(selectedOptions).every(([attrName, value]) => {
        return v.attributeValues?.[attrName] === value || v.attributeValues?.[attrName?.toLowerCase()] === value;
      });
    });
    
    if (match) {
      const flatItem: Product = {
        id: match.id,
        barcode: match.barcode,
        name: `${activeOptionsProduct.name} - ${Object.values(selectedOptions).join(" / ")}`,
        size: selectedOptions["Size"] || selectedOptions["size"] || "N/A",
        colour: selectedOptions["Color"] || selectedOptions["color"] || "N/A",
        costPrice: Number(match.purchasePrice ?? activeOptionsProduct.purchasePrice ?? 0),
        sellingPrice: Number(match.sellingPrice ?? activeOptionsProduct.sellingPrice ?? 0),
        stock: Number(match.stock ?? 0),
        parentProductId: activeOptionsProduct.id,
        isVariation: true
      };
      
      addToCart(flatItem);
      setActiveOptionsProduct(null);
      setSuccessStatus(`Successfully added ${flatItem.name} to cart.`);
      setTimeout(() => setSuccessStatus(null), 2000);
    } else {
      setErrorStatus("Selected options combination is out of stock or not configured.");
      setTimeout(() => setErrorStatus(null), 3000);
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

  const updateCartItemCustom = (productId: string, updates: Partial<CartesianItem>) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        return { ...item, ...updates };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  // 4. Financial computations
  const getItemSubtotal = (item: CartesianItem) => {
    let price = item.sellingPrice;
    if (item.manualPriceOverride !== undefined) {
      price = item.manualPriceOverride;
    }
    const rawTotal = price * item.qty;
    if (item.itemDiscountAmount) {
      if (item.itemDiscountType === "percent") {
        return rawTotal * (1 - item.itemDiscountAmount / 100);
      } else {
        return Math.max(0, rawTotal - (item.itemDiscountAmount * item.qty));
      }
    }
    return rawTotal;
  };

  const getSubtotal = () => cart.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  
  const getCartDiscountAmount = () => {
    const sub = getSubtotal();
    if (cartDiscountType === "percent") {
      return sub * (cartDiscountValue / 100);
    } else if (cartDiscountType === "fixed") {
      return Math.min(sub, cartDiscountValue);
    }
    return 0;
  };

  const getNetSubtotal = () => Math.max(0, getSubtotal() - getCartDiscountAmount());

  const getVat = () => {
    const rate = Number.isFinite(vatRate) ? vatRate : 0.2;
    if (rate <= 0) return 0;
    const breakdown = calculateVatInclusiveBreakdown(getNetSubtotal(), rate * 100);
    return breakdown.vat;
  };

  // Pricing remains inclusive: the displayed total is the gross value paid, with VAT embedded in the total.
  const getTotalDue = () => getNetSubtotal() + serviceCharge;

  // Profit calculation remains identical
  const getNetProfit = () => {
    const netSub = getNetSubtotal();
    const totalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.qty), 0);
    return Math.max(0, netSub - totalCost);
  };
  
  const changeDue = amountTendered - getTotalDue();
  const shortfall = getTotalDue() - amountTendered;

  // Clear states
  const clearSessionCart = () => {
    setCart([]);
    setAmountTendered(0);
    setCurrentInvoice(null);
    setIsSplitPayment(false);
    setCartDiscountType("none");
    setCartDiscountValue(0);
    setServiceCharge(0);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDigitalReceiptMethod("none");
    setIsManagerOverrideApplied(false);
    setManagerOverrideCode("");
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
        "Bank Transfer": 0,
        "Gift Card": 0,
        "Store Credit": 0,
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

  const handleDispatchDigitalReceipt = async (method: "email" | "whatsapp") => {
    setDispatchStatus("sending");
    setDispatchMessage(`Initializing secure high-priority ${method.toUpperCase()} dispatcher...`);
    
    // Save lead data server-side
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          vip: isVipSaved,
          notes: `Receipt automatically generated via ${method.toUpperCase()} for Invoice ${currentInvoice?.id}`
        })
      });
      loadSavedLeads();
    } catch (e) {
      console.warn("Could not save lead server-side", e);
    }

    const itemsListText = currentInvoice?.items
      ? currentInvoice.items.map(item => `• ${item.name} (${item.size || "Standard"}, ${item.colour || "Default"}) x${item.qty} - £${(item.sellingPrice * item.qty).toFixed(2)}`).join("\n")
      : cart.map(item => `• ${item.name} (${item.size || "Standard"}, ${item.colour || "Default"}) x${item.qty} - £${(item.sellingPrice * item.qty).toFixed(2)}`).join("\n");

    const receiptBody = `----------------------------------
★ ${brandName.toUpperCase()} SHOWROOM ★
Premium Bespoke Tailoring & Apparel
----------------------------------
Invoice ID: ${currentInvoice?.id || "INV-DRAFT"}
Date: ${new Date().toLocaleString()}
Salesperson: ${currentInvoice?.salesperson || activeSeller}
----------------------------------
Items Purchased:
${itemsListText}
----------------------------------
Subtotal: £${(currentInvoice?.subtotal || getSubtotal()).toFixed(2)}
Discount: £${(currentInvoice?.discountAmount || getCartDiscountAmount()).toFixed(2)}
TOTAL PAID: £${(currentInvoice?.total || (getSubtotal() - getCartDiscountAmount())).toFixed(2)}
(All prices are inclusive of applicable VAT)
----------------------------------
Thank you for choosing ${brandName}!
Bespoke fits & tailored excellence.
==================================`;

    if (method === "whatsapp") {
      setTimeout(() => {
        setDispatchMessage("Opening browser tab to dispatch receipt via WhatsApp Web / Desktop...");
      }, 400);
      setTimeout(() => {
        const cleanedPhone = (customerPhone || "").replace(/[^0-9]/g, "");
        // Use standard international api.whatsapp.com for broad browser and PC compatibility
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(receiptBody)}`;
        window.open(waUrl, "_blank");
        
        // Download a copy of receipt
        const blob = new Blob([receiptBody], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${currentInvoice?.id || "RECEIPT"}_whatsapp_receipt.txt`;
        link.click();

        setDispatchMessage(`Launched WhatsApp Web dispatcher successfully to ${customerPhone} and downloaded invoice copy.`);
        setDispatchStatus("success");
      }, 1200);
    } else if (method === "email") {
      setTimeout(() => {
        setDispatchMessage("Generating file download & launching Gmail Web composer...");
      }, 400);
      setTimeout(() => {
        const subject = `Invoice Receipt from ${brandName} - ${currentInvoice?.id || "INV-DRAFT"}`;
        
        // Trigger automatic receipt file download
        const blob = new Blob([receiptBody], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${currentInvoice?.id || "RECEIPT"}_invoice.txt`;
        link.click();

        // Launch Gmail Web Composer in a new tab
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customerEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(receiptBody)}`;
        window.open(gmailUrl, "_blank");

        // Offer native mail client fallback
        const mailtoUrl = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(receiptBody)}`;
        window.open(mailtoUrl, "_blank");

        setDispatchMessage(`Successfully opened Gmail composer and initiated automatic receipt invoice download!`);
        setDispatchStatus("success");
      }, 1200);
    }
  };

  const downloadHtmlReceipt = (filename: string, htmlContent: string) => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openReceiptPreviewWindow = (invoice: any) => {
    const safe = (v: any) => (v === undefined || v === null) ? "" : String(v);
    const invoiceId = safe(invoice?.id) || `INV-${Date.now()}`;
    const dateString = invoice?.timestamp ? new Date(invoice.timestamp).toLocaleString("en-GB") : new Date().toLocaleString("en-GB");
    const cust = {
      name: safe(customerName.trim() || invoice?.customer?.name || "Valued Client"),
      phone: safe(customerPhone.trim() || invoice?.customer?.phone || "N/A"),
      email: safe(customerEmail.trim() || invoice?.customer?.email || "N/A")
    };

    const itemsHtml = (invoice?.items && invoice.items.length > 0)
      ? invoice.items.map((it: any) => {
          const qty = Number(it.qty || 1);
          const unit = Number(it.sellingPrice || 0);
          return `<tr><td>${safe(it.name)}</td><td style="text-align:center;">${qty}</td><td style="text-align:right;">£${unit.toFixed(2)}</td><td style="text-align:right;">£${(unit * qty).toFixed(2)}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4" style="text-align:center; padding:10px; color:#000">(no items)</td></tr>`;

    const receiptHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${invoiceId}</title>
      <style>
        :root{color-scheme: light}
        html,body{margin:0;padding:0;background:#fff;color:#000;font-family:monospace}
        .card{width:72mm;max-width:72mm;margin:0;background:#fff;padding:2mm;border-radius:0;color:#000;overflow:hidden;overflow-wrap:anywhere;word-break:break-word}
        .preview-toolbar{width:100%;display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px solid #e5e7eb;background:#f8fafc}
        .preview-toolbar button{padding:6px 10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{padding:6px 4px;border-bottom:1px dashed #000}
        th{font-weight:700;text-align:left}
        .muted{color:#000}
        @page{size:72mm 210mm;margin:0}
      </style>
      </head><body><div class="card"><h2 style="margin:0 0 6px 0;font-size:14px;letter-spacing:1px">${brandName?.toUpperCase() || "SUIT PRO"}</h2>
      <p style="margin:0 0 8px 0;font-size:11px">Invoice: ${invoiceId} • ${dateString}</p>
      <div style="display:flex;gap:8px;margin-bottom:8px;font-size:11px"><div style="flex:1"><strong>Customer</strong><div>${cust.name}</div><div>${cust.phone}</div><div>${cust.email}</div></div>
      <div style="flex:1;text-align:right"><strong>Sales</strong><div>${safe(invoice?.salesperson || activeSeller)}</div><div>${safe(invoice?.paymentMethod)}</div></div></div>
      <table><thead><tr><th>Description</th><th style="text-align:center;width:40px">Qty</th><th style="text-align:right;width:70px">Unit</th><th style="text-align:right;width:70px">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div style="margin-top:8px;text-align:right;font-size:11px"><div>Subtotal: £${Number(invoice?.subtotal || 0).toFixed(2)}</div><div>Include VAT: ${Math.round((vatRate || 0.2) * 100)}%</div><div style="font-weight:700;margin-top:6px">Total Paid: £${Number(invoice?.total || 0).toFixed(2)}</div></div>
      <p style="text-align:center;margin-top:8px;font-size:10px">Thank you for shopping with ${brandName?.toUpperCase() || 'SUIT PRO'}</p></div></body></html>`;

    requestPrintPreview({ title: `Receipt ${invoiceId}`, html: receiptHtml, paperSize: thermalWidth });
    return true;
  };

  const printPremiumReceiptPDF = (invoice: any) => {
    openReceiptPreviewWindow(invoice);
  };

  const handleSaveVipLead = async () => {
    setIsVipSaved(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          vip: true,
          notes: "Explicit VIP lead capture request from checkout page"
        })
      });
      // Also save VIP list in localStorage
      const vips = JSON.parse(localStorage.getItem("suitpro_vip_leads") || "[]");
      vips.push({ name: customerName, phone: customerPhone, email: customerEmail, timestamp: new Date().toISOString() });
      localStorage.setItem("suitpro_vip_leads", JSON.stringify(vips));
    } catch (e) {
      console.warn("Could not save VIP lead", e);
    }
  };

  // 5. Complete Sale & Sync File registers
  const handleFinalCheckout = async () => {
    if (isCheckoutProcessing) return;
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

    // Integrated Card Machine Simulation Handshake
    const isCardMethod = (method: string) => ["Visa", "Mastercard", "AMEX", "Card", "Contactless", "Apple Pay", "Google Pay"].includes(method);
    let cardAuthRef = "";

    const runCardPaymentSimulation = async (amt: number): Promise<boolean> => {
      setIsCardMachineProcessing(true);
      setCardMachineSuccess(null);
      
      let activeTerminalName = "PAX A920 Pro Smart Android POS Terminal";
      let activeTerminalIp = "192.168.1.200 (Port 8080)";
      try {
        const devices = await getHardwareDevices();
        const activeCardTerm = devices.find(d => d.type === "Card Terminal" && d.status === "Active");
        if (activeCardTerm) {
          activeTerminalName = `${activeCardTerm.name} (${activeCardTerm.brandModel})`;
          activeTerminalIp = activeCardTerm.connectionInfo || "Virtual Connection";
        }
      } catch (err) {
        // fallback
      }

      setCardMachineStatusText(`[PAX PRO-LINK] INITIALIZING HANDSHAKE WITH ${activeTerminalName.toUpperCase()}...`);
      await new Promise(r => setTimeout(r, 700));

      setCardMachineStatusText(`[PAX PRO-LINK] CONNECTED AT IP ${activeTerminalIp}. CHANNEL SECURED.`);
      await new Promise(r => setTimeout(r, 600));
      
      setCardMachineStatusText(`[PAX PRO-LINK] SENDING PAYLOAD CHARGE OF £${amt.toFixed(2)}...`);
      await new Promise(r => setTimeout(r, 800));

      setCardMachineStatusText(`[PAX SCREEN] WAITING ON CUSTOMER CARD TAP / INSERT / SWIPE...`);
      await new Promise(r => setTimeout(r, 1100));

      setCardMachineStatusText(`[PAX SECURE ENGINE] VERIFYING CHIP SIGNATURES & PIN...`);
      await new Promise(r => setTimeout(r, 800));
      
      const authCode = `APV-${Math.floor(100000 + Math.random() * 900000)}`;
      setCardMachineStatusText(`✔ APPROVED! AUTH CODE: ${authCode} | TRANS ID: ${Math.floor(10000000 + Math.random() * 90000000)}`);
      setCardMachineSuccess(true);
      cardAuthRef = `${activeTerminalName.toUpperCase()} (${activeTerminalIp}) - APV AUTH ${authCode} SUCCESS`;
      await new Promise(r => setTimeout(r, 1000));
      setIsCardMachineProcessing(false);
      return true;
    };

    setIsCheckoutProcessing(true);
    try {
      if (isSplitPayment) {
        const split2 = totalVal - splitAmount1;
        if (isCardMethod(splitPaymentMethod1)) {
          const ok = await runCardPaymentSimulation(splitAmount1);
          if (!ok) return;
        }
        if (isCardMethod(splitPaymentMethod2)) {
          const ok = await runCardPaymentSimulation(split2);
          if (!ok) return;
        }
      } else if (isCardMethod(paymentMethod)) {
        const ok = await runCardPaymentSimulation(totalVal);
        if (!ok) return;
      }

      const saleRecord: SaleInvoice = {
        id: invoiceId,
        items: cart.map(item => ({
          ...item,
          manualPriceOverride: item.manualPriceOverride,
          itemDiscountAmount: item.itemDiscountAmount,
          itemDiscountType: item.itemDiscountType,
          customDescription: item.customDescription,
          isCustomItem: item.isCustomItem
        })),
        subtotal: subtotalVal,
        vat: vatVal,
        total: totalVal,
        profit: profitVal,
        paymentMethod: finalPaymentMethod,
        splits: isSplitPayment ? [
          { method: splitPaymentMethod1, amount: splitAmount1 },
          { method: splitPaymentMethod2, amount: totalVal - splitAmount1 }
        ] : undefined,
        amountTendered: finalAmountTendered,
        changeDue: finalChangeDue,
        salesperson: activeSeller,
        timestamp: new Date().toISOString(),
        discountType: cartDiscountType,
        discountValue: cartDiscountValue,
        discountAmount: getCartDiscountAmount(),
        serviceCharge: serviceCharge,
        customer: (customerName || customerPhone || customerEmail) ? {
          name: customerName.trim() || "Guest Client",
          phone: customerPhone.trim() || undefined,
          email: customerEmail.trim() || undefined
        } : undefined,
        cardMachineStatus: cardAuthRef || undefined,
        digitalReceiptMethod: digitalReceiptMethod !== "none" ? digitalReceiptMethod : undefined,
        digitalReceiptSent: digitalReceiptMethod !== "none" ? true : undefined
      };

      await addSaleInvoice(saleRecord);

      // The local sale is durable at this point. Open the internal preview now;
      // ledger sync and optional lead logging must not block the cashier UI.
      setCurrentInvoice(saleRecord);
      setSuccessStatus(`Checkout complete! Invoice ${invoiceId} registered successfully. Receipt preview is available.`);
      openReceiptPreviewWindow(saleRecord);

      // Local sale and preview are complete. Secondary logging, drawer control, and remote sync stay in the background.
      void (async () => {
        const trimmedName = customerName.trim();
        const trimmedPhone = customerPhone.trim();
        const trimmedEmail = customerEmail.trim();
        if (digitalReceiptMethod !== "none" && (trimmedName || trimmedPhone || trimmedEmail)) {
          await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
            name: trimmedName || trimmedPhone || trimmedEmail || "Guest Client", phone: trimmedPhone, email: trimmedEmail,
            vip: isVipSaved || Boolean(matchedLead?.vip), notes: `Registered auto-checkout | Order ${invoiceId} (£${totalVal.toFixed(2)}) via ${digitalReceiptMethod.toUpperCase()}`
          }) }).then(() => loadSavedLeads()).catch((error) => console.warn("Could not auto-register lead on checkout:", error));
        }

        await addReceiptLog({ id: `REC-${Date.now().toString().slice(-6)}`, invoiceId, method: isSplitPayment ? "Split" : paymentMethod, amount: totalVal, timestamp: new Date().toISOString() }).catch((error) => console.warn("Receipt log failed:", error));
        await addSystemLog({ type: "info", message: `Registered sale ${invoiceId} (£${totalVal.toFixed(2)}) by salesperson ${activeSeller}.`, timestamp: new Date().toISOString() }).catch((error) => console.warn("System log failed:", error));

        const devices = await getHardwareDevices().catch(() => []);
        if (devices.some((device) => device.type === "Cash Drawer" && device.status === "Active")) {
          setIsAutoDrawerOpen(true);
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime); gain.gain.setValueAtTime(0.08, audioContext.currentTime);
            oscillator.start(); oscillator.stop(audioContext.currentTime + 0.15);
            void oscillator.onended;
          } catch (error) { console.warn("AudioContext error:", error); }
          setTimeout(() => setIsAutoDrawerOpen(false), 5000);
        }
        try {
          await window.electronAPI?.openCashDrawer?.();
        } catch (error) {
          console.warn("Cash drawer command failed:", error);
        }

        try {
          const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saleRecord) });
          if (!response.ok) queueOfflineSale(saleRecord);
        } catch (error) { console.warn("Remote sale sync failed; queued locally:", error); queueOfflineSale(saleRecord); }

        await Promise.all(cart.filter((item) => !item.isCustomItem && item.stock - item.qty <= 2).map((item) => fetch("/api/logs", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "warning", message: `CRITICAL LEVEL REACHED: ${item.name} (${item.size}, ${item.colour}) is now depleted to ${item.stock - item.qty} items!` })
        }).catch(() => undefined)));
        await loadProducts();
        onTransactionComplete();
      })().catch((error) => console.warn("Background checkout tasks failed:", error));

    } catch (err: any) {
      console.error(err);
      setErrorStatus(`Checkout error: ${err.message || "Operation failed."}`);
    } finally {
      setIsCheckoutProcessing(false);
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
        <div className={`backdrop-blur-xl border rounded-2xl p-6 relative overflow-hidden transition-all duration-300 ease-in-out ${
          isIpsHighContrast 
            ? "bg-white border-neutral-200 shadow-sm" 
            : "bg-[#121216] border-neutral-800/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]"
        }`}>
          <div className={`absolute top-0 right-0 text-[9px] font-mono uppercase font-semibold tracking-widest px-3.5 py-1 rounded-bl-xl border-l border-b transition-colors ${
            isIpsHighContrast 
              ? "bg-[#b89047]/10 text-[#b89047] border-neutral-200" 
              : "bg-[#dfb76c]/15 text-[#dfb76c] border-neutral-800/60"
          }`}>
            Enterprise
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
              Sync
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
              Bulk
            </button>
          </div>

          {activeSubTab === "gateway" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              {/* 1. Microsoft Excel Sync */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-500">Excel Sync</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingExcelPath(!isEditingExcelPath)}
                      className={`text-[8px] font-bold uppercase cursor-pointer transition-opacity ${
                        isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                      }`}
                    >
                      {isEditingExcelPath ? "Close" : "Path"}
                    </button>
                  </div>
                  <span className={`block text-sm font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Sync Engine</span>
                  {!isEditingExcelPath && (
                    <p className="mt-2 text-[9px] text-gray-400 truncate" title={excelSyncPath}>
                      Path: {excelSyncPath || "Not configured"}
                    </p>
                  )}
                </div>

                {isEditingExcelPath && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className={`w-full px-2 py-1 text-[10px] rounded border focus:outline-none ${
                        isIpsHighContrast ? "bg-white text-neutral-800 border-neutral-300" : "bg-[#121216] text-white border-neutral-700"
                      }`}
                      value={tempExcelPathInput}
                      onChange={(e) => setTempExcelPathInput(e.target.value)}
                      placeholder="Local Excel file path"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectSyncPath}
                        className={`flex-1 px-2 py-1 text-[9px] font-bold uppercase rounded ${
                          isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black"
                        }`}
                        disabled={isSelectingSyncPath}
                      >
                        {isSelectingSyncPath ? "Browse..." : "Browse"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const clean = resolveSyncTargetPath(tempExcelPathInput);
                          if (clean) {
                            localStorage.setItem("suitpro_excel_sync_path", clean);
                            setExcelSyncPath(clean);
                            setIsEditingExcelPath(false);
                            setSuccessStatus(`Excel file sync path successfully locked to: ${clean}`);
                            setTimeout(() => setSuccessStatus(null), 3000);
                          }
                        }}
                        className={`flex-1 px-2 py-1 text-[9px] font-bold uppercase rounded ${
                          isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black"
                        }`}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className={`text-[9px] uppercase ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>{isSyncing ? "Syncing..." : syncStatus}</span>
                  <button
                    type="button"
                    onClick={handleForceSpreadsheetSync}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded ${
                      isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black"
                    }`}
                  >
                    Force Sync
                  </button>
                </div>
              </div>

              {/* 2. Z-Report Audit */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all duration-300 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] border-[#b89047]/20" 
                  : "bg-[#0b0b0d] border-[#dfb76c]/20"
              }`}>
                <div>
                  <span className={`block text-[9px] uppercase tracking-wider mb-1 font-bold ${
                    isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                  }`}>Z-Report Audit</span>
                  <span className={`block text-sm font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Reconciliation</span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateZReport}
                  className={`w-full px-2 py-1 text-[9px] font-bold uppercase rounded ${
                    isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black"
                  }`}
                >
                  Compile Audit
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
        </div>

        {/* AUTOMATIC BARCODE SCANNING REGION */}
        <div className={`border rounded-2xl p-6 relative overflow-hidden transition-all duration-300 ease-in-out ${
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
                className={`bg-transparent text-xs focus:outline-none text-inherit ${currentUserRole !== "Owner" ? "cursor-not-allowed opacity-85" : "cursor-pointer"}`}
                value={activeSeller}
                onChange={(e) => {
                  if (currentUserRole !== "Owner") {
                    setErrorStatus("ACCESS RESTRICTED: Changing active Cashier profile requires System Owner (Admin) clearance!");
                    setTimeout(() => setErrorStatus(null), 4000);
                    return;
                  }
                  setActiveSeller(e.target.value);
                }}
                disabled={currentUserRole !== "Owner"}
                title={currentUserRole !== "Owner" ? "Security Lock: Only System Owner can re-assign active register cashiers." : "Select active register cashier"}
              >
                {cashiersList.map(c => (
                  <option key={c} value={c} className={isIpsHighContrast ? "bg-white text-neutral-900" : "bg-[#111115] text-[#dfb76c]"}>
                    {c} {currentUserRole !== "Owner" && c === activeSeller ? "🔒 (Active)" : ""}
                  </option>
                ))}
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
              className={`font-display font-bold px-6 rounded-lg text-sm transition-all duration-300 ease-in-out cursor-pointer hover:shadow-lg active:scale-98 ${
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
              {visibleProducts.map(p => (
                <button
                  id={`quick-add-${p.id}`}
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className={`border text-left px-2.5 py-1.5 rounded-xl text-xs transition-all duration-300 ease-in-out flex flex-col justify-between h-14 w-28 relative group cursor-pointer ${
                    isIpsHighContrast 
                      ? "bg-white hover:bg-neutral-50 border-neutral-250 hover:border-[#b89047]/60 text-neutral-800" 
                      : "bg-[#15151b] hover:bg-[#1f1f2a] border border-[#262633]/60 hover:border-[#dfb76c]/40 text-white"
                  }`}
                >
                  <span className="truncate w-full font-semibold">{p.name.replace("Midnight Navy ", "").replace("Tailored ", "")}</span>
                  <div className="flex justify-between items-center w-full mt-1 font-mono text-[10px]">
                    <span className={`font-semibold ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>£{p.sellingPrice || p.variations?.[0]?.sellingPrice || 0}</span>
                    <span className={isIpsHighContrast ? "text-neutral-400" : "text-gray-500"}>Stock: {getParentTotalStock(p)}</span>
                  </div>
                </button>
              ))}
              {barcodeQuery.trim() && visibleProducts.length === 0 && (
                <p className="w-full py-3 text-center text-[10px] text-gray-500 font-mono">No matching catalog products.</p>
              )}
            </div>
          </div>
        </div>

        {/* ACTIVE BILLING GRID CART */}
          <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ease-in-out ${
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
                className={`px-3 py-1.5 rounded-lg border font-bold uppercase transition-all duration-300 ease-in-out cursor-pointer ${
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

          {/* Custom Extra Item Creator */}
          <div className={`p-4 border-b flex flex-col gap-2 ${isIpsHighContrast ? "bg-stone-50 border-neutral-200" : "bg-[#111115]/30 border-[#262633]/60"}`}>
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>
              + Add Custom Extra Item / Delivery / Service Charge
            </h4>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                placeholder="Description (e.g. Alteration, Priority Post)"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                className={`text-xs px-3 py-2 rounded-lg border w-full sm:w-2/3 ${
                  isIpsHighContrast ? "bg-white border-neutral-300 text-black placeholder-neutral-400" : "bg-neutral-900 border-neutral-700 text-white placeholder-gray-500"
                }`}
              />
              <input
                type="number"
                placeholder="Price £"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value)}
                className={`text-xs px-3 py-2 rounded-lg border w-full sm:w-1/4 ${
                  isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-neutral-900 border-neutral-700 text-white"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  if (!customItemName || !customItemPrice) {
                    setErrorStatus("Please specify both a Description and Price to append custom item.");
                    setTimeout(() => setErrorStatus(null), 3000);
                    return;
                  }
                  const priceVal = parseFloat(customItemPrice);
                  if (isNaN(priceVal) || priceVal <= 0) {
                    setErrorStatus("Please enter a valid positive numeric price.");
                    setTimeout(() => setErrorStatus(null), 3000);
                    return;
                  }
                  const customId = `CST-${Date.now().toString().slice(-4)}`;
                  const newItem: CartesianItem = {
                    id: customId,
                    barcode: `MANUAL-${Date.now().toString().slice(-3)}`,
                    name: customItemName,
                    sellingPrice: priceVal,
                    costPrice: 0, // 100% margin profit on customized service
                    stock: 99999,
                    size: "N/A",
                    colour: "Custom Service",
                    qty: 1,
                    isCustomItem: true
                  };
                  setCart(prev => [...prev, newItem]);
                  setCustomItemName("");
                  setCustomItemPrice("");
                  setSuccessStatus(`Successfully added custom item "${customItemName}" to billing grid.`);
                  setTimeout(() => setSuccessStatus(null), 2500);
                }}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-300 w-full sm:w-auto shrink-0 cursor-pointer ${
                  isIpsHighContrast ? "bg-[#b89047] text-white hover:bg-[#a37e3d]" : "bg-[#dfb76c] text-black hover:bg-[#ebd097]"
                }`}
              >
                + Add Charge
              </button>
            </div>
          </div>

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
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#111115]/5 transition-colors">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border uppercase ${
                        isIpsHighContrast 
                          ? "bg-neutral-50 text-neutral-800 border-neutral-200" 
                          : "bg-[#111115] text-[#dfb76c] border-[#262633]/60"
                      }`}>
                        SKU: {item.barcode}
                      </span>
                      {!item.isCustomItem && item.stock < 5 && (
                        <span className={`border flex items-center gap-1 text-[10px] uppercase font-bold animate-pulse px-2 py-0.5 rounded-full ${
                          isIpsHighContrast 
                            ? "text-[#b89047] bg-[#b89047]/10 border-[#b89047]/20" 
                            : "text-[#dfb76c] bg-amber-955/30 border border-amber-500/20"
                        }`}>
                          <AlertTriangle className="w-3 h-3" /> LOW STOCK ({item.stock} LEFT)
                        </span>
                      )}
                    </div>
                    
                    {/* Item Custom Description / Name Editor */}
                    <div className="mt-1">
                      <input
                        type="text"
                        value={item.customDescription !== undefined ? item.customDescription : item.name}
                        onChange={(e) => updateCartItemCustom(item.id, { customDescription: e.target.value })}
                        className={`text-sm font-semibold w-full bg-transparent border-b border-dashed border-neutral-500/30 focus:border-neutral-500 outline-none ${
                          isIpsHighContrast ? "text-[#111116]" : "text-white"
                        }`}
                        title="Click to edit item display description"
                      />
                    </div>

                    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] mt-1.5 font-mono ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                      <span>Size: {item.size || "N/A"}</span>
                      <span>Colour: {item.colour || "N/A"}</span>
                      <span className="flex items-center gap-1">
                        Unit Price: 
                        <input
                          type="number"
                          placeholder={item.sellingPrice.toFixed(2)}
                          value={item.manualPriceOverride !== undefined ? item.manualPriceOverride : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                            updateCartItemCustom(item.id, { manualPriceOverride: val });
                          }}
                          className={`w-14 px-1 rounded border text-[10px] text-center ${
                            isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-neutral-900 border-neutral-700 text-white"
                          }`}
                          title="Manual Price Entry Override"
                        />
                      </span>
                    </div>

                    {/* ITEM-WISE DISCOUNT MANAGER OVERRIDES */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500 font-mono">Row Discount:</span>
                      <select
                        value={item.itemDiscountType || "percent"}
                        onChange={(e) => updateCartItemCustom(item.id, { itemDiscountType: e.target.value as any })}
                        className={`text-[10px] p-0.5 rounded border ${
                          isIpsHighContrast ? "bg-white border-neutral-250 text-black" : "bg-neutral-900 border-neutral-700 text-white"
                        }`}
                      >
                        <option value="percent">% Discount</option>
                        <option value="fixed">Fixed (£)</option>
                      </select>
                      <input
                        type="number"
                        placeholder="0"
                        value={item.itemDiscountAmount || ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          updateCartItemCustom(item.id, { itemDiscountAmount: v });
                        }}
                        className={`text-[10px] w-12 px-1 py-0.5 rounded border text-center font-bold ${
                          isIpsHighContrast ? "bg-white border-neutral-250 text-black" : "bg-neutral-900 border-neutral-700 text-white"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 w-full md:w-auto">
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
                      <span className="block text-[8px] uppercase tracking-wider text-gray-500 font-mono leading-none mb-0.5 font-bold">Row Total</span>
                      <p className={`text-sm font-mono font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                        £{getItemSubtotal(item).toFixed(2)}
                      </p>
                      {item.itemDiscountAmount && (
                        <p className="text-[10px] text-rose-500 font-mono leading-none font-bold">
                          -{item.itemDiscountType === "percent" ? `${item.itemDiscountAmount}%` : `£${item.itemDiscountAmount}`}
                        </p>
                      )}
                      <p className="text-[10px] text-emerald-600 font-mono">
                        Profit: +£{((getItemSubtotal(item) / item.qty - item.costPrice) * item.qty).toFixed(2)}
                      </p>
                    </div>

                    {/* Delete Item */}
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
        
        {/* TOTAL DUE BOX WITH ADVANCED CHARGES & DISCOUNTS */}
        <div className={`backdrop-blur-xl border rounded-2xl p-5 transition-all duration-300 space-y-4 ${
          isIpsHighContrast 
            ? "bg-white border-neutral-200 shadow-sm text-neutral-800" 
            : "bg-[#18181f]/40 border-[#262633]/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] text-gray-200"
        }`}>
          <h3 className={`font-display font-medium text-lg border-b pb-3 uppercase tracking-[0.15em] ${
            isIpsHighContrast ? "text-[#111116] border-neutral-200" : "text-[#dfb76c] border-[#262633]/60"
          }`}>Summary & Payments</h3>

          {/* ADVANCED CART-WISE DISCOUNT MODULE & OVERRIDES */}
          <div className={`p-3.5 rounded-xl border space-y-3 ${
            isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-250" : "bg-[#0b0b0d] border-[#262633]/60"
          }`}>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
              isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
            }`}>Cart-Wise Advanced Discount</span>
            
            <div className="grid grid-cols-2 gap-2">
              <select
                value={cartDiscountType}
                onChange={(e) => setCartDiscountType(e.target.value as any)}
                className={`text-xs p-2 rounded-lg border cursor-pointer focus:outline-none ${
                  isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#15151b] border-neutral-700 text-white"
                }`}
              >
                <option value="none">No Discount</option>
                <option value="percent">% Percentage Off</option>
                <option value="fixed">Fixed £ Off</option>
              </select>
              
              <input
                type="number"
                disabled={cartDiscountType === "none"}
                placeholder="Discount amount"
                value={cartDiscountValue || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setCartDiscountValue(val);
                }}
                className={`text-xs px-2.5 py-2 rounded-lg border focus:outline-none ${
                  isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#15151b] border-neutral-700 text-white"
                } ${cartDiscountType === "none" ? "opacity-55 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Manager Override Checkbox & Code Gate */}
            <div className="border-t border-neutral-800/40 pt-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Manager Override?</label>
                <input
                  type="checkbox"
                  checked={isManagerOverrideApplied}
                  onChange={(e) => {
                    setIsManagerOverrideApplied(e.target.checked);
                    if (!e.target.checked) setManagerOverrideCode("");
                  }}
                  className="w-3.5 h-3.5 rounded accent-[#dfb76c]"
                />
              </div>
              {isManagerOverrideApplied && (
                <div className="animate-fade-in space-y-1.5">
                  <input
                    type="password"
                    placeholder="Enter 4-Digit Manager Pin"
                    value={managerOverrideCode}
                    onChange={(e) => setManagerOverrideCode(e.target.value)}
                    className={`text-xs w-full px-2.5 py-1.5 rounded border focus:outline-none ${
                      isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-neutral-900 border-neutral-700 text-white"
                    }`}
                  />
                  <div className="space-y-2">
                    {managerOverrideAuthorized ? (
                      <p className="text-[10px] text-emerald-500 font-bold font-mono">PIN Approved. Double discounts authorized!</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (managerOverrideCode.trim().length < 3) return;
                              setManagerOverrideChecking(true);
                              try {
                                const r = await fetch('/api/validate-pin', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ pin: managerOverrideCode.trim() })
                                });
                                if (r.ok) {
                                  setManagerOverrideAuthorized(true);
                                  setSuccessStatus('Manager override authorised.');
                                  setTimeout(() => setSuccessStatus(null), 2500);
                                } else {
                                  setManagerOverrideAuthorized(false);
                                  setErrorStatus('Invalid manager PIN.');
                                  setTimeout(() => setErrorStatus(null), 2500);
                                }
                              } catch (e) {
                                setErrorStatus('PIN validation failed (network/server).');
                                setTimeout(() => setErrorStatus(null), 2500);
                              } finally {
                                setManagerOverrideChecking(false);
                              }
                            }}
                            className="py-1 px-2 rounded bg-[#dfb76c] text-black text-[10px] font-bold"
                          >
                            {managerOverrideChecking ? 'Checking…' : 'Validate PIN'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setManagerOverrideCode(''); setManagerOverrideAuthorized(false); }}
                            className="py-1 px-2 rounded border text-[10px] text-gray-400"
                          >
                            Clear
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-500 italic">Enter manager PIN and click Validate.</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MANUAL SERVICE CHARGES ENTRY */}
          <div className={`p-3 rounded-xl border space-y-2 ${
            isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-250" : "bg-[#0b0b0d] border-[#262633]/60"
          }`}>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
              isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
            }`}>Manual Service Charge</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 font-mono">£</span>
              <input
                type="number"
                placeholder="0.00"
                value={serviceCharge || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setServiceCharge(val);
                }}
                className={`text-xs w-full px-2.5 py-1.5 rounded-lg border focus:outline-none ${
                  isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#15151b] border-neutral-700 text-white"
                }`}
              />
            </div>
          </div>
          
          {/* FINANCIAL MATH BREAKDOWN DISPLAY */}
          <div className={`space-y-2.5 font-mono text-sm ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>
            <div className="flex justify-between text-xs">
              <span>Raw Item Subtotal:</span>
              <span className={isIpsHighContrast ? "text-neutral-900 font-semibold" : "text-white"}>£{getSubtotal().toFixed(2)}</span>
            </div>
            
            {getCartDiscountAmount() > 0 && (
              <div className="flex justify-between text-xs text-rose-500 font-bold">
                <span>Cart Discount ({cartDiscountType === "percent" ? `${cartDiscountValue}%` : "Fixed"}):</span>
                <span>-£{getCartDiscountAmount().toFixed(2)}</span>
              </div>
            )}

            {serviceCharge > 0 && (
              <div className="flex justify-between text-xs text-amber-500 font-bold">
                <span>Service Charge:</span>
                <span>+£{serviceCharge.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs">
              <span>VAT (Inclusive):</span>
              <span className={isIpsHighContrast ? "text-neutral-900 font-semibold" : "text-emerald-500"}>Included in Price</span>
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
                      onChange={(e) => setSplitPaymentMethod1(e.target.value)}
                      className={`w-full border p-1.5 rounded-lg focus:outline-none cursor-pointer text-xs ${
                        isIpsHighContrast 
                          ? "bg-white border-neutral-250 text-[#111116] focus:border-[#b89047]" 
                          : "bg-[#0d0f17] border-[#262633]/60 text-[#dfb76c] focus:border-[#dfb76c]"
                      }`}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="AMEX">AMEX</option>
                      <option value="Contactless">Contactless</option>
                      <option value="Apple Pay">Apple Pay</option>
                      <option value="Google Pay">Google Pay</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Gift Card">Gift Card</option>
                      <option value="Store Credit">Store Credit</option>
                      <option value="Custom">Custom Method</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[9px] text-gray-400 uppercase block">Rail 2</label>
                    <select 
                      value={splitPaymentMethod2}
                      onChange={(e) => setSplitPaymentMethod2(e.target.value)}
                      className={`w-full border p-1.5 rounded-lg focus:outline-none cursor-pointer text-xs ${
                        isIpsHighContrast 
                          ? "bg-white border-neutral-250 text-[#111116] focus:border-[#b89047]" 
                          : "bg-[#0d0f17] border-[#262633]/60 text-[#dfb76c] focus:border-[#dfb76c]"
                      }`}
                    >
                      <option value="Visa">Visa</option>
                      <option value="Cash">Cash</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="AMEX">AMEX</option>
                      <option value="Contactless">Contactless</option>
                      <option value="Apple Pay">Apple Pay</option>
                      <option value="Google Pay">Google Pay</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Gift Card">Gift Card</option>
                      <option value="Store Credit">Store Credit</option>
                      <option value="Custom">Custom Method</option>
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

            {/* MANUAL DIRECT PAYMENT METHODS DROPDOWN/SELECT (REMOVED OPEN BANKING) */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest block">
                Direct UK Payment Method
              </label>
              
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const m = e.target.value;
                  setPaymentMethod(m);
                  if (m !== "Cash") {
                    setAmountTendered(getTotalDue());
                  } else {
                    setAmountTendered(0);
                  }
                  setOpenBankingQrActive(false);
                }}
                className={`w-full text-xs font-semibold p-2.5 rounded-lg border cursor-pointer focus:outline-none ${
                  isIpsHighContrast 
                    ? "bg-white border-neutral-300 text-black focus:border-[#b89047]" 
                    : "bg-[#0b0b0d] border-[#dfb76c]/40 text-[#dfb76c] focus:border-[#dfb76c]"
                }`}
              >
                <option value="Cash">Cash (Manual Drawer)</option>
                <option value="Card">General Card Machine</option>
                <option value="Visa">Visa (Integrated)</option>
                <option value="Mastercard">Mastercard (Integrated)</option>
                <option value="AMEX">American Express (Integrated)</option>
                <option value="Contactless">Contactless NFC (Integrated)</option>
                <option value="Apple Pay">Apple Pay NFC Wallet</option>
                <option value="Google Pay">Google Pay NFC Wallet</option>
                <option value="Bank Transfer">Direct Bank Transfer</option>
                <option value="Gift Card">Boutique Gift Card</option>
                <option value="Store Credit">Store Credit Voucher</option>
                <option value="Custom">Custom Method</option>
              </select>
            </div>

            {/* CARD TERMINAL POS HARDWARE HUD */}
            {isCardMachineProcessing && (
              <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl space-y-2 text-left animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                  <span className="text-[10px] font-mono uppercase font-bold text-blue-400">POS CARD MACHINE ACTIVE</span>
                </div>
                <p className="text-xs font-mono text-gray-300">{cardMachineStatusText}</p>
              </div>
            )}
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

          {/* CUSTOMER INFO & DIGITAL RECEIPT DISPATCH FIELDS */}
          <div className={`space-y-3.5 border-t pt-3.5 ${isIpsHighContrast ? "border-neutral-200" : "border-[#262633]/60"}`}>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block">
                Customer Details & Digital Receipt
              </label>
              {savedLeads.length > 0 && (
                <span className="text-[9px] font-mono text-[#dfb76c] uppercase font-bold">
                  {savedLeads.length} Customers Enrolled
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-2.5">
              {/* Intelligent Real-time Auto-matching Badge */}
              {matchedLead ? (
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 font-mono text-[9px] animate-pulse ${
                  isIpsHighContrast
                    ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <div className="flex-1 truncate">
                    <span>Matched Saved Client: <strong>{matchedLead.name}</strong></span>
                    {matchedLead.vip && (
                      <span className="ml-1.5 px-1 py-0.5 text-[8px] uppercase tracking-wider font-bold bg-[#dfb76c]/20 border border-[#dfb76c]/40 text-[#dfb76c] rounded">
                        ★ VIP
                      </span>
                    )}
                  </div>
                </div>
              ) : (customerPhone.trim() || customerEmail.trim()) ? (
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 font-mono text-[9px] ${
                  isIpsHighContrast
                    ? "bg-neutral-50 border-neutral-200 text-neutral-500"
                    : "bg-neutral-800/10 border-neutral-800/40 text-gray-400"
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#dfb76c] animate-pulse"></span>
                  {digitalReceiptMethod === "none" ? (
                    <span>New Client Contact (Print Only selected - will not auto-save)</span>
                  ) : (
                    <span>New Client Contact (Will auto-enroll on digital receipt checkout)</span>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Customer Name</span>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`w-full text-xs font-semibold p-2 rounded-lg border focus:outline-none transition-all duration-300 ${
                      isIpsHighContrast 
                        ? "bg-white border-neutral-300 text-black focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border-[#dfb76c]/20 text-white focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c]/30"
                    }`}
                  />
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">WhatsApp / Phone</span>
                  <input
                    type="text"
                    placeholder="e.g. +44712345678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={`w-full text-xs font-semibold p-2 rounded-lg border focus:outline-none transition-all duration-300 ${
                      isIpsHighContrast 
                        ? "bg-white border-neutral-300 text-black focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border-[#dfb76c]/20 text-white focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c]/30"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Customer Email</span>
                  <input
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className={`w-full text-xs font-semibold p-2 rounded-lg border focus:outline-none transition-all duration-300 ${
                      isIpsHighContrast 
                        ? "bg-white border-neutral-300 text-black focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border-[#dfb76c]/20 text-white focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c]/30"
                    }`}
                  />
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider block">Receipt Distribution</span>
                  <select
                    value={digitalReceiptMethod}
                    onChange={(e) => setDigitalReceiptMethod(e.target.value as any)}
                    className={`w-full text-xs font-semibold p-2 rounded-lg border cursor-pointer focus:outline-none transition-all duration-300 ${
                      isIpsHighContrast 
                        ? "bg-white border-neutral-300 text-black focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border-[#dfb76c]/20 text-[#dfb76c] focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c]/30"
                    }`}
                  >
                    <option value="none">Print Only (No Dispatch)</option>
                    <option value="email">Send via Email</option>
                    <option value="whatsapp">Send via WhatsApp</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CHECKOUT MASTER BUTTON */}
          <button
            id="checkout-master-trigger"
            type="button"
            onClick={handleFinalCheckout}
            disabled={cart.length === 0 || isCheckoutProcessing}
            className={`w-full font-display font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-all duration-300 ease-in-out shadow-lg cursor-pointer ${
              cart.length === 0 
                ? (isIpsHighContrast ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed shadow-none" : "bg-[#1f1f2a] text-gray-650 cursor-not-allowed border border-[#262633]/40") 
                : (isIpsHighContrast ? "bg-[#b89047] hover:bg-[#a37e3d] text-white active:scale-95" : "bg-[#dfb76c] hover:bg-[#ebd097] text-black active:scale-95")
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>{isCheckoutProcessing ? "Processing..." : `Process Checkout (£${getTotalDue().toFixed(2)})`}</span>
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
          id="print-receipt-thermal-document" 
          className="print-receipt-only text-black"
          style={{ 
            width: "72mm", 
            maxWidth: "72mm",
            margin: 0, 
            padding: "2mm", 
            backgroundColor: "#ffffff", 
            color: "#000000",
            fontFamily: "monospace"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "15px" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ maxHeight: "35px", maxWidth: "120px", display: "block", margin: "0 auto 6px auto", objectFit: "contain", filter: "grayscale(100%) contrast(1)", opacity: 1 }} />
            ) : null}
            <h1 style={{ fontSize: "19px", fontWeight: "bold", margin: "0", letterSpacing: "2px" }}>{brandName.toUpperCase()}</h1>
            <p style={{ fontSize: "10px", margin: "2px 0 0 0", textTransform: "uppercase" }}>Fine Tailoring & Menswear</p>
            <p style={{ fontSize: "9px", margin: "2px 0" }}>Savile Row, London W1S</p>
            <p style={{ fontSize: "9px", margin: "2px 0" }}>Tel: +44 20 7946 0192</p>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }}></div>
            <p style={{ fontSize: "10px", fontWeight: "bold", margin: "0" }}>SALES RECEIPT ({thermalWidth})</p>
          </div>

          <div style={{ fontSize: "9px", marginBottom: "10px", fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", justifyContent: "between" }}>
              <span>INVOICE ID:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{currentInvoice.id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between" }}>
              <span>DATE/TIME:</span>
              <span style={{ marginLeft: "auto" }}>{new Date(currentInvoice.timestamp).toLocaleString("en-GB")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between" }}>
              <span>CASHIER:</span>
              <span style={{ marginLeft: "auto" }}>{currentInvoice.salesperson}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between" }}>
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
                    <div style={{ fontSize: "8px", color: "#000" }}>Color: {i.colour} | Size: {i.size}</div>
                  </td>
                  <td style={{ textAlign: "center", paddingTop: "5px" }}>{i.qty}</td>
                  <td style={{ textAlign: "right", paddingTop: "5px" }}>£{(i.sellingPrice * i.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderBottom: "1px dashed #000", marginTop: "10px", marginBottom: "8px" }}></div>

          <div style={{ fontSize: "9px", fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "between" }}>
              <span>SUBTOTAL:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between" }}>
              <span>INCLUDE VAT:</span>
              <span style={{ marginLeft: "auto", fontSize: "8px" }}>{Math.round((vatRate || 0.2) * 100)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between", fontSize: "11px", fontWeight: "bold", marginTop: "4px" }}>
              <span>TOTAL DUE:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.total.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between", marginTop: "3px" }}>
              <span>AMOUNT TENDERED:</span>
              <span style={{ marginLeft: "auto" }}>£{currentInvoice.amountTendered.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between" }}>
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
          id="print-zreport-thermal-document" 
          className="print-receipt-only text-black"
          style={{ 
            width: "72mm", 
            maxWidth: "72mm",
            margin: 0, 
            padding: "2mm", 
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

          <div style={{ fontSize: "9px", marginBottom: "10px", fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", justifyContent: "between", marginBottom: "3px" }}>
              <span>REPORT TIME:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{new Date(zReportData.timestamp).toLocaleString("en-GB")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between", marginBottom: "3px" }}>
              <span>OPERATOR:</span>
              <span style={{ marginLeft: "auto" }}>{activeSeller} ({operatorRole})</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between" }}>
              <span>TOTAL SALES COUNT:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{zReportData.totalSales} Transactions</span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", marginBottom: "8px" }}></div>
          
          <div style={{ fontSize: "9px", fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "between", marginBottom: "3px" }}>
              <span>GROSS TURNOVER:</span>
              <span style={{ marginLeft: "auto", fontWeight: "bold" }}>£{zReportData.grandTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between", marginBottom: "3px" }}>
              <span>VAT COLLECTED:</span>
              <span style={{ marginLeft: "auto" }}>£{zReportData.totalVat.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "between", fontSize: "10px", fontWeight: "bold", marginTop: "4px" }}>
              <span>NET PROFITS:</span>
              <span style={{ marginLeft: "auto" }}>£{zReportData.totalProfit.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", marginTop: "10px", marginBottom: "8px" }}></div>

          <div style={{ fontSize: "9px", fontFamily: "monospace" }}>
            <p style={{ fontWeight: "bold", margin: "0 0 5px 0" }}>PAYMENT METHOD BREAKDOWN</p>
            {Object.entries(zReportData.breakdown).map(([method, total]: any) => (
              <div key={method} style={{ display: "flex", justifyContent: "between", marginBottom: "2px" }}>
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
                  triggerThermalPrint("audit");
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

      {/* BOUTIQUE GARMENT VARIATION OPTIONS SELECTOR */}
      {activeOptionsProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in print:hidden">
          <div className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl relative space-y-5 ${
            isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-800" : "bg-[#121216] border-[#262633]/60 text-white"
          }`}>
            <div className="flex justify-between items-center border-b border-neutral-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className={`font-display font-medium uppercase tracking-widest text-[11px] leading-none mt-0.5 ${
                  isIpsHighContrast ? "text-neutral-900" : "text-amber-500"
                }`}>Configure Luxury Garment</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveOptionsProduct(null)}
                className="text-gray-400 hover:text-white transition-colors font-mono text-xs cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="space-y-4 text-left">
              <h4 className={`text-base font-semibold ${isIpsHighContrast ? "text-black" : "text-white"}`}>
                {activeOptionsProduct.name}
              </h4>
              <p className="text-xs text-neutral-400 font-mono">
                Category: {activeOptionsProduct.category} | Supplier: {activeOptionsProduct.supplier}
              </p>

              {/* Dynamic Attribute Selectors */}
              <div className="space-y-4">
                {activeOptionsProduct.attributes.map(attr => (
                  <div key={attr.name} className="space-y-1.5">
                    <label className={`text-[10px] font-mono uppercase tracking-wider ${
                      isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                    }`}>
                      Select {attr.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map(val => {
                        const isSelected = selectedOptions[attr.name] === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [attr.name]: val }))}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? (isIpsHighContrast ? "bg-[#b89047] text-white border-[#b89047]" : "bg-[#dfb76c] text-black border-[#dfb76c]")
                                : (isIpsHighContrast ? "bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50" : "bg-[#181821] border-[#262633]/60 text-gray-300 hover:bg-[#20202c]")
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Real-time Combination Details */}
              {(() => {
                const match = activeOptionsProduct.variations.find(v => {
                  return Object.entries(selectedOptions).every(([attrName, value]) => {
                    return v.attributeValues?.[attrName] === value || v.attributeValues?.[attrName?.toLowerCase()] === value;
                  });
                });

                return (
                  <div className={`p-3 rounded-xl border font-mono text-xs space-y-1 ${
                    isIpsHighContrast ? "bg-neutral-50 border-neutral-200 text-neutral-800" : "bg-[#0c0c0e] border-neutral-800/60 text-neutral-300"
                  }`}>
                    {match ? (
                      <>
                        <div className="flex justify-between">
                          <span>VARIATION SKU:</span>
                          <span className="font-bold">{match.sku || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>BARCODE:</span>
                          <span>{match.barcode || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>BOUTIQUE STOCK:</span>
                          <span className={`font-bold ${match.stock <= 2 ? "text-red-500" : "text-green-400"}`}>
                            {match.stock} unit(s)
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-neutral-800 pt-1 mt-1 text-sm font-semibold">
                          <span>PRICE (GBP):</span>
                          <span className={isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}>
                            £{match.sellingPrice}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-red-500 font-bold block text-center py-2">
                        OUT OF STOCK / NOT CONFIGURED
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="border-t border-neutral-800/60 pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setActiveOptionsProduct(null)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer text-center ${
                  isIpsHighContrast ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-800" : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddConfiguredVariation}
                className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer text-center ${
                  isIpsHighContrast ? "bg-[#b89047] hover:bg-[#a6803c] text-white" : "bg-[#dfb76c] hover:bg-[#cfab60] text-black"
                }`}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL RECEIPT DISPATCHER & LEAD CAPTURE SYSTEM MODAL */}
      {showReceiptModal && currentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in print:hidden">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#0c0c0e] border-[#dfb76c]/30 text-white"
          }`}>
            
            {/* Modal Header */}
            <div className={`flex justify-between items-center border-b pb-3 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800"
            }`}>
              <div className="flex items-center gap-2">
                <FileText className={`w-5 h-5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                <h3 className={`font-display font-bold uppercase tracking-widest text-xs leading-none ${
                  isIpsHighContrast ? "text-neutral-800" : "text-[#dfb76c]"
                }`}>
                  Digital Receipt Dispatcher & Lead Capture
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  clearSessionCart();
                  setShowReceiptModal(false);
                  setDispatchStatus("idle");
                  setDispatchMessage("");
                  setIsVipSaved(false);
                }}
                className="text-gray-400 hover:text-white transition-colors font-mono text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Invoice Meta Summary */}
            <div className={`p-4 rounded-xl font-mono text-xs space-y-1.5 ${
              isIpsHighContrast ? "bg-neutral-150 border border-neutral-300" : "bg-[#111115] border border-neutral-800/80"
            }`}>
              <div className="flex justify-between">
                <span className="text-gray-400">INVOICE NUMBER:</span>
                <span className="font-bold">{currentInvoice.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">TOTAL PAID:</span>
                <span className={`font-bold ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>
                  £{currentInvoice.total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">SALESPERSON:</span>
                <span className="font-bold">{currentInvoice.salesperson}</span>
              </div>
            </div>

            {/* Receipt Preview */}
            <div className={`p-4 rounded-2xl border ${
              isIpsHighContrast ? "bg-neutral-100 border-neutral-300" : "bg-[#09090d] border-[#262633]"
            } text-[11px] space-y-3`}> 
              <div className="flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-gray-400">Receipt Preview</span>
                <span className="text-[10px] font-bold text-[#dfb76c] uppercase">{thermalWidth} View</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Customer</span>
                  <span>{currentInvoice.customer?.name || "Guest"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Phone / WhatsApp</span>
                  <span>{currentInvoice.customer?.phone || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Email</span>
                  <span>{currentInvoice.customer?.email || "N/A"}</span>
                </div>
              </div>
              <div className="border-t border-neutral-800 pt-3">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {currentInvoice.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-[10px] text-gray-400">{item.size || "Standard"} • {item.colour || "Default"}</div>
                      </div>
                      <div className="text-right text-[10px]">
                        <div>×{item.qty}</div>
                        <div>£{(item.sellingPrice * item.qty).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>£{currentInvoice.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Include VAT</span><span>{Math.round((vatRate || 0.2) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Change</span><span>£{currentInvoice.changeDue.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span>£{currentInvoice.total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            {/* Customer Details review */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block">
                Verify Customer Contact (Leads Capture)
              </span>

              {/* Intelligent Real-time Auto-matching Badge */}
              {matchedLead ? (
                <div className={`p-2 rounded-xl border flex items-center gap-2 font-mono text-[9px] animate-pulse ${
                  isIpsHighContrast
                    ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <div className="flex-1 truncate">
                    <span>Matched Saved Client: <strong>{matchedLead.name}</strong></span>
                    {matchedLead.vip && (
                      <span className="ml-1.5 px-1 py-0.5 text-[8px] uppercase tracking-wider font-bold bg-[#dfb76c]/20 border border-[#dfb76c]/40 text-[#dfb76c] rounded">
                        ★ VIP
                      </span>
                    )}
                  </div>
                </div>
              ) : (customerPhone.trim() || customerEmail.trim()) ? (
                <div className={`p-2 rounded-xl border flex items-center gap-2 font-mono text-[9px] ${
                  isIpsHighContrast
                    ? "bg-neutral-50 border-neutral-200 text-neutral-500"
                    : "bg-neutral-800/10 border-neutral-800/40 text-gray-400"
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#dfb76c] animate-pulse"></span>
                  {digitalReceiptMethod === "none" ? (
                    <span>New Client (Will register when dispatched via WhatsApp / Email)</span>
                  ) : (
                    <span>New Client (Will register automatically on save)</span>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-gray-400 block">Name</label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`w-full p-2 text-xs font-semibold rounded-lg border focus:outline-none ${
                      isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#121216] border-[#dfb76c]/20 text-white"
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-gray-400 block">Phone / WhatsApp</label>
                  <input 
                    type="text" 
                    value={customerPhone} 
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={`w-full p-2 text-xs font-semibold rounded-lg border focus:outline-none ${
                      isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#121216] border-[#dfb76c]/20 text-white"
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <label className="text-[9px] font-mono text-gray-400 block">Email</label>
                <input 
                  type="email" 
                  value={customerEmail} 
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={`w-full p-2 text-xs font-semibold rounded-lg border focus:outline-none ${
                    isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#121216] border-[#dfb76c]/20 text-white"
                  }`}
                />
              </div>

              {/* VIP Lead button */}
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-[10px] font-mono text-gray-400">VIP Loyalty Program Status:</span>
                <button
                  type="button"
                  onClick={handleSaveVipLead}
                  disabled={isVipSaved || !customerName}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
                    isVipSaved 
                      ? "bg-emerald-650 text-white cursor-default font-bold" 
                      : !customerName 
                        ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                        : "bg-[#dfb76c]/10 text-[#dfb76c] hover:bg-[#dfb76c] hover:text-black cursor-pointer"
                  }`}
                >
                  {isVipSaved ? "✓ VIP Lead Saved" : "★ Save VIP Lead"}
                </button>
              </div>
            </div>

            {/* Dispatch Status feedback */}
            {dispatchStatus !== "idle" && (
              <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-2 animate-pulse ${
                dispatchStatus === "sending" 
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-400" 
                  : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
              }`}>
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${dispatchStatus === "sending" ? "animate-spin" : ""}`} />
                  <span className="font-bold uppercase tracking-wider">
                    {dispatchStatus === "sending" ? "Dispatching..." : "Dispatched Successfully"}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-300">
                  {dispatchMessage}
                </p>
              </div>
            )}

            {/* Quick Dispatch Channels */}
            <div className={`border-t pt-4 ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800"}`}>
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-2.5 text-center">
                Select Dispatch Channel
              </span>
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => handleDispatchDigitalReceipt("whatsapp")}
                  disabled={!customerPhone}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    !customerPhone 
                      ? "opacity-40 cursor-not-allowed border-neutral-800" 
                      : "border-neutral-800 bg-[#0b0b0d] hover:bg-emerald-950/40 hover:border-emerald-500 text-emerald-400 cursor-pointer"
                  }`}
                >
                  <span className="text-lg">💬</span>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wide">WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDispatchDigitalReceipt("email")}
                  disabled={!customerEmail}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    !customerEmail 
                      ? "opacity-40 cursor-not-allowed border-neutral-800" 
                      : "border-neutral-800 bg-[#0b0b0d] hover:bg-blue-950/40 hover:border-blue-500 text-blue-400 cursor-pointer"
                  }`}
                >
                  <span className="text-lg">📧</span>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wide">Email</span>
                </button>
              </div>
            </div>

            {/* Download PDF Receipt */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  printPremiumReceiptPDF(currentInvoice);
                }}
                className={`w-full py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isIpsHighContrast 
                    ? "bg-[#b89047] hover:bg-[#a57f3c] text-white" 
                    : "bg-[#dfb76c] hover:bg-[#cfab60] text-black"
                }`}
              >
                <Download className="w-4 h-4" /> Download PDF / Full Receipt
              </button>
            </div>

            {/* Standard Footer Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerThermalPrint("receipt");
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  isIpsHighContrast ? "bg-neutral-200 hover:bg-neutral-300 text-neutral-800" : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400"
                }`}
              >
                <Printer className="w-4 h-4" /> Spool Ticket
              </button>

              <button
                type="button"
                onClick={() => {
                  clearSessionCart();
                  setShowReceiptModal(false);
                  setDispatchStatus("idle");
                  setDispatchMessage("");
                  setIsVipSaved(false);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  isIpsHighContrast ? "bg-[#b89047] hover:bg-[#a6803c] text-white" : "bg-[#dfb76c] hover:bg-[#cfab60] text-black"
                }`}
              >
                ★ New Order
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AUTOMATIC CASH DRAWER INSTANT SIGNAL ALERT */}
      {isAutoDrawerOpen && (
        <div className="fixed bottom-6 right-6 z-[999] p-4 bg-amber-500 text-black border-2 border-black rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="p-2 bg-black text-amber-500 rounded-lg text-lg font-bold">
            🔑
          </div>
          <div className="text-left font-mono">
            <h4 className="font-bold text-xs uppercase tracking-wider">CASH DRAWER AUTO-OPENED</h4>
            <p className="text-[9px] font-semibold opacity-95">Solenoid Kick Active | Latch Released Successfully</p>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}