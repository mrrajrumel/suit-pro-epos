import React, { useState, useEffect } from "react";
import { seedDatabaseIfEmpty } from "./lib/db-helpers.ts";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
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
  ShieldAlert
} from "lucide-react";

interface LocalUser {
  displayName: string;
  email: string;
  photoURL?: string;
  role?: "Owner" | "Manager" | "Cashier";
}

import ManagementConsole from "./components/ManagementConsole.tsx";

type ActiveTab = "pos" | "dashboard" | "sales" | "inventory" | "expenses" | "receipts" | "remote" | "backup" | "management";

export default function App() {
  const [user, setUser] = useState<LocalUser | null>(null);
  
  const userRole = user?.role || "Cashier";

  const canAccess = (tab: ActiveTab): boolean => {
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
  const [activeSeller, setActiveSeller] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isIpsHighContrast, setIsIpsHighContrast] = useState(false);
  
  // Custom brand settings states
  const [brandName, setBrandName] = useState(() => localStorage.getItem("suitpro_brand_name") || "SUIT PRO");
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("suitpro_logo_url") || "");
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("suitpro_server_url") || "https://epos.suitprolondon.com");
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // Sheet sync operational states
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

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
    
    // Assure database is seeded
    seedDatabaseIfEmpty().finally(() => {
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
      if (loginUsername.trim() === "Rumel" && loginPassword.trim() === "123456") {
        const tailor: LocalUser = {
          displayName: "Rumel Ahmed",
          email: "rumel@savilerow.london",
          role: "Owner"
        };
        setUser(tailor);
        setActiveSeller("Rumel Ahmed");
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#0b0b0d] via-[#111115] to-[#16161c] text-gray-200 flex flex-col items-center justify-center antialiased relative overflow-hidden p-4 selection:bg-[#dfb76c] selection:text-black">
        {/* Subtle royal blue and amber glows for luxury branding atmosphere */}
        <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-[#dfb76c]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[450px] h-[450px] bg-blue-900/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-md w-full mx-auto relative z-10 my-8">
          <div className="bg-[#18181f]/40 backdrop-blur-xl border border-[#262633]/60 p-8 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] flex flex-col items-center text-center transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)">
            
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
              <div className="space-y-1.5Col">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Operator Username</label>
                <input
                  type="text"
                  placeholder="e.g. Rumel"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2.5 px-3.5 text-white focus:outline-none w-full transition-all duration-300"
                />
              </div>

              <div className="space-y-1.5Col pt-1">
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
              <span className="text-[8px] text-[#dfb76c] opacity-80 mt-1">SYSTEM OWNER onboarding default credentials enabled</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) border cursor-pointer ${
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
              isIpsHighContrast={isIpsHighContrast}
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

        </div>
      </main>

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
              <div className="space-y-1.5 col-span-2">
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

              {/* EPOS Server Connection Address Configuration */}
              <div className="space-y-1.5 border-t border-neutral-850 pt-3">
                <label className="text-gray-400 uppercase tracking-wider block font-bold text-[10px]">EPOS Server API Endpoint</label>
                <select
                  value={
                    serverUrl === "https://epos.suitprolondon.com" 
                      ? "cloud" 
                      : serverUrl === "http://localhost:3000" 
                      ? "local" 
                      : "custom"
                  }
                  onChange={(e) => {
                    const opt = e.target.value;
                    if (opt === "cloud") {
                      setServerUrl("https://epos.suitprolondon.com");
                      localStorage.setItem("suitpro_server_url", "https://epos.suitprolondon.com");
                    } else if (opt === "local") {
                      setServerUrl("http://localhost:3000");
                      localStorage.setItem("suitpro_server_url", "http://localhost:3000");
                    } else {
                      setServerUrl("");
                    }
                  }}
                  className="w-full bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none transition-all duration-300 mb-2 cursor-pointer"
                >
                  <option value="cloud">Production Cloud (https://epos.suitprolondon.com)</option>
                  <option value="local">Local PC Server (http://localhost:3000)</option>
                  <option value="custom">Custom Server Address...</option>
                </select>

                {(serverUrl !== "https://epos.suitprolondon.com" && serverUrl !== "http://localhost:3000") && (
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setServerUrl(val);
                      localStorage.setItem("suitpro_server_url", val);
                    }}
                    placeholder="e.g. http://192.168.1.100:3000"
                    className="w-full bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] rounded-lg py-2 px-3 text-[#dfb76c] focus:outline-none transition-all duration-300"
                  />
                )}
                <p className="text-[9px] text-gray-500 uppercase mt-1 leading-normal">Configures where the Web app and PC/Electron terminal resolve data queries.</p>
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
      {/* Luxury Footer panel */}
      <footer className="bg-[#0e1422] border-t border-gray-800/80 py-4 text-center text-[10px] text-gray-500 font-mono mt-12 print:hidden uppercase tracking-wider">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <span>© {new Date().getFullYear()} {brandName.toUpperCase()} LONDON POS SYSTEM. ALL RIGHTS RESERVED.</span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#bf924f]" /> Secured with Offline-First Local Storage Ledger
          </span>
        </div>
      </footer>

    </div>
    </ErrorBoundary>
  );
}
