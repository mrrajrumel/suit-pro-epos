import { useState, useEffect } from "react";
import { ReceiptLog } from "../types.ts";
import { getReceiptLogs } from "../lib/db-helpers.ts";
import { DollarSign, CreditCard, Wallet, Landmark, RefreshCw, BarChart2 } from "lucide-react";

export default function ReceiptsLogger({ isIpsHighContrast = false }: { isIpsHighContrast?: boolean }) {
  const [receipts, setReceipts] = useState<ReceiptLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, []);

  async function loadReceipts() {
    setIsLoading(true);
    try {
      const data = await getReceiptLogs();
      setReceipts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // Payments summary
  const getTotalsByGroup = (group: "Cash" | "Card" | "Open Banking") => {
    return receipts.filter(r => {
      if (group === "Cash") return r.method === "Cash";
      if (group === "Open Banking") return r.method === "Open Banking";
      return r.method !== "Cash" && r.method !== "Open Banking"; // Visa, Mastercard, AMEX, Apple Pay, Google Pay etc.
    }).reduce((s, r) => s + r.amount, 0);
  };

  const cashTotal = getTotalsByGroup("Cash");
  const cardTotal = getTotalsByGroup("Card");
  const openBankingTotal = getTotalsByGroup("Open Banking");
  const grandTotal = receipts.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* DRAWER MONITORS */}
      <div className="space-y-4 font-sans">
        <div className={`border rounded-xl p-5 shadow-lg relative overflow-hidden transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <div className="absolute top-0 right-0 p-3 text-emerald-500/10">
            <Landmark className="w-16 h-16 stroke-1 text-[#dfb76c]" />
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Accrued drawer payments</span>
          <div className={`text-3xl font-mono font-bold mt-1.5 ${isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"}`}>£{grandTotal.toFixed(2)}</div>
          <p className="text-[10px] text-gray-500 font-mono mt-1">{receipts.length} successful payment receipts logged.</p>
        </div>

        {/* DETAILS ACCRUED PER PAYMENT METHODS */}
        <div className={`border rounded-xl p-5 shadow-lg space-y-4 transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <h3 className={`font-display font-semibold text-xs uppercase tracking-widest border-b pb-2 ${
            isIpsHighContrast ? "text-neutral-900 border-neutral-200" : "text-white border-[#262633]/60"
          }`}>Drawer Distribution Splits</h3>
          
          <div className="space-y-3">
            
            {/* CASH drawer */}
            <div className={`border p-3.5 rounded-lg flex items-center justify-between transition-colors ${
              isIpsHighContrast ? "bg-neutral-50 border-neutral-250" : "bg-[#0b0b0d] border-neutral-800/60"
            }`}>
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg border border-amber-500/15">
                  <DollarSign className="w-4 h-4 text-[#dfb76c]" />
                </div>
                <div>
                  <span className={`text-xs font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Cash Drawer Registers</span>
                  <div className="text-[10px] text-gray-500">Traditional Cash payouts</div>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-mono text-sm font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>£{cashTotal.toFixed(2)}</span>
                <div className="text-[9px] text-[#bf924f] font-mono leading-none">{grandTotal > 0 ? ((cashTotal/grandTotal)*100).toFixed(0) : 0}% share</div>
              </div>
            </div>

            {/* CARD payments */}
            <div className={`border p-3.5 rounded-lg flex items-center justify-between transition-colors ${
              isIpsHighContrast ? "bg-neutral-50 border-neutral-250" : "bg-[#0b0b0d] border-neutral-800/60"
            }`}>
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 text-blue-400 p-2 rounded-lg border border-blue-500/15">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className={`text-xs font-semibold font-sans ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Card POS Terminal</span>
                  <div className="text-[10px] text-gray-500">Visa, Mastercard, AMEX, PDQ</div>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-mono text-sm font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>£{cardTotal.toFixed(2)}</span>
                <div className="text-[9px] text-blue-400 font-mono leading-none">{grandTotal > 0 ? ((cardTotal/grandTotal)*100).toFixed(0) : 0}% share</div>
              </div>
            </div>

            {/* Open Banking clearing */}
            <div className={`border p-3.5 rounded-lg flex items-center justify-between transition-colors ${
              isIpsHighContrast ? "bg-neutral-50 border-neutral-250" : "bg-[#0b0b0d] border-neutral-800/60"
            }`}>
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg border border-emerald-500/15">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <span className={`text-xs font-semibold font-sans ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Open Banking Pay-by-Bank</span>
                  <div className="text-[10px] text-gray-500">Instant UK Faster Payments</div>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-mono text-sm font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>£{openBankingTotal.toFixed(2)}</span>
                <div className="text-[9px] text-emerald-400 font-mono leading-none">{grandTotal > 0 ? ((openBankingTotal/grandTotal)*100).toFixed(0) : 0}% share</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* DETAILED DRILLDOWN RECEIPT LOGS */}
      <div className="lg:col-span-2 space-y-6">
        
        <div className={`border rounded-xl dev-logger overflow-hidden shadow-lg transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <div className={`px-5 py-4 border-b flex justify-between items-center transition-colors ${
            isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0f0f13] border-neutral-800/60"
          }`}>
            <h3 className={`font-display font-medium text-xs uppercase tracking-widest flex items-center gap-2 ${
              isIpsHighContrast ? "text-neutral-900" : "text-white"
            }`}>
              <BarChart2 className="w-4 h-4 text-emerald-400" /> Active Receipts Audit Ledger
            </h3>
            <button
              id="refresh-receipts-tally"
              onClick={loadReceipts}
              className={`p-1.5 rounded transition-all duration-200 cursor-pointer ${
                isIpsHighContrast ? "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
              title="Sync metrics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className={`font-mono border-b uppercase text-[9px] ${
                  isIpsHighContrast 
                    ? "bg-neutral-100/50 text-neutral-600 border-neutral-200" 
                    : "bg-[#0b0b0d] text-gray-400 border-b border-neutral-800/60"
                }`}>
                  <th className="px-4 py-3.5">Receipt ID</th>
                  <th className="px-4 py-3.5">Invoice Link ID</th>
                  <th className="px-4 py-3.5">Logged Stamp Date</th>
                  <th className="px-4 py-3.5 text-center">Clearance Node</th>
                  <th className="px-4 py-3.5 text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200" : "divide-neutral-800/40"}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 font-mono text-gray-500">
                      Querying catalog...
                    </td>
                  </tr>
                ) : receipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-gray-500 font-mono text-xs">
                      No drawer payments cleared yet.
                    </td>
                  </tr>
                ) : (
                  receipts.map(rec => (
                    <tr key={rec.id} className={`transition-colors ${
                      isIpsHighContrast ? "hover:bg-neutral-50/75" : "hover:bg-[#1a1a24]/40"
                    }`}>
                      <td className="px-4 py-3 font-mono text-emerald-550 font-semibold uppercase">{rec.id}</td>
                      <td className="px-4 py-3 font-mono text-amber-550 uppercase">{rec.invoiceId}</td>
                      <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                        {new Date(rec.timestamp).toLocaleDateString("en-GB")}{" "}
                        {new Date(rec.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${
                          rec.method === "Cash" 
                            ? "bg-amber-500/10 text-[#bf924f]" 
                            : rec.method === "Open Banking" 
                              ? "bg-emerald-500/10 text-emerald-600 font-bold" 
                              : isIpsHighContrast
                                ? "bg-blue-500/10 text-blue-700 font-bold"
                                : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {rec.method}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"}`}>£{rec.amount.toFixed(2)}</td>
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
