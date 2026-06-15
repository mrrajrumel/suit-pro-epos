import { useState, useEffect } from "react";
import { SaleInvoice } from "../types.ts";
import { getSales } from "../lib/db-helpers.ts";
import { Search, Printer, Calendar, RefreshCw, Layers, CheckCircle2, DollarSign, Tag } from "lucide-react";

export default function SalesLedger({ isIpsHighContrast = false }: { isIpsHighContrast?: boolean }) {
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMethod, setFilterMethod] = useState<"All" | "Cash" | "Card" | "Open Banking">("All");
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    setIsLoading(true);
    try {
      const data = await getSales();
      setSales(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter and search lists
  const filteredSales = sales.filter(sale => {
    const InvoiceMatches = sale.id.toLowerCase().includes(searchQuery.toLowerCase());
    const CashierMatches = sale.salesperson.toLowerCase().includes(searchQuery.toLowerCase());
    const ItemSummaryMatches = sale.items.some(it => it.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const queryMatches = InvoiceMatches || CashierMatches || ItemSummaryMatches;
    const methodMatches = filterMethod === "All" || 
      (filterMethod === "Cash" && sale.paymentMethod === "Cash") ||
      (filterMethod === "Open Banking" && sale.paymentMethod === "Open Banking") ||
      (filterMethod === "Card" && sale.paymentMethod !== "Cash" && sale.paymentMethod !== "Open Banking");
    
    return queryMatches && methodMatches;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first

  const printSelectedInvoiceInline = (invoice: SaleInvoice) => {
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) return;

    const itemsRows = invoice.items.map(it => `
      <tr>
        <td style="padding-top: 5px; padding-bottom: 2px;">${it.name}<br/><span style="font-size: 8px; color: #444;">Sz: ${it.size} | Col: ${it.colour}</span></td>
        <td style="text-align: center; padding-top: 5px;">${it.qty}</td>
        <td style="text-align: right; padding-top: 5px;">£${(it.sellingPrice * it.qty).toFixed(2)}</td>
      </tr>
    `).join("");

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Thermal Receipt ${invoice.id}</title>
          <style>
            body { font-family: monospace; width: 80mm; padding: 10px; margin: 0; background: #fff; color: #000; }
            table { width: 100%; font-size: 9px; border-collapse: collapse; }
            th { text-align: left; padding-bottom: 4px; border-bottom: 1px solid #000; }
            .totals { font-size: 9px; line-height: 14px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="text-center" style="margin-bottom: 15px;">
            <h1 style="font-size: 19px; font-weight: bold; margin: 0; letter-spacing: 2px;">SUIT PRO</h1>
            <p style="font-size: 10px; margin: 2px 0 0 0; text-transform: uppercase;">Fine Tailoring & Menswear</p>
            <p style="font-size: 9px; margin: 2px 0;">Savile Row, London W1S</p>
            <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>
            <p style="font-size: 10px; font-weight: bold; margin: 0;">RE-PRINTED RECEIPT</p>
          </div>
          <div style="font-size: 9px; margin-bottom: 10px;">
            <div>INVOICE ID: <b>${invoice.id}</b></div>
            <div>DATE/TIME: ${new Date(invoice.timestamp).toLocaleString("en-GB")}</div>
            <div>CASHIER: ${invoice.salesperson}</div>
            <div>PAYMENT: ${invoice.paymentMethod.toUpperCase()}</div>
          </div>
          <div style="border-bottom: 1px dashed #000; margin-bottom: 8px;"></div>
          <table>
            <thead>
              <tr>
                <th>Item [Size]</th>
                <th style="text-align: center; width: 30px;">Qty</th>
                <th style="text-align: right; width: 60px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>
          <div class="totals">
            <div style="display: flex; justify-content: space-between;"><span>SUBTOTAL:</span><span style="float: right;">£${invoice.subtotal.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>VAT RATE (20%):</span><span style="float: right;">£${invoice.vat.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;"><span>GRAND TOTAL:</span><span style="float: right;">£${invoice.total.toFixed(2)}</span></div>
          </div>
          <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>
          <p class="text-center" style="font-size: 8px; margin: 0;">DUPLICATE THERMAL COPY</p>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* LEFT 2 COLS: Master Sales List */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* FILTERS AND SEARCH PANEL */}
        <div className={`border rounded-xl p-4 shadow-lg md:flex justify-between items-center gap-4 space-y-4 md:space-y-0 transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          
          {/* Query Inputs */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="ledger-search-query"
              type="text"
              placeholder="Search Invoice ID, Cashier or product specs..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border focus:outline-none focus:border-[#dfb76c] text-xs transition-all ${
                isIpsHighContrast 
                  ? "bg-neutral-50 text-neutral-800 border-neutral-250" 
                  : "bg-[#0b0b0d] text-white border-neutral-800/60"
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Payment Method filter */}
          <div className={`flex gap-1 border p-0.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
            isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
          }`}>
            {["All", "Cash", "Card", "Open Banking"].map(m => (
              <button
                id={`filter-m-${m.replace(/\s+/g, "").toLowerCase()}`}
                key={m}
                type="button"
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  filterMethod === m 
                    ? isIpsHighContrast
                      ? "bg-[#b89047] text-white font-bold"
                      : "bg-[#dfb76c] text-black font-bold" 
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setFilterMethod(m as any)}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Sync Button */}
          <button
            id="sync-ledger-button"
            onClick={loadSales}
            className={`p-2 border rounded-lg transition-all shrink-0 cursor-pointer ${
              isIpsHighContrast 
                ? "bg-white hover:bg-neutral-100 border-neutral-250 text-neutral-700" 
                : "bg-[#0b0b0d] border-[#262633]/60 hover:border-neutral-700 text-[#dfb76c] hover:bg-neutral-800/40"
            }`}
            title="Reload Transactions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* SALES INVOICES TABLE */}
        <div className={`border rounded-xl shadow-lg overflow-hidden transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          <div className={`px-5 py-4 border-b flex justify-between items-center transition-colors ${
            isIpsHighContrast ? "bg-[#f8f9fa] border-neutral-200" : "bg-[#0f0f13] border-neutral-800/60"
          }`}>
            <h3 className={`font-display font-medium text-xs uppercase tracking-widest ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Completed Sales Ledger</h3>
            <span className="text-xs text-gray-500 font-mono">{filteredSales.length} invoices found</span>
          </div>

          <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className={`font-mono border-b uppercase text-[9px] ${
                  isIpsHighContrast 
                    ? "bg-neutral-100/50 text-neutral-600 border-neutral-200" 
                    : "bg-[#0b0b0d] text-gray-400 border-b border-neutral-800/60"
                }`}>
                  <th className="px-4 py-3">Invoice ID</th>
                  <th className="px-4 py-3">Timestamp Date</th>
                  <th className="px-4 py-3">Cashier Staff</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Pre-Tax</th>
                  <th className="px-4 py-3 text-right">Sum paid</th>
                  <th className="px-4 py-3 text-center">Details</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200" : "divide-neutral-800/40"}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center p-10 font-mono text-gray-500">
                      Syncing database...
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-12 text-gray-500 font-mono text-xs">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(sale => {
                    const isSelected = selectedInvoice?.id === sale.id;
                    return (
                      <tr 
                        key={sale.id} 
                        className={`transition-colors cursor-pointer ${
                          isSelected 
                            ? isIpsHighContrast
                              ? "bg-neutral-100 border-l-2 border-l-[#b89047]"
                              : "bg-[#1a1a24]/70 border-l-2 border-l-[#dfb76c] text-white" 
                            : isIpsHighContrast
                              ? "hover:bg-neutral-50 text-neutral-850"
                              : "hover:bg-[#1a1a24]/40 text-gray-300"
                        }`}
                        onClick={() => setSelectedInvoice(sale)}
                      >
                        <td className={`px-4 py-3 font-mono font-semibold uppercase ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>{sale.id}</td>
                        <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                          {new Date(sale.timestamp).toLocaleDateString("en-GB")}{" "}
                          {new Date(sale.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className={`px-4 py-3 font-medium ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{sale.salesperson}</td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${
                            sale.paymentMethod === "Cash" 
                              ? "bg-amber-500/10 text-[#bf924f]" 
                              : sale.paymentMethod !== "Open Banking"
                                ? "bg-blue-500/10 text-blue-400" 
                                : "bg-emerald-500/10 text-emerald-400 font-semibold"
                          }`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>£{sale.subtotal.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>£{sale.total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            id={`select-inv-${sale.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedInvoice(sale); }}
                            className={`border px-2.5 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                              isIpsHighContrast 
                                ? "bg-white hover:bg-neutral-50 border-neutral-250 text-neutral-800" 
                                : "bg-[#0b0b0d] border-neutral-800/60 text-gray-400 hover:text-[#dfb76c]"
                            }`}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT COL: Invoice itemization inspector */}
      <div className="space-y-6">
        
        <div className={`border rounded-xl p-5 shadow-lg space-y-4 min-h-[400px] transition-colors ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
        }`}>
          {selectedInvoice ? (
            <div className="space-y-4">
              <div className={`flex justify-between items-start border-b pb-3 ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/60"}`}>
                <div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono px-2 py-0.5 rounded uppercase">
                    Checkout Verified
                  </span>
                  <h4 className={`text-base font-display font-semibold mt-2 uppercase ${isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"}`}>Invoice Inspector</h4>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{selectedInvoice.id}</p>
                </div>
                
                {/* Reprint Receipt button */}
                <button
                  id="reprint-receipt-bin"
                  onClick={() => printSelectedInvoiceInline(selectedInvoice)}
                  className={`border rounded p-1.5 px-2.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isIpsHighContrast 
                      ? "bg-white hover:bg-neutral-50 border-neutral-250 text-[#b89047]" 
                      : "bg-[#0b0b0d] hover:bg-neutral-800/60 border-neutral-800/60 text-[#dfb76c]"
                  }`}
                  title="Reprint thermal receipt duplicate"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Print Duplicate</span>
                </button>
              </div>

              {/* Specs array list */}
              <div className="space-y-2.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest block border-b pb-1 ${
                  isIpsHighContrast ? "text-neutral-600 border-neutral-100" : "text-gray-400 border-neutral-800/40"
                }`}>Line items specs</span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className={`border p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                      isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
                    }`}>
                      <div className="min-w-0 flex-1 pr-2 text-left">
                        <h5 className={`font-semibold truncate ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{item.name}</h5>
                        <div className="flex gap-2.5 text-[10px] text-gray-500 font-mono mt-0.5">
                          <span>Sz: {item.size}</span>
                          <span>Col: {item.colour}</span>
                          <span>x{item.qty}</span>
                        </div>
                      </div>
                      <span className={`font-mono font-bold ml-auto pl-1 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>
                        £{(item.sellingPrice * item.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial audit panel */}
              <div className={`space-y-2 border-t pt-3 ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/60"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>Corporate Margin audit</span>
                <div className={`space-y-1.5 font-mono text-[11px] p-3 rounded-lg border ${
                  isIpsHighContrast 
                    ? "bg-neutral-50 border-neutral-205 text-neutral-700" 
                    : "bg-[#0b0b0d] border-neutral-800/60 text-gray-400"
                }`}>
                  <div className="flex justify-between">
                    <span>Invoice Net pre-tax:</span>
                    <span className={isIpsHighContrast ? "text-neutral-900 font-medium" : "text-white"}>£{selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT Standard Component:</span>
                    <span className={isIpsHighContrast ? "text-neutral-900 font-medium" : "text-white"}>£{selectedInvoice.vat.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold text-xs pt-1 border-t ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"}`}>
                    <span className={isIpsHighContrast ? "text-neutral-800" : "text-white"}>TOTAL TRANSACTION:</span>
                    <span className={isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}>£{selectedInvoice.total.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.paymentMethod === "Cash" && (
                    <>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Drawer Cash Handed:</span>
                        <span>£{selectedInvoice.amountTendered.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Drawer Cash Change:</span>
                        <span>£{selectedInvoice.changeDue.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className={`flex justify-between font-bold pt-1 border-t text-[10px] ${
                    isIpsHighContrast 
                      ? "border-neutral-200 text-emerald-650" 
                      : "border-neutral-800/40 text-emerald-400"
                  }`}>
                    <span>NET COGS MARGIN PROFIT:</span>
                    <span>+£{selectedInvoice.profit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[340px] text-center text-gray-500 font-sans">
              <Layers className={`w-12 h-12 stroke-1 mb-3 ${isIpsHighContrast ? "text-neutral-300" : "text-gray-700"}`} />
              <p className={`text-xs font-semibold uppercase tracking-wider ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>Ledger inspector</p>
              <p className="text-[11px] text-gray-650 mt-2 max-w-[200px] leading-relaxed">Select any transaction item in active ledger Table to inspect individual specifications and margin details.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
