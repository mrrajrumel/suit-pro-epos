import React, { useState, useEffect } from "react";
import { Expense } from "../types.ts";
import { getExpenses, addExpense, addSystemLog } from "../lib/db-helpers.ts";
import { PlusCircle, Receipt, Download, RefreshCw, Landmark, AlertTriangle } from "lucide-react";

export default function ExpensesLedger({ isIpsHighContrast = false }: { isIpsHighContrast?: boolean }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState<Expense["category"]>("Utilities");
  const [amount, setAmount] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setIsLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data || []);
    } catch (err: any) {
      setErrorNotice("Failed to query outlays ledger: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setNotice(null);

    if (!category || amount === "" || !reference.trim() || !date) {
      setErrorNotice("Please fill out all required fields to record standard outlays.");
      return;
    }

    const expId = `EXP-${Date.now().toString().slice(-6)}`;
    const payload: Expense = {
      id: expId,
      category,
      amount: Number(amount),
      reference: reference.trim(),
      date,
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Save to Cloud Firestore
      await addExpense(payload);

      // 2. Add System Logs on firestore
      await addSystemLog({
        type: payload.amount > 1000 ? "warning" : "info",
        message: `Registered Operating Expense: Category [${category}], Amount £${payload.amount}. Ref ${reference}.`,
        timestamp: new Date().toISOString()
      });

      // 3. Post to local server for file synchronization
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const dataResult = await res.json();
      if (!res.ok) throw new Error(dataResult.error || "Server upload failure");

      // Clear form
      setAmount("");
      setReference("");
      
      setNotice(`Expense successfully recorded in spreadsheets under ID ${expId}.`);
      loadExpenses();
      setTimeout(() => setNotice(null), 3500);

    } catch (err: any) {
      setErrorNotice("Database failed to persist outlays: " + err.message);
    }
  };

  const getExpensesTotal = () => expenses.reduce((s, e) => s + e.amount, 0);

  // Group by categories
  const categoriesSum = () => {
    const sums: { [key: string]: number } = {};
    expenses.forEach(e => {
      sums[e.category] = (sums[e.category] || 0) + e.amount;
    });
    return sums;
  };

  const catSums = categoriesSum();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT: Registries Ledger Form & Total Monitors */}
      <div className="space-y-6">
        
        {/* TOTAL VALUE OUTFLOW MONITOR */}
        <div className={`border rounded-xl p-5 shadow-lg relative overflow-hidden transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <div className={`absolute top-0 right-0 p-3 ${isIpsHighContrast ? "text-red-500/10" : "text-red-500/15"}`}>
            <Landmark className="w-16 h-16 stroke-1 text-[#dfb76c]" />
          </div>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Aggregate operating costs</span>
          <div className={`text-3xl font-mono font-bold mt-1.5 ${isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"}`}>£{getExpensesTotal().toFixed(2)}</div>
          <p className="text-[10px] text-gray-500 font-mono mt-2">{expenses.length} distinct bills cataloged in Excel ledger.</p>
        </div>

        {/* LOG OUTLAY ACCRUED */}
        <div className={`border rounded-xl p-5 shadow-lg space-y-4 transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <h3 className={`font-display font-semibold text-sm uppercase tracking-widest border-b pb-2 flex items-center gap-2 ${
            isIpsHighContrast ? "text-neutral-900 border-neutral-200" : "text-[#dfb76c] border-[#262633]/60"
          }`}>
            <Receipt className="w-4 h-4 text-red-500" /> Log Expense Bill
          </h3>

          <form onSubmit={handleLogExpense} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Expense Category</label>
              <select 
                className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#dfb76c] cursor-pointer ${
                  isIpsHighContrast 
                    ? "bg-white text-neutral-850 border-neutral-250 font-medium" 
                    : "bg-[#0b0b0d] text-[#dfb76c] border-neutral-800/60"
                }`}
                value={category}
                onChange={(e) => setCategory(e.target.value as Expense["category"])}
              >
                {["Rent", "Salaries", "Utilities", "Marketing", "Logistics", "Others"].map(key => (
                  <option key={key} value={key} className={isIpsHighContrast ? "bg-white text-neutral-850" : "bg-[#121216]"}>{key}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Accrued Amount (£)</label>
              <input
                id="exp-amount"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="GBP value..."
                className={`w-full font-mono px-3 py-2.5 rounded-lg border focus:outline-none focus:border-[#dfb76c] ${
                  isIpsHighContrast 
                    ? "bg-white text-neutral-850 border-neutral-250" 
                    : "bg-[#0b0b0d] text-white border-neutral-800/60"
                }`}
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Supplier Reference / Invoice Bill No</label>
              <input
                id="exp-ref"
                type="text"
                required
                placeholder="e.g. BILL-991A, UT-202B..."
                className={`w-full px-3 py-2.5 rounded-lg border focus:outline-none focus:border-[#dfb76c] ${
                  isIpsHighContrast 
                    ? "bg-white text-neutral-850 border-neutral-250" 
                    : "bg-[#0b0b0d] text-white border-neutral-800/60"
                }`}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Date Incurred</label>
              <input
                id="exp-date"
                type="date"
                required
                className={`w-full px-3 py-2.5 rounded-lg border focus:outline-none focus:border-[#dfb76c] font-mono ${
                  isIpsHighContrast 
                    ? "bg-white text-neutral-850 border-neutral-250" 
                    : "bg-[#0b0b0d] text-white border-neutral-800/60"
                }`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {amount !== "" && amount > 1000 && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 text-[10px] uppercase font-bold p-3 rounded-lg flex gap-2 items-center animate-pulse">
                <AlertTriangle className="w-5 shrink-0" /> Warning: High-Value outlay alert. Logs will log an Anomaly event!
              </div>
            )}

            <button
              id="log-expense-trigger"
              type="submit"
              className={`w-full font-display font-semibold py-3 px-4 rounded-lg text-xs transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5 active:scale-98 ${
                isIpsHighContrast
                  ? "bg-[#b89047] hover:bg-[#a57f3c] text-white"
                  : "bg-[#dfb76c] hover:bg-[#ebd097] text-[#0b0b0d]"
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Log Expense into Ledger
            </button>
          </form>

          {notice && (
            <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-400 text-xs p-3.5 rounded-lg font-mono">
              SUCCESS: {notice}
            </div>
          )}
          {errorNotice && (
            <div className="bg-red-500/15 border border-red-500 text-red-400 text-xs p-3.5 rounded-lg font-mono">
              ERROR: {errorNotice}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT 2 COLS: Logged Ledger Table */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* CATEGORY SUM BUDGET ANALYSIS */}
        <div className={`border rounded-xl p-5 shadow-lg space-y-3.5 transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <h3 className={`font-display font-semibold text-xs uppercase tracking-widest ${isIpsHighContrast ? "text-[#1a1a24]" : "text-white"}`}>Outlay distribution analysis</h3>
          <div className="flex flex-wrap gap-2 animate-fade-in">
            {["Rent", "Salaries", "Utilities", "Marketing", "Logistics", "Others"].map(cat => {
              const sum = catSums[cat] || 0;
              const percent = getExpensesTotal() > 0 ? (sum / getExpensesTotal()) * 100 : 0;
              
              return (
                <div key={cat} className={`border p-3 rounded-lg flex-1 min-w-[120px] shadow transition-colors ${
                  isIpsHighContrast 
                    ? "bg-neutral-50 border-neutral-250 text-neutral-800" 
                    : "bg-[#0b0b0d] border-neutral-800/60 text-gray-300"
                }`}>
                  <span className="text-[10px] text-gray-500 font-mono block uppercase">{cat}</span>
                  <div className={`text-base font-mono font-bold mt-0.5 ${isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"}`}>£{sum.toFixed(2)}</div>
                  <div className="text-[9px] text-[#cc3333] font-mono mt-1 font-bold">{percent.toFixed(1)}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEDGER EXPENSE BOOK */}
        <div className={`border rounded-xl overflow-hidden shadow-lg transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <div className={`px-5 py-4 border-b flex justify-between items-center transition-colors ${
            isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0f0f13] border-neutral-800/60"
          }`}>
            <h3 className={`font-display font-medium text-xs uppercase tracking-widest flex items-center gap-2 ${
              isIpsHighContrast ? "text-neutral-900" : "text-white"
            }`}>
              <span className="w-1.5 h-3 bg-red-650 rounded"></span> Logged Expenses Sheet
            </h3>
            <button
              id="refresh-expenses-trigger"
              onClick={loadExpenses}
              className={`p-1.5 rounded transition-all duration-200 cursor-pointer ${
                isIpsHighContrast ? "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100" : "text-gray-400 hover:text-white hover:bg-neutral-800"
              }`}
              title="Sync Table"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[385px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className={`font-mono border-b uppercase text-[9px] ${
                  isIpsHighContrast 
                    ? "bg-neutral-100/50 text-neutral-600 border-neutral-200" 
                    : "bg-[#0b0b0d] text-gray-400 border-b border-neutral-800/60"
                }`}>
                  <th className="px-4 py-3">Expense ID</th>
                  <th className="px-4 py-3">Incurred Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Billing Reference</th>
                  <th className="px-4 py-3 text-right">Sum paid</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200" : "divide-neutral-800/40"}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center p-10 font-mono text-gray-500">
                      Querying catalog datasets...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-10 text-gray-500 font-mono text-xs">
                      No business expenditures registered yet. Outlays ledger is empty.
                    </td>
                  </tr>
                ) : (
                  expenses.map(e => (
                    <tr key={e.id} className={`transition-colors ${
                      isIpsHighContrast ? "hover:bg-neutral-50/70" : "hover:bg-[#1a1a24]/40"
                    }`}>
                      <td className="px-4 py-3 font-mono text-red-500 font-semibold uppercase">{e.id}</td>
                      <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>{e.date}</td>
                      <td className={`px-4 py-3 font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{e.category}</td>
                      <td className={`px-4 py-3 font-mono uppercase ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>{e.reference}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"}`}>£{e.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
