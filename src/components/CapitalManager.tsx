import { requestPrintPreview } from "../lib/print-preview.ts";
import React, { useState, useEffect } from "react";
import { CapitalSource, CapitalTransaction } from "../types.ts";
import { Plus, Minus, ArrowLeftRight, TrendingUp, DollarSign, Printer, Download, Trash2, Edit2 } from "lucide-react";

interface CapitalManagerProps {
  isIpsHighContrast?: boolean;
}

const INITIAL_SOURCES: CapitalSource[] = [
  { id: "cs-cash", name: "Cash Capital", type: "Cash", balance: 5000 },
  { id: "cs-natwest", name: "NatWest Business Account", type: "Bank", balance: 18500, accountNumber: "•••• 4829" },
  { id: "cs-revolut", name: "Revolut Pro Account", type: "Bank", balance: 7400, accountNumber: "•••• 9102" },
  { id: "cs-petty", name: "Petty Cash Drawer", type: "Cash", balance: 650 },
  { id: "cs-loan", name: "NatWest Business Loan", type: "Loan", balance: -25000, accountNumber: "•••• 1133" },
  { id: "cs-investor", name: "Angel Investor Capital", type: "Investor", balance: 50000 }
];

  const safeReadJson = <T,>(key: string, fallback: T): T => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  };

  const safeWriteJson = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Capital ledger write failed for ${key}. Keeping memory data only.`, error);
      try {
        localStorage.setItem(`${key}_backup`, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  };

  export default function CapitalManager({ isIpsHighContrast = false }: CapitalManagerProps) {
  const [sources, setSources] = useState<CapitalSource[]>(() => {
    return safeReadJson<CapitalSource[]>("suitpro_capital_sources", INITIAL_SOURCES);
  });

  const [transactions, setTransactions] = useState<CapitalTransaction[]>(() => {
    const stored = safeReadJson<CapitalTransaction[] | null>("suitpro_capital_tx", null);
    if (stored) return stored;
    return [
      {
        id: "tx-seed-1",
        sourceId: "cs-natwest",
        type: "add",
        amount: 18500,
        reference: "Initial Business Capital Injection",
        date: "2026-06-01",
        timestamp: new Date().toISOString()
      },
      {
        id: "tx-seed-2",
        sourceId: "cs-cash",
        type: "add",
        amount: 5000,
        reference: "Owner Cash Investment",
        date: "2026-06-02",
        timestamp: new Date().toISOString()
      }
    ];
  });

  useEffect(() => {
    safeWriteJson("suitpro_capital_sources", sources);
  }, [sources]);

  useEffect(() => {
    safeWriteJson("suitpro_capital_tx", transactions);
  }, [transactions]);

  // Modal / Form state
  const [actionType, setActionType] = useState<"add" | "withdraw" | "transfer" | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [targetSourceId, setTargetSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Add/Edit capital accounts
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"Cash" | "Bank" | "Loan" | "Investor" | "Custom">("Bank");
  const [accountBalance, setAccountBalance] = useState("");
  const [accountNum, setAccountNum] = useState("");

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    const newAcc: CapitalSource = {
      id: `cs-custom-${Date.now()}`,
      name: accountName,
      type: accountType,
      balance: parseFloat(accountBalance) || 0,
      accountNumber: accountNum ? `•••• ${accountNum.slice(-4)}` : undefined
    };

    setSources(prev => [...prev, newAcc]);

    // Also add an audit transaction if starting balance is non-zero
    if (newAcc.balance !== 0) {
      const newTx: CapitalTransaction = {
        id: `tx-init-${Date.now()}`,
        sourceId: newAcc.id,
        type: newAcc.balance > 0 ? "add" : "withdraw",
        amount: Math.abs(newAcc.balance),
        reference: `Opening Balance: ${accountName}`,
        date: new Date().toISOString().split("T")[0],
        timestamp: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
    }

    // Reset Form
    setAccountName("");
    setAccountType("Bank");
    setAccountBalance("");
    setAccountNum("");
    setIsAccountModalOpen(false);
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm("Are you sure you want to delete this capital account and archive its transactions?")) {
      setSources(prev => prev.filter(s => s.id !== id));
      setTransactions(prev => prev.filter(t => t.sourceId !== id && t.targetSourceId !== id));
    }
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !selectedSourceId) return;

    if (actionType === "add") {
      setSources(prev => prev.map(s => s.id === selectedSourceId ? { ...s, balance: s.balance + amt } : s));
      const newTx: CapitalTransaction = {
        id: `tx-${Date.now()}`,
        sourceId: selectedSourceId,
        type: "add",
        amount: amt,
        reference: reference || "Capital Addition",
        date,
        timestamp: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
    } else if (actionType === "withdraw") {
      setSources(prev => prev.map(s => s.id === selectedSourceId ? { ...s, balance: s.balance - amt } : s));
      const newTx: CapitalTransaction = {
        id: `tx-${Date.now()}`,
        sourceId: selectedSourceId,
        type: "withdraw",
        amount: amt,
        reference: reference || "Capital Withdrawal",
        date,
        timestamp: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
    } else if (actionType === "transfer") {
      if (!targetSourceId || selectedSourceId === targetSourceId) return;
      setSources(prev => prev.map(s => {
        if (s.id === selectedSourceId) return { ...s, balance: s.balance - amt };
        if (s.id === targetSourceId) return { ...s, balance: s.balance + amt };
        return s;
      }));
      const newTx: CapitalTransaction = {
        id: `tx-${Date.now()}`,
        sourceId: selectedSourceId,
        targetSourceId,
        type: "transfer",
        amount: amt,
        reference: reference || "Internal Capital Transfer",
        date,
        timestamp: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
    }

    // Reset State
    setAmount("");
    setReference("");
    setActionType(null);
  };

  const exportStatementCSV = () => {
    const headers = "ID,Date,Source,Action,Target,Amount,Reference\n";
    const rows = transactions.map(t => {
      const srcName = sources.find(s => s.id === t.sourceId)?.name || "Unknown";
      const targetName = t.targetSourceId ? (sources.find(s => s.id === t.targetSourceId)?.name || "Unknown") : "N/A";
      return `${t.id},${t.date},"${srcName}",${t.type},"${targetName}",${t.amount},"${t.reference}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Capital_Finance_Statement_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportStatementExcel = () => {
    exportStatementCSV(); // standard elegant fallback for plain spreadsheet analysis
  };

  const triggerPrint = () => {
    requestPrintPreview({ title: "Capital Finance Statement", html: document.documentElement.outerHTML, paperSize: "A4" });
  };

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case "Bank": return "🏛️";
      case "Cash": return "💵";
      case "Loan": return "📈";
      case "Investor": return "🤝";
      default: return "💰";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* HEADER STATEMENT DECK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-neutral-800/60 print:hidden">
        <div>
          <h2 className={`font-display text-xl font-bold uppercase tracking-wider ${
            isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
          }`}>Business Capital & Accounts Ledger</h2>
          <p className="text-xs text-gray-400 mt-1">Manage Cash reserves, Revolut, NatWest accounts, business loans, investor funding pools, and transfer logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAccountModalOpen(true)}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              isIpsHighContrast 
                ? "bg-white border-neutral-300 hover:bg-neutral-100 text-neutral-800" 
                : "bg-slate-950 border-[#dfb76c]/30 hover:border-[#dfb76c] text-[#dfb76c]"
            }`}
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
          <button
            type="button"
            onClick={triggerPrint}
            className="p-2 bg-[#121216]/40 border border-neutral-850 text-gray-300 rounded-lg hover:text-white cursor-pointer"
            title="Print statement"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={exportStatementCSV}
            className="p-2 bg-[#121216]/40 border border-neutral-850 text-gray-300 rounded-lg hover:text-white cursor-pointer"
            title="Export CSV Statement"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 border rounded-xl flex items-center justify-between ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/50 border-neutral-850"
        }`}>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-widest block">Liquid Capital Reserves</span>
            <span className={`text-xl font-mono font-bold ${
              isIpsHighContrast ? "text-neutral-900" : "text-white"
            }`}>£{sources.filter(s => s.type !== "Loan").reduce((acc, s) => acc + s.balance, 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 border rounded-xl flex items-center justify-between ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/50 border-neutral-850"
        }`}>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-widest block">NatWest + Revolut Bank Total</span>
            <span className={`text-xl font-mono font-bold ${
              isIpsHighContrast ? "text-neutral-900" : "text-white"
            }`}>£{sources.filter(s => s.type === "Bank" && s.balance > 0).reduce((acc, s) => acc + s.balance, 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            🏛️
          </div>
        </div>

        <div className={`p-4 border rounded-xl flex items-center justify-between ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/50 border-neutral-850"
        }`}>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-widest block">Petty & Drawer Cash</span>
            <span className={`text-xl font-mono font-bold ${
              isIpsHighContrast ? "text-neutral-900" : "text-white"
            }`}>£{sources.filter(s => s.type === "Cash").reduce((acc, s) => acc + s.balance, 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2 bg-amber-500/10 text-[#dfb76c] rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 border rounded-xl flex items-center justify-between ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/50 border-neutral-850"
        }`}>
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-widest block">Outstanding Loan Debt</span>
            <span className={`text-xl font-mono font-bold text-rose-500`}>£{sources.filter(s => s.type === "Loan").reduce((acc, s) => acc + s.balance, 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
            📈
          </div>
        </div>
      </div>

      {/* CORE LAYOUT: SOURCES LIST + FORM TRADING DECK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT TWO-THIRDS: ACCOUNTS GRID LIST */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className={`text-xs font-bold uppercase tracking-widest ${
            isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
          }`}>Active Capital Sources</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sources.map(s => (
              <div 
                key={s.id}
                className={`p-4 border rounded-xl flex flex-col justify-between space-y-4 ${
                  isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/40 border-[#262633]/60 hover:border-neutral-800"
                } transition-all`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{getSourceTypeIcon(s.type)}</span>
                      <h4 className={`text-sm font-bold truncate ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{s.name}</h4>
                    </div>
                    {s.accountNumber && (
                      <span className="text-[10px] text-gray-500 block mt-0.5 font-mono">{s.accountNumber}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(s.id)}
                    className="text-gray-500 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex justify-between items-baseline pt-2">
                  <span className="text-[10px] uppercase font-mono text-gray-500">Available Balance</span>
                  <span className={`text-lg font-mono font-bold ${
                    s.balance < 0 ? "text-rose-500" : isIpsHighContrast ? "text-neutral-900" : "text-emerald-400"
                  }`}>
                    £{s.balance.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Quick actions direct inside account */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-neutral-800/40">
                  <button
                    type="button"
                    onClick={() => { setActionType("add"); setSelectedSourceId(s.id); }}
                    className="py-1 text-[9px] uppercase font-bold tracking-wider rounded border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" /> Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActionType("withdraw"); setSelectedSourceId(s.id); }}
                    className="py-1 text-[9px] uppercase font-bold tracking-wider rounded border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Minus className="w-2.5 h-2.5" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActionType("transfer"); setSelectedSourceId(s.id); }}
                    className="py-1 text-[9px] uppercase font-bold tracking-wider rounded border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ArrowLeftRight className="w-2.5 h-2.5" /> X-fer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION PANEL */}
        <div className={`p-5 border rounded-2xl h-fit space-y-4 ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#181822]/35 border-[#262633]/60"
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${
            isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
          }`}>
            {actionType === "add" && "Deposit Capital Injection"}
            {actionType === "withdraw" && "Withdraw Capital Funds"}
            {actionType === "transfer" && "Capital Transfer Scheme"}
            {!actionType && "Select Reserve Action"}
          </h3>

          {!actionType ? (
            <div className="text-center p-6 space-y-3">
              <span className="text-2xl block">📈</span>
              <p className="text-xs text-gray-400">Select deposit, withdrawal or internal transfer actions to balance the company books.</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setActionType("add"); if (sources.length > 0) setSelectedSourceId(sources[0].id); }}
                  className="py-2 text-[10px] uppercase font-mono font-bold rounded-lg border border-emerald-500/20 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer"
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => { setActionType("withdraw"); if (sources.length > 0) setSelectedSourceId(sources[0].id); }}
                  className="py-2 text-[10px] uppercase font-mono font-bold rounded-lg border border-rose-500/20 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 cursor-pointer"
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  onClick={() => { setActionType("transfer"); if (sources.length > 1) { setSelectedSourceId(sources[0].id); setTargetSourceId(sources[1].id); } }}
                  className="py-2 text-[10px] uppercase font-mono font-bold rounded-lg border border-blue-500/20 text-blue-500 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer"
                >
                  Transfer
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTransaction} className="space-y-3.5 text-xs">
              <div>
                <label className="text-gray-400 uppercase tracking-widest text-[9px] block mb-1">Source Capital Account</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c] ${
                    isIpsHighContrast ? "bg-white text-[#111116] border-neutral-250" : "bg-[#0c0d12] text-[#dfb76c] border-neutral-850"
                  }`}
                >
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (£{s.balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {actionType === "transfer" && (
                <div>
                  <label className="text-gray-400 uppercase tracking-widest text-[9px] block mb-1">Target Account</label>
                  <select
                    value={targetSourceId}
                    onChange={(e) => setTargetSourceId(e.target.value)}
                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c] ${
                      isIpsHighContrast ? "bg-white text-[#111116] border-neutral-250" : "bg-[#0c0d12] text-[#dfb76c] border-neutral-850"
                    }`}
                  >
                    {sources.map(s => (
                      <option key={s.id} value={s.id} disabled={s.id === selectedSourceId}>{s.name} (£{s.balance.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-gray-400 uppercase tracking-widest text-[9px] block mb-1">Amount (£)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c] font-mono ${
                    isIpsHighContrast ? "bg-white text-[#111116] border-neutral-250" : "bg-[#0c0d12] text-white border-neutral-850"
                  }`}
                  placeholder="£0.00"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-widest text-[9px] block mb-1">Audit Reference / Purpose</label>
                <input
                  type="text"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c] ${
                    isIpsHighContrast ? "bg-white text-[#111116] border-neutral-250" : "bg-[#0c0d12] text-white border-neutral-850"
                  }`}
                  placeholder="e.g. Card Settlement, Shareholder Loan..."
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-widest text-[9px] block mb-1">Valuation Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c] font-mono ${
                    isIpsHighContrast ? "bg-white text-[#111116] border-neutral-250" : "bg-[#0c0d12] text-white border-neutral-850"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="py-2 border border-neutral-850 text-gray-400 rounded-lg font-bold uppercase hover:bg-neutral-800/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`py-2 text-black font-bold uppercase rounded-lg cursor-pointer ${
                    isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c]"
                  }`}
                >
                  Post Ledger
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* RECENT TRANSACTION LOGS */}
      <div className={`p-4 border rounded-2xl space-y-4 ${
        isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/30 border-[#262633]/60"
      }`}>
        <div className="flex justify-between items-center pb-2 border-b border-neutral-800/40">
          <h3 className={`text-xs font-bold uppercase tracking-widest ${
            isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
          }`}>Capital Transaction statement Ledger</h3>
          <span className="text-[10px] font-mono text-gray-500">{transactions.length} record(s) indexed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-400">
            <thead className={`text-[10px] uppercase tracking-wider font-mono ${
              isIpsHighContrast ? "bg-neutral-50 text-neutral-600" : "bg-[#111115] text-[#dfb76c]"
            }`}>
              <tr>
                <th className="px-4 py-3 font-semibold">TX ID</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Account Pool</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Destination Account</th>
                <th className="px-4 py-3 font-semibold">Audit Reference</th>
                <th className="px-4 py-3 font-semibold text-right">Credit / Debit Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/40 font-mono">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No transactions recorded on this capital ledger.
                  </td>
                </tr>
              ) : (
                transactions.map(t => {
                  const srcAcc = sources.find(s => s.id === t.sourceId);
                  const destAcc = t.targetSourceId ? sources.find(s => s.id === t.targetSourceId) : null;
                  return (
                    <tr key={t.id} className="hover:bg-neutral-850/15 transition-colors">
                      <td className="px-4 py-3 text-[10px] text-gray-500">{t.id}</td>
                      <td className="px-4 py-3">{t.date}</td>
                      <td className={`px-4 py-3 font-sans font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{srcAcc?.name || "Deleted Reserve"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                          t.type === "add" ? "bg-emerald-500/10 text-emerald-500" :
                          t.type === "withdraw" ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">{destAcc ? destAcc.name : "-"}</td>
                      <td className="px-4 py-3 font-sans max-w-xs truncate" title={t.reference}>{t.reference}</td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        t.type === "add" ? "text-emerald-500" : t.type === "withdraw" ? "text-rose-500" : "text-blue-400"
                      }`}>
                        {t.type === "withdraw" ? "-" : "+"}£{t.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW ACCOUNT MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111115] border border-[#dfb76c]/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-[#dfb76c] uppercase tracking-widest pb-3 border-b border-neutral-850">Add Custom Capital Account</h3>
            
            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c]"
                  placeholder="e.g. NatWest Savings Account"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Reserve Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full p-2.5 bg-[#0c0d12] text-[#dfb76c] border border-neutral-850 rounded-lg focus:outline-none"
                  >
                    <option value="Bank">Bank Account</option>
                    <option value="Cash">Cash / Drawer</option>
                    <option value="Loan">Loan / Liability</option>
                    <option value="Investor">Investor Pool</option>
                    <option value="Custom">Custom Source</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Account Number (Optional)</label>
                  <input
                    type="text"
                    value={accountNum}
                    onChange={(e) => setAccountNum(e.target.value)}
                    className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg focus:outline-none"
                    placeholder="e.g. 12345678"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Starting Balance Pool (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg focus:outline-none font-mono"
                  placeholder="£0.00"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="w-1/2 py-2 border border-neutral-850 text-gray-400 rounded-lg uppercase hover:bg-neutral-800/10 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-[#dfb76c] text-black rounded-lg uppercase cursor-pointer font-bold hover:opacity-90"
                >
                  Create Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
