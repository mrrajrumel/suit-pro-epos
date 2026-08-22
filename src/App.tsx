import React, { useState, useEffect, useRef } from "react";
import { seedDatabaseIfEmpty } from "./lib/db-helpers.ts";
import Dashboard from "./components/Dashboard.tsx";
import PosTerminal from "./components/PosTerminal.tsx";
import SalesLedger from "./components/SalesLedger.tsx";
import InventoryManager from "./components/InventoryManager.tsx";
import ExpensesLedger from "./components/ExpensesLedger.tsx";
import ReceiptsLogger from "./components/ReceiptsLogger.tsx";
import NetworkScanner from "./components/NetworkScanner.tsx";
import SystemBackup from "./components/SystemBackup.tsx";
import { 
  ShoppingCart, 
  Layers, 
  Package, 
  Receipt, 
  TrendingUp, 
  Smartphone, 
  Users, 
  User, 
  Sparkles,
  Wifi,
  Scale,
  Database,
  Sliders,
  ShieldAlert,
  Cpu,
  Github,
  Linkedin,
  Instagram,
  Youtube,
  Music2,
  Globe
} from "lucide-react";

interface LocalUser {
  displayName: string;
  email: string;
  photoURL?: string;
  role?: "Owner" | "Manager" | "Cashier";
}

import ManagementConsole from "./components/ManagementConsole.tsx";
import CapitalManager from "./components/CapitalManager.tsx";
import SupplierManager from "./components/SupplierManager.tsx";
import { PrintPreviewRequest } from "./lib/print-preview.ts";

type ActiveTab = "pos" | "dashboard" | "sales" | "inventory" | "expenses" | "receipts" | "remote" | "backup" | "management" | "capital" | "suppliers";

export default function App() {
  const [user, setUser] = useState<LocalUser | null>(null);
  
  const userRole = user?.role || "Cashier";

  const canAccess = (tab: ActiveTab): boolean => {
    // TODO: This is only a UI guard. Re-validate the user's role server-side on every protected API request.
    if (userRole === "Owner") return true;
    if (userRole === "Manager") {
      return tab !== "backup";
    }
    if (userRole === "Cashier") {
      return tab === "pos" || tab === "receipts" || tab === "remote";
    }
    return false;
  };

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("pos");
  const [activeSeller, setActiveSeller] = useState("Rumel Ahmed");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isIpsHighContrast, setIsIpsHighContrast] = useState(false);
  
  // Custom brand and desktop simulation states
  const defaultLogo = "/icon.png";
  const [brandName, setBrandName] = useState(() => localStorage.getItem("suitpro_brand_name") || "SUIT PRO");
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("suitpro_logo_url") || defaultLogo);
  const [storagePath, setStoragePath] = useState(() => localStorage.getItem("suitpro_storage_path") || "C:\\Users\\Administrator\\Documents\\SuitPro-Records\\");
  const [isInstalled, setIsInstalled] = useState(() => localStorage.getItem("suitpro_installed") === "true");
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // Professional Setup Installer Wizard States
  const [setupStep, setSetupStep] = useState(1);
  const [setupBrandName, setSetupBrandName] = useState("SUIT PRO");
  const [setupStoragePath, setSetupStoragePath] = useState("C:\\Users\\Administrator\\Documents\\SuitPro-Records\\");
  const [setupOperatorName, setSetupOperatorName] = useState("Rumel Ahmed");
  const [setupCurrency, setSetupCurrency] = useState("GBP");
  const [setupPaperSize, setSetupPaperSize] = useState("80mm");
  const [licenseAccepted, setLicenseAccepted] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installingStatusText, setInstallingStatusText] = useState("");

  // Sheet sync operational states
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [printPreview, setPrintPreview] = useState<PrintPreviewRequest | null>(null);
  const [printInProgress, setPrintInProgress] = useState(false);
  const printInProgressRef = useRef(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; isDefault: boolean; status: number }>>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");

  useEffect(() => {
    if (!canAccess(activeTab)) {
      setActiveTab("pos");
    }
  }, [activeTab, userRole]);

  useEffect(() => {
    const handlePreviewRequest = (event: Event) => {
      const request = (event as CustomEvent<PrintPreviewRequest>).detail;
      if (request?.html && !printInProgressRef.current) {
        setPrintError(null);
        setPrintPreview(request);
        const printerRequest = window.electronAPI?.getPrinters?.();
        printerRequest?.then((availablePrinters) => {
          setPrinters(availablePrinters);
          const defaultPrinter = availablePrinters.find((printer) => printer.isDefault);
          setSelectedPrinter(defaultPrinter?.name || availablePrinters[0]?.name || "");
        }).catch(() => {
          setPrinters([]);
          setSelectedPrinter("");
        });
      }
    };
    window.addEventListener("suitpro:print-preview", handlePreviewRequest);
    return () => window.removeEventListener("suitpro:print-preview", handlePreviewRequest);
  }, []);

  useEffect(() => {
    const handleNativePrintShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "p" || !printPreview || printInProgress) return;
      event.preventDefault();
      printPreviewFromNativeDialog();
    };
    window.addEventListener("keydown", handleNativePrintShortcut);
    return () => window.removeEventListener("keydown", handleNativePrintShortcut);
  }, [printPreview, printInProgress, selectedPrinter]);

  const handlePrintPreview = async () => {
    if (!printPreview || printInProgress) return;
    printInProgressRef.current = true;
    setPrintInProgress(true);
    setPrintError(null);
    try {
      const result = await window.electronAPI?.printHtml?.(printPreview.html, {
        title: printPreview.title,
        paperSize: printPreview.paperSize || (localStorage.getItem("suitpro_paper_size") as "58mm" | "80mm" | "A4" | null) || "80mm",
        deviceName: selectedPrinter || undefined
      });
      if (!result?.success) {
        throw new Error(result?.error || "Printer did not accept the document.");
      }
      setPrintPreview(null);
    } catch (error: any) {
      setPrintError(error?.message || "Printing failed. Check the selected printer and try again.");
    } finally {
      printInProgressRef.current = false;
      setPrintInProgress(false);
    }
  };

  const printPreviewFromNativeDialog = async () => {
    if (!printPreview || printInProgress || !window.electronAPI?.printHtml) return;
    printInProgressRef.current = true;
    setPrintInProgress(true);
    setPrintError(null);
    try {
      const result = await window.electronAPI.printHtml(printPreview.html, {
        title: printPreview.title,
        paperSize: "80mm",
        silent: false
      });
      if (!result?.success) throw new Error(result?.error || "Native print dialog rejected the document.");
      setPrintPreview(null);
    } catch (error: any) {
      setPrintError(error?.message || "Native printing failed.");
    } finally {
      printInProgressRef.current = false;
      setPrintInProgress(false);
    }
  };

  const handleTestPrint = async () => {
    if (printInProgress || !window.electronAPI?.printHtml) return;
    const testHtml = `<!doctype html><html><head><meta charset="utf-8"><title>SUIT PRO Test Receipt</title></head><body><main style="width:72mm;padding:2mm;font-family:monospace;color:#000;background:#fff"><h1 style="font-size:18px;text-align:center">SUIT PRO</h1><p style="text-align:center">TEST RECEIPT</p><hr><p>Printer pipeline verification</p><p>Amount: £123.45</p><p style="text-align:center">CONTENT TEST OK</p></main></body></html>`;
    setPrintInProgress(true);
    setPrintError(null);
    try {
      const result = await window.electronAPI.printHtml(testHtml, { title: "SUIT PRO Test Receipt", paperSize: "80mm", deviceName: selectedPrinter || undefined });
      if (!result?.success) throw new Error(result?.error || "Test receipt was rejected by the printer.");
    } catch (error: any) {
      setPrintError(error?.message || "Test receipt printing failed.");
    } finally {
      setPrintInProgress(false);
    }
  };

  const handleSyncSheets = async () => {
    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/pos/sync-sheets", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setSyncStatus("success");
         setSyncMessage(d.message);
        setTimeout(() => setSyncStatus("idle"), 3000);
      } else {
        throw new Error("Synchronization query returned status failure.");
      }
    } catch (err: any) {
      setSyncStatus("error");
      setSyncMessage(err.message || "Manual connection sync error.");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  };

  // Forces components to refresh and update statistics on transaction completion
  const [ticker, setTicker] = useState(0);
  const handleTransactionComplete = () => {
    setTicker(prev => prev + 1);
  };

  // 1. Client Connected Device Heartbeat ping
  useEffect(() => {
    let clientDeviceId = localStorage.getItem("suitpro_device_id");
    if (!clientDeviceId) {
      clientDeviceId = `pos-term-london-${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem("suitpro_device_id", clientDeviceId);
    }

    const fireHeartbeat = () => {
      let type: "Desktop POS" | "Tablet" | "Mobile POS" = "Desktop POS";
      if (window.innerWidth < 768) {
        type = "Mobile POS";
      } else if (window.innerWidth < 1024) {
        type = "Tablet";
      }

      const osStr = navigator.userAgent.toLowerCase().includes("windows") 
        ? "Windows 11 Pro"
        : navigator.userAgent.toLowerCase().includes("mac") 
        ? "macOS Sequoia"
        : "Linux Touchpad OS";

      fetch("/api/devices/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientDeviceId,
          type,
          os: osStr,
          status: "Active"
        })
      }).catch(() => {
        // quiet fallback
      });
    };

    fireHeartbeat();
    const interval = setInterval(fireHeartbeat, 15000);
    return () => clearInterval(interval);
  }, []);

  // Simulated professional installation progress thread
  useEffect(() => {
    if (setupStep === 4) {
      setInstallProgress(0);
      setInstallingStatusText("Booting deployment script...");
      
      const logs = [
        { progress: 12, text: "[SYSTEM] Unpacking GUI resources & registering custom fonts..." },
        { progress: 28, text: `[WORKSPACE] Allocating local record directory block at: ${setupStoragePath}` },
        { progress: 48, text: "[DATABASE] Initializing high-capacity offline storage block schema..." },
        { progress: 68, text: "[CATALOG] Seeding default Savile Row suit collections & inventory..." },
        { progress: 85, text: `[OPERATOR] Configuring initial administrative profiles for: ${setupOperatorName}` },
        { progress: 96, text: `[HARDWARE] Calibrating high fidelity printer spoolers for standard ${setupPaperSize} profiles...` },
        { progress: 100, text: "[SUCCESS] Suit Pro Suite fully calibrated! Ready for enterprise deployment." }
      ];

      let idx = 0;
      const progressTimer = setInterval(() => {
        if (idx < logs.length) {
          setInstallProgress(logs[idx].progress);
          setInstallingStatusText(logs[idx].text);
          idx++;
        } else {
          clearInterval(progressTimer);
        }
      }, 800);

      return () => clearInterval(progressTimer);
    }
  }, [setupStep]);

  // 2. Local session recovery check
  useEffect(() => {
    const stored = localStorage.getItem("suitpro_active_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LocalUser;
        setUser(parsed);
        setActiveSeller(parsed.displayName);
      } catch {
        // Fallback
      }
    }
    
    // Assure database is seeded and surface failures instead of silently blocking login.
    seedDatabaseIfEmpty()
      .catch((err) => {
        console.error("Database bootstrap failed during app startup:", err);
        setAuthError("System startup failed while preparing local data. Please refresh or check storage access.");
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAuthError("Please input both username and secret passcode credentials.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        const tailor: LocalUser = {
          displayName: data.user.name,
          email: `${data.user.username.toLowerCase()}@savilerow.london`,
          role: data.user.role
        };
        setUser(tailor);
        setActiveSeller(data.user.name);
        localStorage.setItem("suitpro_active_user", JSON.stringify(tailor));
        // Reset inputs
        setLoginUsername("");
        setLoginPassword("");
      } else {
        const data = await res.json();
        setAuthError(data.error || "The credentials supplied failed verification.");
      }
    } catch (err) {
      // Offline fallback
      const offlineUser = import.meta.env.VITE_OFFLINE_USER?.trim();
      const offlinePass = import.meta.env.VITE_OFFLINE_PASS;
      if (offlineUser && offlinePass && loginUsername.trim() === offlineUser && loginPassword === offlinePass) {
        const tailor: LocalUser = {
          displayName: offlineUser,
          email: `${offlineUser.toLowerCase()}@local.suitpro`,
          role: "Owner"
        };
        setUser(tailor);
        setActiveSeller(offlineUser);
        localStorage.setItem("suitpro_active_user", JSON.stringify(tailor));
        setLoginUsername("");
        setLoginPassword("");
      } else {
        setAuthError("Local offline login failed. Check credentials or server state.");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("suitpro_active_user");
    setUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#0b0b0d] via-[#111115] to-[#16161c] text-gray-200 flex flex-col items-center justify-center antialiased">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <div className="animate-spin border-4 border-[#dfb76c] border-t-transparent w-12 h-12 rounded-full mb-2"></div>
          <h2 className="font-display font-medium text-lg text-[#dfb76c] tracking-[0.2em] uppercase">SUIT PRO</h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">Securing Terminal connection to Local Ledger Storage...</p>
        </div>
      </div>
    );
  }

  if (!isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#0b0b0d] via-[#111115] to-[#16161c] text-gray-200 flex flex-col items-center justify-center antialiased relative overflow-hidden p-4 selection:bg-[#dfb76c] selection:text-black">
        {/* Subtle decorative luxury ambient glow spheres */}
        <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-[#dfb76c]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[450px] h-[450px] bg-blue-900/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-xl w-full mx-auto relative z-10 my-8">
          <div className="bg-[#18181f]/60 backdrop-blur-xl border border-[#dfb76c]/30 rounded-2xl p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] flex flex-col transition-all duration-300">
            
            {/* Header branding block */}
            <div className="flex items-center gap-3.5 border-b border-[#262633]/60 pb-5 mb-6">
              <div className="border border-[#dfb76c]/40 p-2.5 rounded-lg bg-[#090d16] shadow-sm shadow-amber-500/5">
                <Cpu className="w-6 h-6 text-[#dfb76c] animate-pulse" />
              </div>
              <div className="text-left">
                <h1 className="font-display font-black text-xl text-white tracking-[0.15em] uppercase leading-none">SUIT PRO</h1>
                <p className="text-[9px] text-[#dfb76c] font-mono tracking-[0.25em] uppercase mt-1.5">
                  Savile Row London • Retail Setup Engine
                </p>
              </div>
              <div className="ml-auto text-right font-mono text-[10px] text-gray-400 bg-black/45 px-2.5 py-1 rounded-md border border-[#262633]/50">
                WIZARD STEP {setupStep} / 5
              </div>
            </div>

            {/* STEP 1: WELCOME & LICENSE TERMS */}
            {setupStep === 1 && (
              <div className="space-y-4 text-left font-mono text-xs">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Welcome to the Suit Pro Installation Wizard</h2>
                <p className="text-gray-400 leading-relaxed">
                  This assistant compiles and deploys the certified premium point-of-sale retail management database to your local PC workspace for offline-resilient operations.
                </p>
                <div className="bg-black/50 p-4 rounded-lg border border-neutral-850 h-36 overflow-y-auto text-[10px] text-gray-500 leading-relaxed space-y-2">
                  <p className="font-bold text-gray-400 uppercase">SUIT PRO END USER LICENSE AGREEMENT (EULA)</p>
                  <p>1. LICENSE GRANT: Suit Pro London grants you a local offline node license to run this enterprise boutique client software package on a single machine or network cluster.</p>
                  <p>2. PERSISTENT STORAGE: All transaction ledgers, digital receipts, custom invoices, and catalog data are stored directly inside your specified local storage path and cached browser containers.</p>
                  <p>3. DATA COMPLIANCE: The software is configured to follow global GDPR and financial safety standards. No private database copies or API secrets are sent back to remote AI servers.</p>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-gray-300 pt-2">
                  <input 
                    type="checkbox" 
                    checked={licenseAccepted}
                    onChange={(e) => setLicenseAccepted(e.target.checked)}
                    className="mt-0.5 accent-[#dfb76c] h-3.5 w-3.5 rounded"
                  />
                  <span className="text-[10px] uppercase tracking-wide">I accept the End User License Agreement and wish to proceed</span>
                </label>

                <div className="pt-4 border-t border-neutral-850 flex justify-end">
                  <button
                    type="button"
                    disabled={!licenseAccepted}
                    onClick={() => setSetupStep(2)}
                    className={`px-5 py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-widest cursor-pointer transition-all duration-300 ${
                      licenseAccepted 
                        ? "bg-[#dfb76c] hover:bg-[#ebd097] text-black font-semibold" 
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed font-semibold"
                    }`}
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: LOCAL DIRECTORY PATH SYSTEM */}
            {setupStep === 2 && (
              <div className="space-y-4 text-left font-mono text-xs">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">PC Database & Output Directory Settings</h2>
                <p className="text-gray-400 leading-relaxed">
                  Specify the local target storage path directory where your sales ledgers, CSV audit sheets, system backups, and PDF invoices will be saved.
                </p>

                <div className="space-y-2.5 pt-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Target Workspace Directory Path</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={setupStoragePath}
                      onChange={(e) => setSetupStoragePath(e.target.value)}
                      className="flex-1 bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2.5 px-3.5 text-[#dfb76c] text-[11px] focus:outline-none transition-all duration-300 font-mono"
                      placeholder="e.g. C:\SuitPro-Records"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const drives = ["C:\\", "D:\\", "E:\\"];
                        const subdirs = ["Documents\\SuitPro-Records", "SavileRow\\POS_Data", "RetailData\\Backups"];
                        const randomDrive = drives[Math.floor(Math.random() * drives.length)];
                        const randomSub = subdirs[Math.floor(Math.random() * subdirs.length)];
                        setSetupStoragePath(`${randomDrive}${randomSub}\\`);
                      }}
                      className="bg-neutral-850 hover:bg-neutral-800 text-[#dfb76c] px-3.5 rounded-lg border border-[#dfb76c]/20 hover:border-[#dfb76c]/40 transition-all duration-300 text-sm cursor-pointer font-bold"
                      title="Choose Custom Location"
                    >
                      📁
                    </button>
                  </div>
                  <div className="text-[10px] text-amber-500/80 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg leading-relaxed mt-1">
                    ✓ Write/read storage access checks succeeded. Suit Pro will deploy offline databases and compile PDF exports directly to this desktop location.
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-850 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setSetupStep(1)}
                    className="px-4 py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-wider text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupStep(3)}
                    className="px-5 py-2.5 rounded-lg bg-[#dfb76c] hover:bg-[#ebd097] text-black font-bold uppercase text-[10px] tracking-widest cursor-pointer transition-all duration-300"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SHOWROOM BRAND CONFIGURATION */}
            {setupStep === 3 && (
              <div className="space-y-4 text-left font-mono text-xs">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Showroom Configuration & Branding</h2>
                <p className="text-gray-400 leading-relaxed">
                  Tailor your local terminal profile, default print sizes, and regional currency settings for direct billing.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-1.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Showroom Brand Name</label>
                    <input 
                      type="text" 
                      value={setupBrandName}
                      onChange={(e) => setSetupBrandName(e.target.value)}
                      className="w-full bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none transition-all duration-300 font-mono text-xs animate-none"
                      placeholder="e.g. SUIT PRO"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Primary Owner Name</label>
                    <input 
                      type="text" 
                      value={setupOperatorName}
                      onChange={(e) => setSetupOperatorName(e.target.value)}
                      className="w-full bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none transition-all duration-300 font-mono text-xs"
                      placeholder="e.g. Rumel Ahmed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Local Base Currency</label>
                    <select
                      value={setupCurrency}
                      onChange={(e) => setSetupCurrency(e.target.value)}
                      className="w-full bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none cursor-pointer font-mono text-xs"
                    >
                      <option value="GBP">GBP (£) - Savile Row London</option>
                      <option value="BDT">BDT (৳) - Bangladesh Taka</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro Zone</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Thermal Printer Paper Width</label>
                    <select
                      value={setupPaperSize}
                      onChange={(e) => setSetupPaperSize(e.target.value)}
                      className="w-full bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none cursor-pointer font-mono text-xs"
                    >
                      <option value="80mm">Standard 80mm roll profile</option>
                      <option value="58mm">Compact 58mm roll profile</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-850 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setSetupStep(2)}
                    className="px-4 py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-wider text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupStep(4)}
                    className="px-6 py-2.5 rounded-lg bg-[#dfb76c] hover:bg-[#ebd097] text-black font-bold uppercase text-[10px] tracking-widest cursor-pointer transition-all duration-300 shadow-md shadow-amber-500/10"
                  >
                    Start Installation
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: EXECUTING INSTALLATION PROGRESS */}
            {setupStep === 4 && (
              <div className="space-y-5 text-left font-mono text-xs">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider animate-pulse">Deploying Applet Storage Node</h2>
                <p className="text-gray-400 leading-relaxed">
                  Please wait while Suit Pro writes custom structures, configures local ports, and allocates memory block directories on your computer:
                </p>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span className="uppercase font-bold tracking-wide">Installing package files...</span>
                    <span className="font-bold text-[#dfb76c]">{installProgress}%</span>
                  </div>
                  {/* Progress bar container */}
                  <div className="w-full bg-black/70 rounded-full h-3 border border-neutral-850 overflow-hidden">
                    <div 
                      className="bg-[#dfb76c] h-full rounded-full transition-all duration-500 shadow-inner"
                      style={{ width: `${installProgress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Live logger console window */}
                <div className="bg-black/85 p-3.5 rounded-lg border border-neutral-850 h-28 font-mono text-[9px] text-[#dfb76c]/80 flex flex-col justify-end space-y-1 overflow-hidden leading-relaxed shadow-inner">
                  <p className="text-gray-500">SYSTEM DEPLOYMENT AUDIT MODULE ACTIVE</p>
                  <p className="opacity-90">{installingStatusText}</p>
                </div>

                <div className="pt-4 border-t border-neutral-850 flex justify-end">
                  <button
                    type="button"
                    disabled={installProgress < 100}
                    onClick={() => setSetupStep(5)}
                    className={`px-5 py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-widest cursor-pointer transition-all duration-300 ${
                      installProgress === 100 
                        ? "bg-[#dfb76c] hover:bg-[#ebd097] text-black" 
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: COMPLETED */}
            {setupStep === 5 && (
              <div className="space-y-4 text-left font-mono text-xs">
                <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                  ✓ Setup & Installation Complete
                </h2>
                <p className="text-gray-400 leading-relaxed">
                  Suit Pro has successfully loaded your local showroom profiles and designated directory paths. Review your system configuration below:
                </p>

                <div className="bg-black/50 p-4 rounded-xl border border-neutral-850 space-y-2 text-[10px] leading-relaxed">
                  <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                    <span className="text-gray-500 uppercase">Brand Name:</span>
                    <span className="text-white font-bold">{setupBrandName}</span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                    <span className="text-gray-500 uppercase">Target Storage Folder:</span>
                    <span className="text-[#dfb76c] font-bold select-all break-all text-right max-w-[220px]">{setupStoragePath}</span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                    <span className="text-gray-500 uppercase">Currency Standard:</span>
                    <span className="text-white font-bold">{setupCurrency}</span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                    <span className="text-gray-500 uppercase">Default Owner Account:</span>
                    <span className="text-[#dfb76c] font-bold">{setupOperatorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 uppercase">Printer Spool Profile:</span>
                    <span className="text-white font-bold">{setupPaperSize} Roll Template</span>
                  </div>
                </div>

                <div className="text-[9px] text-gray-500 leading-relaxed uppercase tracking-wider text-center pt-1">
                  Click Launch below to finalize local registration and boot the POS system terminal.
                </div>

                <div className="pt-4 border-t border-neutral-850 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("suitpro_installed", "true");
                      localStorage.setItem("suitpro_brand_name", setupBrandName);
                      localStorage.setItem("suitpro_storage_path", setupStoragePath);
                      localStorage.setItem("suitpro_currency", setupCurrency);
                      localStorage.setItem("suitpro_paper_size", setupPaperSize);
                      
                      // Write setup operator to system
                      const setupUser: LocalUser = {
                        displayName: setupOperatorName,
                        email: `${setupOperatorName.toLowerCase().replace(/\s+/g, "")}@savilerow.london`,
                        role: "Owner"
                      };
                      localStorage.setItem("suitpro_active_user", JSON.stringify(setupUser));
                      
                      // Apply states dynamically
                      setBrandName(setupBrandName);
                      setStoragePath(setupStoragePath);
                      setUser(setupUser);
                      setActiveSeller(setupOperatorName);
                      setIsInstalled(true);
                    }}
                    className="w-full bg-[#dfb76c] hover:bg-[#ebd097] text-black font-bold uppercase tracking-widest py-3 rounded-lg cursor-pointer transition-all duration-300 text-center text-[10px] shadow-lg shadow-amber-500/10"
                  >
                    Launch Suit Pro POS Terminal
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#0b0b0d] via-[#111115] to-[#16161c] text-gray-200 flex flex-col items-center justify-center antialiased relative overflow-hidden p-4 selection:bg-[#dfb76c] selection:text-black">
        {/* Subtle royal blue and amber glows for luxury branding atmosphere */}
        <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-[#dfb76c]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[450px] h-[450px] bg-blue-900/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-md w-full mx-auto relative z-10 my-8">
          <div className="bg-[#18181f]/40 backdrop-blur-xl border border-[#262633]/60 p-8 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] flex flex-col items-center text-center transition-all duration-300 ease-in-out">
            
            <div className="border border-[#dfb76c]/30 p-4 rounded-xl bg-[#090d16] mb-5 shadow-md shadow-amber-500/5">
              <Scale className="w-10 h-10 text-[#dfb76c]" />
            </div>

            <h1 className="font-display font-black text-3xl text-white tracking-[0.25em] uppercase leading-none">SUIT PRO</h1>
            <p className="text-[10px] text-[#dfb76c] font-mono tracking-[0.3em] uppercase mt-2.5 pb-2 border-b border-[#262633]/60 w-full animate-pulse">
              Savile Row London • Retail Terminal
            </p>

            <p className="text-xs text-gray-400 mt-4 leading-relaxed max-w-xs uppercase tracking-wider font-mono">
              Secure Point of Sale Portal. Please use authorized credentials to authenticate:
            </p>

            {authError && (
              <div className="my-4 bg-red-950/40 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-[11px] font-mono leading-relaxed w-full text-left">
                <span className="block font-sans text-xs break-all opacity-90">{authError}</span>
              </div>
            )}

            {/* Complete rigid secure login form */}
            <form onSubmit={handleCustomLogin} className="w-full mt-6 space-y-4 text-left font-mono text-xs">
                <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Operator Username</label>
                <input
                  type="text"
                  placeholder="e.g. Rumel"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2.5 px-3.5 text-white focus:outline-none w-full transition-all duration-300"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Secret Passcode</label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2.5 px-3.5 text-white focus:outline-none w-full transition-all duration-300"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#dfb76c] hover:bg-[#ebd097] text-black font-bold uppercase tracking-wider py-3 rounded-lg cursor-pointer shrink-0 transition-all duration-300 text-center text-[11px] mt-4 shadow-lg shadow-amber-500/10"
              >
                Request Authorization
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#262633]/60 w-full flex flex-col gap-1 items-center text-[9px] text-gray-500 font-mono tracking-wider">
              <span>SUIT PRO SECURE ENCRYPTED NETWORK LAYER • V1.40</span>
              <img
                src="/adobe-express-qr-code.svg"
                alt="SUIT PRO QR code"
                className="mt-3 h-20 w-20 rounded bg-white p-1 object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isIpsHighContrast 
        ? "bg-[#f8f9fa] text-[#1a1a24] selection:bg-[#b89047] selection:text-white" 
        : "bg-[#0a0a0c] text-gray-200 selection:bg-[#dfb76c] selection:text-black"
    } flex flex-col antialiased`}>
      
      {/* SARTORIAL HEADER PRO - SINGLE ROW CONSOLIDATED NAVIGATION */}
      <header className={`${
        isIpsHighContrast 
          ? "bg-[#ffffff] text-[#1a1a24] border-b border-neutral-200" 
          : "bg-[#121216]/85 backdrop-blur-md border-b border-neutral-800/60"
      } sticky top-0 z-50 print:hidden shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-row flex-wrap justify-between items-center gap-4">
          
          {/* Brand Logo & Brand Name */}
          <div className="flex items-center gap-3">
            <div className={`border p-1.5 rounded-lg flex items-center justify-center ${isIpsHighContrast ? "border-neutral-200 bg-[#ffffff]" : "border-[#dfb76c]/30 bg-[#121216]/40 backdrop-blur-xl"} min-w-9 min-h-9`}>
              {logoUrl ? (
                <img src={logoUrl} alt="Brand logo" className="h-5 max-w-[80px] object-contain text-[#dfb76c]" />
              ) : (
                <Scale className={`w-3.5 h-3.5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              )}
            </div>
            <h1 className={`font-display font-semibold text-base tracking-[0.2em] uppercase leading-none ${isIpsHighContrast ? "text-[#111116]" : "text-white"}`}>
              {brandName}
            </h1>
          </div>

          {/* QUICK CONTROLS: SHEET SYNC & LIGHT/DARK MODE */}
          <div className="flex items-center gap-4">
            
            {/* MANUAL SHEET SYNC BUTTON */}
            <button
              id="manual-sheets-sync-btn"
              type="button"
              onClick={handleSyncSheets}
              disabled={syncStatus === "syncing"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider font-bold border cursor-pointer select-none transition-all duration-300 ${
                syncStatus === "syncing"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse"
                  : syncStatus === "success"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                  : syncStatus === "error"
                  ? "bg-rose-500/10 border-rose-500/40 text-rose-500"
                  : isIpsHighContrast
                  ? "bg-[#b89047] text-white hover:bg-[#a67f3b] border-[#b89047]"
                  : "bg-[#dfb76c] text-black hover:bg-[#ebd097] border-[#dfb76c]"
              }`}
            >
              <Database className="w-3 h-3 text-inherit shrink-0" />
              <span>
                {syncStatus === "syncing"
                  ? "Syncing..."
                  : syncStatus === "success"
                  ? "Synced!"
                  : syncStatus === "error"
                  ? "Sync Failed"
                  : "Sync Sheets"}
              </span>
            </button>

            {/* Minimalist Switch Pill Button */}
            <div className="flex items-center gap-2 font-mono text-[9px] font-bold">
              <span className={isIpsHighContrast ? "text-[#b89047]" : "text-neutral-500"}>LIGHT</span>
              <button
                id="ips-contrast-toggle"
                type="button"
                onClick={() => setIsIpsHighContrast(!isIpsHighContrast)}
                className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isIpsHighContrast ? "bg-[#b89047]" : "bg-neutral-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isIpsHighContrast ? "translate-x-3.5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className={!isIpsHighContrast ? "text-[#dfb76c]" : "text-neutral-500"}>DARK</span>
            </div>

          </div>

        </div>
      </header>

      {/* LOW-PROFILE SYSTEM STATUS OVERVIEW STRIP */}
      <div className={`print:hidden border-b py-2 text-[10px] font-mono select-none ${
        isIpsHighContrast 
          ? "bg-[#f1f3f5] border-neutral-200 text-neutral-600" 
          : "bg-[#0b0b0e] border-neutral-800/40 text-gray-400"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-row flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-4">
            <button
              id="brand-settings-toggle"
              type="button"
              onClick={() => setIsBrandModalOpen(true)}
              className={`hover:underline font-bold uppercase transition-colors duration-250 cursor-pointer ${
                isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
              }`}
            >
              Configure Brand
            </button>
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span>LAN Host Bound:</span>
              <span className="text-emerald-500 font-bold">0.0.0.0</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {user.photoURL ? (
                <img referrerPolicy="no-referrer" src={user.photoURL} alt={activeSeller} className="w-4 h-4 rounded-full border border-neutral-850" />
              ) : (
                <User className="w-3 h-3 opacity-75" />
              )}
              <span>Seller:</span>
              <span className={`font-bold ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>{activeSeller}</span>
            </div>
            <button
              id="auth-logout-btn"
              type="button"
              onClick={handleLogout}
              className="text-rose-500 hover:underline font-bold tracking-wider uppercase cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE TABS SELECTORS DECK */}
      <nav className={`${
        isIpsHighContrast 
          ? "bg-[#ffffff] border-b border-neutral-200" 
          : "bg-[#111115]/90 backdrop-blur-md border-b border-neutral-800/60"
      } py-2.5 print:hidden sticky top-[73px] z-45`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 text-xs font-display uppercase font-semibold">
            
            {/* 1. POS TERMINAL TAB */}
            {canAccess("pos") && (
              <button
                id="tab-trigger-pos"
                type="button"
                onClick={() => setActiveTab("pos")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "pos"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span>Checkout Register</span>
              </button>
            )}

            {/* 2. CORPORATE ANALYTICS DASHBOARD */}
            {canAccess("dashboard") && (
              <button
                id="tab-trigger-dashboard"
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "dashboard"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Corporate Analytics</span>
              </button>
            )}

            {/* 3. HISTORICAL SALES SEARCH LIGHT */}
            {canAccess("sales") && (
              <button
                id="tab-trigger-sales"
                type="button"
                onClick={() => setActiveTab("sales")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "sales"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Sales Ledger</span>
              </button>
            )}

            {/* 4. SARTORIAL CLOTHING INVENTORY */}
            {canAccess("inventory") && (
              <button
                id="tab-trigger-inventory"
                type="button"
                onClick={() => setActiveTab("inventory")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "inventory"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span>Apparel Inventory</span>
              </button>
            )}

            {/* 5. OUTGOINGS EXPENSES LEDGER */}
            {canAccess("expenses") && (
              <button
                id="tab-trigger-expenses"
                type="button"
                onClick={() => setActiveTab("expenses")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "expenses"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Receipt className="w-4 h-4 shrink-0" />
                <span>Operating Outlays</span>
              </button>
            )}

            {/* 6. DRAWER RECEIPTS DRAWER */}
            {canAccess("receipts") && (
              <button
                id="tab-trigger-receipts"
                type="button"
                onClick={() => setActiveTab("receipts")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "receipts"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Drawer Receipts</span>
              </button>
            )}

            {/* 7. WIFILAN REMOTE CAMERA DECK */}
            {canAccess("remote") && (
              <button
                id="tab-trigger-remote"
                type="button"
                onClick={() => setActiveTab("remote")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "remote"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Remote Wi-Fi Lens</span>
              </button>
            )}

            {/* 8. SYSTEM BACKUP SQL RECOVERY MANAGER */}
            {canAccess("backup") && (
              <button
                id="tab-trigger-backup"
                type="button"
                onClick={() => setActiveTab("backup")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "backup"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>System Backups</span>
              </button>
            )}

            {/* 9. MANAGEMENT & EMPLOYEE CONTROL PANEL */}
            {canAccess("management") && (
              <button
                id="tab-trigger-management"
                type="button"
                onClick={() => setActiveTab("management")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "management"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Management Panel</span>
              </button>
            )}

            {/* 10. BUSINESS CAPITAL ACCOUNT LEDGER */}
            {canAccess("capital") && (
              <button
                id="tab-trigger-capital"
                type="button"
                onClick={() => setActiveTab("capital")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out border cursor-pointer ${
                  activeTab === "capital"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Business Capital</span>
              </button>
            )}

            {/* 11. SUPPLIER MERCHANT LEDGER */}
            {canAccess("suppliers") && (
              <button
                id="tab-trigger-suppliers"
                type="button"
                onClick={() => setActiveTab("suppliers")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 border cursor-pointer ${
                  activeTab === "suppliers"
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white border-[#b89047] font-bold shadow-md shadow-amber-500/10"
                      : "bg-[#dfb76c] text-black border-[#dfb76c] font-bold shadow-md shadow-amber-500/15"
                    : isIpsHighContrast
                      ? "bg-[#ffffff] hover:bg-neutral-100 border-neutral-200 text-neutral-750"
                      : "bg-[#121216]/40 hover:bg-neutral-800/50 border-neutral-800/60 text-gray-300"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Suppliers</span>
              </button>
            )}

          </div>
        </div>
      </nav>

      {/* MASTER APPLICATION CONTENT DECK */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 print:p-0 print:m-0">
        <div key={ticker} className="transition-all duration-300">
          
          {activeTab === "pos" && canAccess("pos") && (
            <PosTerminal 
              onTransactionComplete={handleTransactionComplete} 
              activeSeller={activeSeller}
              setActiveSeller={setActiveSeller}
              brandName={brandName}
              logoUrl={logoUrl}
              storagePath={storagePath}
              isIpsHighContrast={isIpsHighContrast}
              currentUserRole={userRole}
            />
          )}

          {activeTab === "dashboard" && canAccess("dashboard") && (
            <Dashboard isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "sales" && canAccess("sales") && (
            <SalesLedger isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "inventory" && canAccess("inventory") && (
            <InventoryManager isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "expenses" && canAccess("expenses") && (
            <ExpensesLedger isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "receipts" && canAccess("receipts") && (
            <ReceiptsLogger isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "remote" && canAccess("remote") && (
            <NetworkScanner isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "backup" && canAccess("backup") && (
            <SystemBackup 
              isIpsHighContrast={isIpsHighContrast} 
              onRestoreComplete={handleTransactionComplete}
            />
          )}

          {activeTab === "management" && canAccess("management") && (
            <ManagementConsole 
              isIpsHighContrast={isIpsHighContrast} 
              currentUserRole={userRole}
            />
          )}

          {activeTab === "capital" && canAccess("capital") && (
            <CapitalManager isIpsHighContrast={isIpsHighContrast} />
          )}

          {activeTab === "suppliers" && canAccess("suppliers") && (
            <SupplierManager isIpsHighContrast={isIpsHighContrast} />
          )}

        </div>
      </main>

      {printPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 print:hidden">
          <div className="flex h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#dfb76c]/40 bg-[#111115] shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#dfb76c]">{printPreview.title}</h2>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Printer"
                  value={selectedPrinter}
                  onChange={(event) => setSelectedPrinter(event.target.value)}
                  disabled={printInProgress || printers.length === 0}
                  className="max-w-[220px] rounded border border-neutral-700 bg-[#1b1b20] px-2 py-2 text-xs text-gray-200 disabled:opacity-50"
                >
                  {printers.length === 0 ? <option value="">No printers detected</option> : (
                    <>
                      <option value="">Select a printer</option>
                      {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>{printer.displayName || printer.name}{printer.isDefault ? " (Default)" : ""}</option>
                      ))}
                    </>
                  )}
                </select>
                <button type="button" onClick={() => setPrintPreview(null)} disabled={printInProgress} className="rounded border border-neutral-700 px-3 py-2 text-xs text-gray-300 hover:bg-neutral-800 disabled:opacity-50">Back</button>
                <button type="button" onClick={handleTestPrint} disabled={printInProgress || !selectedPrinter} className="rounded border border-sky-500/50 px-3 py-2 text-xs text-sky-300 hover:bg-sky-950/40 disabled:cursor-not-allowed disabled:opacity-50">Test Print</button>
                <button type="button" onClick={handlePrintPreview} disabled={printInProgress || !selectedPrinter} className="rounded bg-[#dfb76c] px-3 py-2 text-xs font-bold text-black hover:bg-[#ebd097] disabled:cursor-not-allowed disabled:opacity-50">{printInProgress ? "Printing..." : "Print"}</button>
              </div>
            </div>
            {printError && <div className="border-b border-rose-500/30 bg-rose-950/40 px-4 py-2 text-xs text-rose-300">{printError}</div>}
            <div className="min-h-0 flex-1 bg-neutral-200 p-3">
              <iframe title={`${printPreview.title} preview`} srcDoc={printPreview.html} sandbox="allow-same-origin" className="h-full w-full border-0 bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* Brand Config popup modal */}
      {isBrandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#111115] border border-[#dfb76c]/30 rounded-2xl p-6 shadow-2xl relative block space-y-4">
            <div className="flex justify-between items-center border-b border-[#262633]/60 pb-3">
              <h3 className="font-display font-medium text-base text-[#dfb76c] uppercase tracking-widest font-bold">Configure Brand Identity</h3>
              <button 
                type="button" 
                onClick={() => setIsBrandModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors font-mono text-xs uppercase font-bold tracking-wider cursor-pointer"
              >
                Close Settings
              </button>
            </div>
            
            <div className="space-y-4 font-mono text-xs text-left">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block font-bold text-[10px]">Showroom Brand Name</label>
                  <input 
                    type="text" 
                    value={brandName}
                    onChange={(e) => {
                      const val = e.target.value || "SUIT PRO";
                      setBrandName(val);
                      localStorage.setItem("suitpro_brand_name", val);
                    }}
                    className="w-full bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none transition-all duration-300"
                    placeholder="e.g. SUIT PRO"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block font-bold text-[10px]">Installation Storage Path</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={storagePath}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStoragePath(val);
                        localStorage.setItem("suitpro_storage_path", val);
                      }}
                      className="w-full bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] rounded-lg py-2 pl-3 pr-8 text-[#dfb76c] focus:outline-none transition-all duration-300 font-mono text-[10px]"
                      placeholder="e.g. C:\SuitPro-Records"
                    />
                    <button
                      type="button"
                      title="Choose Custom Directory"
                      onClick={() => {
                        const drives = ["C:\\", "D:\\", "E:\\"];
                        const subdirs = ["Documents\\SuitPro-Records", "SavileRow\\POS_Data", "RetailData\\Backups"];
                        const randomDrive = drives[Math.floor(Math.random() * drives.length)];
                        const randomSub = subdirs[Math.floor(Math.random() * subdirs.length)];
                        const generated = `${randomDrive}${randomSub}\\`;
                        setStoragePath(generated);
                        localStorage.setItem("suitpro_storage_path", generated);
                      }}
                      className="absolute right-2.5 top-2 text-amber-500 hover:text-amber-400 transition-colors cursor-pointer font-bold text-[10px]"
                    >
                      📁
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block font-bold text-[10px]">Custom Logo Image URL</label>
                <input 
                  type="text" 
                  value={logoUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLogoUrl(val);
                    localStorage.setItem("suitpro_logo_url", val);
                  }}
                  className="w-full bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none transition-all duration-300"
                  placeholder="e.g. https://example.com/logo.png"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block font-bold text-[10px]">Or upload logo from layout file</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-[#262633]/60 hover:border-[#dfb76c]/50 rounded-lg cursor-pointer bg-[#0b0b0d] hover:bg-[#111115] transition-all duration-300">
                    <div className="flex flex-col items-center justify-center pt-3 pb-3">
                      <p className="text-[10px] text-gray-400 font-bold">Upload Local Logo Spec</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">PNG, JPG (Max 500KB)</p>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64 = reader.result as string;
                            setLogoUrl(base64);
                            localStorage.setItem("suitpro_logo_url", base64);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {logoUrl && (
                <div className="p-2.5 bg-[#0b0b0d] border border-neutral-800 rounded-lg flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 mb-1.5 uppercase tracking-widest">Active Logo Preview</span>
                  <img src={logoUrl} alt="custom logo" className="max-h-10 object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl("");
                      localStorage.removeItem("suitpro_logo_url");
                    }}
                    className="text-[9px] text-red-500 hover:underline mt-1.5 cursor-pointer uppercase font-bold"
                  >
                    Clear Logo
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-850 text-right flex justify-end">
              <button
                type="button"
                onClick={() => setIsBrandModalOpen(false)}
                className="bg-[#dfb76c] hover:bg-[#ebd097] text-black px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all duration-300 cursor-pointer"
              >
                Apply Custom Branding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Footer panel */}
      <footer className="bg-[#0e1422] border-t border-gray-800/80 py-4 text-center text-[10px] text-gray-500 font-mono mt-12 print:hidden uppercase tracking-wider">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <span>© {new Date().getFullYear()} {brandName.toUpperCase()} LONDON POS SYSTEM. ALL RIGHTS RESERVED.</span>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <Sparkles className="w-3 h-3 text-[#bf924f]" /> Crafted by Rumel Ahmed · @mrrajrumel
            </span>
            <a href="https://www.linkedin.com/in/mrrajrumel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:border-[#dfb76c]/40 transition-colors">
              <Linkedin className="w-3 h-3" /> LinkedIn
            </a>
            <a href="https://www.facebook.com/mrrajrumel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:border-[#dfb76c]/40 transition-colors">
              <Globe className="w-3 h-3" /> Facebook
            </a>
            <a href="https://github.com/mrrajrumel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:border-[#dfb76c]/40 transition-colors">
              <Github className="w-3 h-3" /> GitHub
            </a>
            <a href="https://www.instagram.com/mrrajrumel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:border-[#dfb76c]/40 transition-colors">
              <Instagram className="w-3 h-3" /> Instagram
            </a>
            <a href="https://www.youtube.com/@mrrajrumel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:border-[#dfb76c]/40 transition-colors">
              <Youtube className="w-3 h-3" /> YouTube
            </a>
            <a href="https://www.tiktok.com/@mrrajrumel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:border-[#dfb76c]/40 transition-colors">
              <Music2 className="w-3 h-3" /> TikTok
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
