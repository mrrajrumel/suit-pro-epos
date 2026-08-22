import { useState, useEffect } from "react";
import { SaleInvoice } from "../types.ts";
import { getSales } from "../lib/db-helpers.ts";
import { 
  Search, Printer, Calendar, RefreshCw, Layers, CheckCircle2, 
  DollarSign, Tag, FileText, Download, TrendingUp, PieChart, 
  BarChart3, Users, ShoppingBag, ShieldCheck, Percent, HelpCircle 
} from "lucide-react";
import { requestPrintPreview } from "../lib/print-preview.ts";

export default function SalesLedger({ isIpsHighContrast = false }: { isIpsHighContrast?: boolean }) {
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("All");
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Reporting and active view states
  const [activeTab, setActiveTab] = useState<"history" | "financials" | "distributions">("history");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    setIsLoading(true);
    try {
      const data = await getSales();
      setSales(data || []);
    } catch (err) {
      console.error("Failed to load sales database ledger", err);
    } finally {
      setIsLoading(false);
    }
  }

  // --- DATE MATCHING HELPERS ---
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const isWithinLast7Days = (dateStr: string) => {
    const d = new Date(dateStr);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return d >= sevenDaysAgo;
  };

  const isWithinCurrentMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isWithinCustomRange = (dateStr: string) => {
    if (!customStartDate && !customEndDate) return true;
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    
    if (customStartDate) {
      const start = new Date(customStartDate);
      start.setHours(0,0,0,0);
      if (d < start) return false;
    }
    if (customEndDate) {
      const end = new Date(customEndDate);
      end.setHours(23,59,59,999);
      if (d > end) return false;
    }
    return true;
  };

  // --- FILTERED AND SEARCHED LIST FOR MASTER TABLE ---
  const filteredSales = sales.filter(sale => {
    const invoiceId = String(sale.id || "");
    const salesperson = String(sale.salesperson || "");
    const customerName = String(sale.customer?.name || "");
    const saleItems = Array.isArray(sale.items) ? sale.items : [];
    const InvoiceMatches = invoiceId.toLowerCase().includes(searchQuery.toLowerCase());
    const CashierMatches = salesperson.toLowerCase().includes(searchQuery.toLowerCase());
    const CustomerMatches = customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const ItemSummaryMatches = saleItems.some(it => String(it?.name || "").toLowerCase().includes(searchQuery.toLowerCase()));
    
    const queryMatches = InvoiceMatches || CashierMatches || CustomerMatches || ItemSummaryMatches;
    
    // Check payment method filters (split payments or direct)
    let methodMatches = true;
    if (filterMethod !== "All") {
      if (sale.splits?.length) {
        methodMatches = sale.splits.some((split) => split.method === filterMethod);
      } else {
        methodMatches = sale.paymentMethod === filterMethod;
      }
    }

    const dateMatches = isWithinCustomRange(sale.timestamp);
    
    return queryMatches && methodMatches && dateMatches;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // --- REPORT AGGREGATORS ---
  const getAggregates = (invoiceList: SaleInvoice[]) => {
    let totalSalesVal = 0;
    let totalPreTaxVal = 0;
    let totalVatVal = 0;
    let totalProfitVal = 0;
    let totalCogsVal = 0;

    invoiceList.forEach(s => {
      totalSalesVal += s.total;
      totalPreTaxVal += s.subtotal;
      totalVatVal += s.vat;
      totalProfitVal += s.profit;
      totalCogsVal += (s.subtotal - s.profit);
    });

    return {
      count: invoiceList.length,
      revenue: totalSalesVal,
      preTax: totalPreTaxVal,
      vat: totalVatVal,
      profit: totalProfitVal,
      cogs: totalCogsVal,
      margin: totalPreTaxVal > 0 ? (totalProfitVal / totalPreTaxVal) * 100 : 0
    };
  };

  // Financial segments
  const todaySales = sales.filter(s => isToday(s.timestamp));
  const weeklySales = sales.filter(s => isWithinLast7Days(s.timestamp));
  const monthlySales = sales.filter(s => isWithinCurrentMonth(s.timestamp));
  const customSales = sales.filter(s => isWithinCustomRange(s.timestamp));

  const statsToday = getAggregates(todaySales);
  const statsWeekly = getAggregates(weeklySales);
  const statsMonthly = getAggregates(monthlySales);
  const statsCustom = getAggregates(customSales);

  // Payment method distribution
  const getPaymentMethodDistribution = () => {
    const dist: Record<string, { count: number; total: number }> = {};
    sales.forEach(s => {
      if (s.splits?.length) {
        const m1 = s.splits[0]?.method || "Split-1";
        const m2 = s.splits[1]?.method || "Split-2";
        const safeTotal = Number(s.total) || 0;
        const val1 = Math.min(Math.max(Number(s.splits[0]?.amount) || 0, 0), safeTotal);
        const val2 = Math.min(Math.max(Number(s.splits[1]?.amount) || safeTotal - val1, 0), safeTotal - val1);

        if (!dist[m1]) dist[m1] = { count: 0, total: 0 };
        dist[m1].count += 1;
        dist[m1].total += val1;

        if (!dist[m2]) dist[m2] = { count: 0, total: 0 };
        dist[m2].count += 1;
        dist[m2].total += val2;
      } else {
        const m = s.paymentMethod || "Other";
        if (!dist[m]) dist[m] = { count: 0, total: 0 };
        dist[m].count += 1;
        dist[m].total += Number(s.total) || 0;
      }
    });
    return Object.entries(dist).map(([method, data]) => ({ method, ...data }));
  };

  // Product popularity distribution
  const getProductDistribution = () => {
    const dist: Record<string, { qty: number; salesVal: number; profitVal: number }> = {};
    sales.forEach(s => {
      (Array.isArray(s.items) ? s.items : []).forEach(it => {
        const nameKey = it.name;
        if (!dist[nameKey]) dist[nameKey] = { qty: 0, salesVal: 0, profitVal: 0 };
        dist[nameKey].qty += it.qty;
        dist[nameKey].salesVal += (it.sellingPrice * it.qty);
        dist[nameKey].profitVal += ((it.sellingPrice - it.costPrice) * it.qty);
      });
    });
    return Object.entries(dist)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  };

  // Customer loyalty list
  const getCustomerDistribution = () => {
    const dist: Record<string, { count: number; spend: number }> = {};
    sales.forEach(s => {
      const custName = s.customer?.name || "Anonymous Walk-in Client";
      if (!dist[custName]) dist[custName] = { count: 0, spend: 0 };
      dist[custName].count += 1;
      dist[custName].spend += s.total;
    });
    return Object.entries(dist)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spend - a.spend);
  };

  // --- EXPORT TO EXCEL/CSV & PDF WRAPPER UTILS ---
  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Invoice ID,Date,Cashier,Customer,Payment Method,Subtotal (Excl. VAT),VAT Component,Total Charged,Profit Margin\r\n";
        
        filteredSales.forEach(s => {
          const client = s.customer?.name ? s.customer.name.replace(/,/g, "") : "Walk-in Client";
          const method = s.splits?.length ? `Split (${s.splits.map((split) => split.method).join("+")})` : s.paymentMethod;
          csvContent += `${s.id},"${new Date(s.timestamp).toLocaleString("en-GB")}",${s.salesperson},"${client}",${method},${s.subtotal.toFixed(2)},${s.vat.toFixed(2)},${s.total.toFixed(2)},${s.profit.toFixed(2)}\r\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `suitpro_sales_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Export failed", err);
      } finally {
        setIsExporting(false);
      }
    }, 600);
  };

  const printFullSummaryReport = () => {
    const printWindow = { document: {
      write: (html: string) => requestPrintPreview({ title: "Executive Sales Report", html, paperSize: "A4" }),
      close: () => undefined
    } };

    const rowItems = filteredSales.map(s => `
      <tr>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; font-family: monospace;">${s.id}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd;">${new Date(s.timestamp).toLocaleDateString("en-GB")}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd;">${s.salesperson}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd;">${s.splits?.length ? `SPLIT` : s.paymentMethod}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace;">£${s.subtotal.toFixed(2)}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace;">£${s.vat.toFixed(2)}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace; font-weight: bold;">£${s.total.toFixed(2)}</td>
      </tr>
    `).join("");

    const sums = getAggregates(filteredSales);

    printWindow.document.write(`
      <html>
        <head>
          <title>Suit Pro - Executive Sales Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 25px; color: #111; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #b89047; padding-bottom: 15px; }
            .header h1 { margin: 0; color: #b89047; font-size: 28px; letter-spacing: 1px; }
            .meta { font-size: 11px; color: #555; display: flex; justify-content: space-between; margin-top: 5px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
            .stat-box { padding: 12px; background: #f9f9f9; border: 1px solid #eee; border-radius: 6px; text-align: center; }
            .stat-box h3 { margin: 0; font-size: 10px; color: #777; text-transform: uppercase; }
            .stat-box p { margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #111; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
            th { background: #b89047; color: #fff; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SUIT PRO EXECUTIVE LEDGER REPORT</h1>
            <div class="meta">
              <span>Date Compiled: ${new Date().toLocaleString("en-GB")}</span>
              <span>Scope: Custom Range Filter Set</span>
              <span>Total Records: ${filteredSales.length}</span>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <h3>Grand Revenue (Gross)</h3>
              <p>£${sums.revenue.toFixed(2)}</p>
            </div>
            <div class="stat-box">
              <h3>Pre-Tax Turnover</h3>
              <p>£${sums.preTax.toFixed(2)}</p>
            </div>
            <div class="stat-box">
              <h3>Standard VAT Collected</h3>
              <p>£${sums.vat.toFixed(2)}</p>
            </div>
            <div class="stat-box">
              <h3>Realized Profit</h3>
              <p style="color: #059669;">£${sums.profit.toFixed(2)}</p>
            </div>
          </div>

          <h3>Itemized Transaction Journals</h3>
          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Date</th>
                <th>Cashier Staff</th>
                <th>Payment Route</th>
                <th style="text-align: right;">Excl. VAT</th>
                <th style="text-align: right;">VAT Amt</th>
                <th style="text-align: right;">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowItems}
            </tbody>
          </table>

          <div style="margin-top: 35px; border-top: 1px solid #ccc; padding-top: 15px; font-size: 10px; text-align: center; color: #888;">
            Suit Pro Enterprise POS Platform Audit Journal. Confidential Client Ledger Record.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printSelectedInvoiceInline = (invoice: SaleInvoice) => {
    const receiptWindow = { document: {
      write: (html: string) => requestPrintPreview({ title: `Receipt ${invoice.id}`, html, paperSize: "80mm" }),
      close: () => undefined
    } };

    const itemsRows = invoice.items.map(it => `
      <tr>
        <td style="padding-top: 5px; padding-bottom: 2px;">
          ${it.customDescription || it.name}
          <br/>
          <span style="font-size: 8px; color: #444;">
            SKU: ${it.barcode} | Sz: ${it.size} | Col: ${it.colour}
          </span>
        </td>
        <td style="text-align: center; padding-top: 5px;">${it.qty}</td>
        <td style="text-align: right; padding-top: 5px;">£${(it.sellingPrice * it.qty).toFixed(2)}</td>
      </tr>
    `).join("");

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Thermal Receipt ${invoice.id}</title>
          <style>
            @page { size: 72mm 210mm; margin: 0; }
            html, body { font-family: monospace; width: 72mm; max-width: 72mm; padding: 0; margin: 0; background: #fff; color: #000; overflow-x: hidden; overflow-wrap: anywhere; word-break: break-word; }
            *, *::before, *::after { box-sizing: border-box; max-width: 100%; }
            table { width: 100%; max-width: 100%; table-layout: fixed; font-size: 9px; border-collapse: collapse; }
            th { text-align: left; padding-bottom: 4px; border-bottom: 1px solid #000; }
            .totals { font-size: 9px; line-height: 14px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
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
            <div>PAYMENT: ${invoice.splits?.length ? `SPLIT (${invoice.splits.map((split) => split.method).join("/")})` : invoice.paymentMethod.toUpperCase()}</div>
            ${invoice.customer?.name ? `<div>CUSTOMER: ${invoice.customer.name}</div>` : ""}
          </div>
          <div style="border-bottom: 1px dashed #000; margin-bottom: 8px;"></div>
          <table>
            <thead>
              <tr>
                <th>Item Specs</th>
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
            <div style="display: flex; justify-content: space-between;"><span>VAT RATE (${Number(localStorage.getItem('suitpro_vat_rate') || 20)}%):</span><span style="float: right;">£${invoice.vat.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;"><span>GRAND TOTAL:</span><span style="float: right;">£${invoice.total.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; color: #444; font-size: 8px; margin-top: 4px;"><span>COGS NET PROFIT:</span><span style="float: right;">+£${invoice.profit.toFixed(2)}</span></div>
          </div>
          <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>
          <p class="text-center" style="font-size: 8px; margin: 0;">DUPLICATE THERMAL COPY</p>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER CONTROLS BAR WITH TAB NAVIGATION */}
      <div className={`border rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
        isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm" : "bg-[#121216]/80 border-neutral-800/60"
      }`}>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
            <h2 className={`font-display font-bold uppercase tracking-[0.1em] text-sm ${
              isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
            }`}>Sales Ledger & Business Intelligence Reports</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">Real-time VAT auditing, COGS margins, customer loyalty aggregation & Excel exports.</p>
        </div>

        {/* Tab switchers */}
        <div className={`flex p-1 rounded-xl border text-xs font-semibold ${
          isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-black border-neutral-800/70"
        }`}>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "history"
                ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black font-bold")
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Sales History</span>
          </button>
          <button
            onClick={() => setActiveTab("financials")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "financials"
                ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black font-bold")
                : "text-gray-400 hover:text-white"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Financial Reports</span>
          </button>
          <button
            onClick={() => setActiveTab("distributions")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "distributions"
                ? (isIpsHighContrast ? "bg-[#b89047] text-white" : "bg-[#dfb76c] text-black font-bold")
                : "text-gray-400 hover:text-white"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Sales Distributions</span>
          </button>
        </div>
      </div>

      {/* CUSTOM DATE RANGE FILTER WIDGET */}
      <div className={`border rounded-xl p-4 shadow-sm text-left transition-all ${
        isIpsHighContrast ? "bg-stone-50 border-neutral-200" : "bg-[#111115]/40 border-[#262633]/60"
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className={`text-xs font-mono font-bold uppercase tracking-wide ${isIpsHighContrast ? "text-neutral-700" : "text-gray-300"}`}>
              Custom Date Range Ledger Scope
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className={`p-1.5 rounded border ${
                isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-black border-neutral-800 text-white"
              }`}
            />
            <span className="text-gray-500 font-bold">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className={`p-1.5 rounded border ${
                isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-black border-neutral-800 text-white"
              }`}
            />
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                className="text-rose-500 font-bold hover:underline cursor-pointer"
              >
                Clear Range
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-mono uppercase flex items-center gap-1 cursor-pointer transition-all ${
                isIpsHighContrast 
                  ? "bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800" 
                  : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-emerald-400"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Compiling CSV..." : "Export Excel/CSV"}</span>
            </button>
            <button
              onClick={printFullSummaryReport}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-mono uppercase flex items-center gap-1 cursor-pointer transition-all ${
                isIpsHighContrast 
                  ? "bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800" 
                  : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-blue-400"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Audit Journal</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT ROUTER --- */}

      {/* VIEW 1: SALES LEDGER HISTORY (TABLE & INSPECTOR) */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* SEARCH AND PAYMENTS ROW FILTER */}
            <div className={`border rounded-xl p-4 shadow-lg md:flex justify-between items-center gap-4 space-y-4 md:space-y-0 transition-colors ${
              isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm" : "bg-[#121216]/80 border-neutral-800/60"
            }`}>
              <div className="relative flex-1 text-left">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Invoice ID, Cashier Staff, or Client Name..."
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border focus:outline-none focus:border-[#dfb76c] text-xs transition-all ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 text-neutral-800 border-neutral-250" 
                      : "bg-[#0b0b0d] text-white border-neutral-800/60"
                  }`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Payment Select Route */}
              <div className="text-left flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono text-gray-400 uppercase">Route:</span>
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className={`text-xs p-2 rounded-lg border cursor-pointer focus:outline-none ${
                    isIpsHighContrast ? "bg-white border-neutral-300 text-black" : "bg-[#0d0f17] border-[#262633]/60 text-white"
                  }`}
                >
                  <option value="All">All Payment Routes</option>
                  <option value="Cash">Cash (Manual Drawer)</option>
                  <option value="General Card">General Card Machine</option>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="AMEX">AMEX</option>
                  <option value="Contactless">Contactless NFC</option>
                  <option value="Apple Pay">Apple Pay</option>
                  <option value="Google Pay">Google Pay</option>
                  <option value="Bank Transfer">Direct Bank Transfer</option>
                  <option value="Gift Card">Boutique Gift Card</option>
                  <option value="Store Credit">Store Credit Voucher</option>
                  <option value="Custom">Custom Method</option>
                </select>
              </div>

              <button
                onClick={loadSales}
                className={`p-2 border rounded-lg transition-all shrink-0 cursor-pointer ${
                  isIpsHighContrast 
                    ? "bg-white hover:bg-neutral-100 border-neutral-250 text-neutral-700" 
                    : "bg-[#0b0b0d] border-[#262633]/60 hover:border-neutral-700 text-[#dfb76c]"
                }`}
                title="Reload Transactions"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* MASTER INVOICES LIST TABLE */}
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
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Payment</th>
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
                            <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-400" : "text-gray-400"}`}>
                              {new Date(sale.timestamp).toLocaleDateString("en-GB")}{" "}
                              {new Date(sale.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className={`px-4 py-3 font-medium ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{sale.salesperson}</td>
                            <td className="px-4 py-3 truncate max-w-[120px]" title={sale.customer?.name || "Walk-in"}>
                              {sale.customer?.name || "Walk-in Client"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${
                                sale.paymentMethod === "Cash" 
                                  ? "bg-amber-500/10 text-[#bf924f]" 
                                  : "bg-blue-500/10 text-blue-400 font-semibold"
                              }`}>
                                {sale.splits?.length ? "Split Methods" : sale.paymentMethod}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>£{sale.total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
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

          {/* INVOICE DETAIL INSPECTOR */}
          <div className="space-y-6">
            <div className={`border rounded-xl p-5 shadow-lg space-y-4 min-h-[400px] transition-colors text-left ${
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
                    
                    <button
                      onClick={() => printSelectedInvoiceInline(selectedInvoice)}
                      className={`border rounded p-1.5 px-2.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isIpsHighContrast 
                          ? "bg-white hover:bg-neutral-50 border-neutral-250 text-[#b89047]" 
                          : "bg-[#0b0b0d] hover:bg-neutral-800/60 border-neutral-800/60 text-[#dfb76c]"
                      }`}
                      title="Reprint duplicate thermal slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Thermal Slip</span>
                    </button>
                  </div>

                  {/* Customer Details banner if present */}
                  {selectedInvoice.customer && (
                    <div className={`p-2.5 rounded-lg text-xs space-y-1 ${
                      isIpsHighContrast ? "bg-neutral-50" : "bg-black/30"
                    }`}>
                      <p className="font-bold text-gray-400 text-[10px] uppercase font-mono">Boutique Client Details</p>
                      <p className="font-bold">{selectedInvoice.customer.name}</p>
                      {selectedInvoice.customer.email && <p className="text-gray-500">{selectedInvoice.customer.email}</p>}
                      {selectedInvoice.customer.phone && <p className="text-gray-500">{selectedInvoice.customer.phone}</p>}
                    </div>
                  )}

                  {/* Line item list specs */}
                  <div className="space-y-2.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest block border-b pb-1 ${
                      isIpsHighContrast ? "text-neutral-600 border-neutral-100" : "text-gray-400 border-neutral-800/40"
                    }`}>Line items specs</span>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {selectedInvoice.items.map((item, idx) => (
                        <div key={idx} className={`border p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                          isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-[#0b0b0d] border-neutral-800/60"
                        }`}>
                          <div className="min-w-0 flex-1 pr-2">
                            <h5 className={`font-semibold truncate ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                              {item.customDescription || item.name}
                            </h5>
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

                  {/* Financial calculations recap */}
                  <div className={`space-y-2 border-t pt-3 ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/60"}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>Corporate Margin audit</span>
                    <div className={`space-y-1.5 font-mono text-[11px] p-3 rounded-lg border ${
                      isIpsHighContrast 
                        ? "bg-neutral-50 border-neutral-205 text-neutral-700" 
                        : "bg-[#0b0b0d] text-gray-400 border-neutral-800/60"
                    }`}>
                      <div className="flex justify-between">
                        <span>Invoice Net pre-tax:</span>
                        <span className={isIpsHighContrast ? "text-neutral-900 font-medium" : "text-white"}>£{selectedInvoice.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT Standard Component:</span>
                        <span className={isIpsHighContrast ? "text-neutral-900 font-medium" : "text-white"}>£{selectedInvoice.vat.toFixed(2)}</span>
                      </div>
                      
                      {selectedInvoice.splits?.length ? (
                        <div className="border-t border-dashed border-neutral-800/50 py-1.5 my-1 space-y-1 text-[10px]">
                          <span className="text-amber-500 uppercase font-bold">Split Payments Allocation:</span>
                          <div className="flex justify-between text-gray-500">
                            <span>{selectedInvoice.splits[0]?.method}:</span>
                            <span>£{selectedInvoice.splits[0]?.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>{selectedInvoice.splits[1]?.method}:</span>
                            <span>£{selectedInvoice.splits[1]?.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : null}

                      <div className={`flex justify-between font-bold text-xs pt-1 border-t ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"}`}>
                        <span className={isIpsHighContrast ? "text-neutral-800" : "text-white"}>TOTAL TRANSACTION:</span>
                        <span className={isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}>£{selectedInvoice.total.toFixed(2)}</span>
                      </div>
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
      )}

      {/* VIEW 2: EXECUTIVE FINANCIAL REPORTS (PERIODIC STATS) */}
      {activeTab === "financials" && (
        <div className="space-y-6 text-left">
          
          {/* Executive periodic summary grids */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* TODAY'S SALES */}
            <div className={`p-5 rounded-2xl border ${
              isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm text-black" : "bg-[#18181f]/50 border-neutral-800/50 text-white"
            }`}>
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Today's Sales</span>
              <p className="text-2xl font-bold font-mono mt-1.5">£{statsToday.revenue.toFixed(2)}</p>
              <div className="flex justify-between text-[11px] text-gray-500 mt-2 border-t pt-1.5">
                <span>{statsToday.count} Invoices</span>
                <span className="text-emerald-500 font-bold">+£{statsToday.profit.toFixed(2)} profit</span>
              </div>
            </div>

            {/* WEEKLY REPORT */}
            <div className={`p-5 rounded-2xl border ${
              isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm text-black" : "bg-[#18181f]/50 border-neutral-800/50 text-white"
            }`}>
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Weekly Report (7d)</span>
              <p className="text-2xl font-bold font-mono mt-1.5">£{statsWeekly.revenue.toFixed(2)}</p>
              <div className="flex justify-between text-[11px] text-gray-500 mt-2 border-t pt-1.5">
                <span>{statsWeekly.count} Invoices</span>
                <span className="text-emerald-500 font-bold">+£{statsWeekly.profit.toFixed(2)} profit</span>
              </div>
            </div>

            {/* MONTHLY REPORT */}
            <div className={`p-5 rounded-2xl border ${
              isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm text-black" : "bg-[#18181f]/50 border-neutral-800/50 text-white"
            }`}>
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Monthly Report (MTD)</span>
              <p className="text-2xl font-bold font-mono mt-1.5">£{statsMonthly.revenue.toFixed(2)}</p>
              <div className="flex justify-between text-[11px] text-gray-500 mt-2 border-t pt-1.5">
                <span>{statsMonthly.count} Invoices</span>
                <span className="text-emerald-500 font-bold">+£{statsMonthly.profit.toFixed(2)} profit</span>
              </div>
            </div>

            {/* CUSTOM DATE SCOPE SUMMARY */}
            <div className={`p-5 rounded-2xl border ${
              isIpsHighContrast ? "bg-white border-neutral-200 shadow-sm text-black" : "bg-emerald-950/15 border-emerald-800/30 text-white"
            }`}>
              <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest block font-bold">Custom Scope Total</span>
              <p className="text-2xl font-bold font-mono mt-1.5 text-emerald-400">£{statsCustom.revenue.toFixed(2)}</p>
              <div className="flex justify-between text-[11px] text-emerald-500/80 mt-2 border-t pt-1.5">
                <span>{statsCustom.count} Invoices</span>
                <span className="font-bold">+£{statsCustom.profit.toFixed(2)} profit</span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* VAT AUDIT COMPLIANCE REPORT CARD */}
            <div className={`border rounded-2xl p-5 shadow-lg space-y-4 ${
              isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
            }`}>
              <div className="flex items-center gap-2 border-b pb-3 border-neutral-800/40">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className={`font-display font-semibold uppercase tracking-wider text-xs ${
                  isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
                }`}>Corporate VAT Tax Audit Ledger</h3>
              </div>
              
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20">
                  <span className="text-gray-400">Total Gross Turnover (Incl. VAT):</span>
                  <span className="font-bold">£{statsCustom.revenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20">
                  <span className="text-gray-400">Net Business Revenue (Excl. VAT):</span>
                  <span className="font-bold">£{statsCustom.preTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20 text-emerald-400">
                  <span className="font-semibold">VAT standard collected (To be declared):</span>
                  <span className="font-bold">£{statsCustom.vat.toFixed(2)}</span>
                </div>
              </div>

              <div className={`p-3 rounded-lg text-[11px] ${
                isIpsHighContrast ? "bg-neutral-50 text-neutral-600" : "bg-black/30 text-gray-400"
              }`}>
                <p className="font-semibold flex items-center gap-1.5 text-[10px] uppercase font-mono mb-1 text-gray-300">
                  <HelpCircle className="w-3.5 h-3.5" /> HMRC UK Compliance Note
                </p>
                Suit Pro compiles this VAT standard report dynamically based on custom active invoice items tagged with Standard 20% or Zero-rated criteria. Hand alterations can be zero-rated depending on tailored category.
              </div>
            </div>

            {/* NET PROFIT COGS EXCEL GRAPH */}
            <div className={`border rounded-2xl p-5 shadow-lg space-y-4 ${
              isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
            }`}>
              <div className="flex items-center gap-2 border-b pb-3 border-neutral-800/40">
                <Percent className="w-5 h-5 text-[#dfb76c]" />
                <h3 className={`font-display font-semibold uppercase tracking-wider text-xs ${
                  isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
                }`}>Net Profit & COGS Margin Audit</h3>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20">
                  <span className="text-gray-400">Pre-tax turnover:</span>
                  <span className="font-bold">£{statsCustom.preTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20">
                  <span className="text-gray-400">Total Cost of Goods Sold (COGS):</span>
                  <span className="font-bold text-rose-500">£{statsCustom.cogs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20 text-emerald-400">
                  <span className="font-semibold">Pure Accounting Profit:</span>
                  <span className="font-bold">£{statsCustom.profit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800/20 text-amber-500">
                  <span>Average Boutique Markup Margin:</span>
                  <span className="font-bold">{statsCustom.margin.toFixed(1)}% Markup</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* VIEW 3: SALES DISTRIBUTION (BY PAYMENT ROUTE, PRODUCT AND CUSTOMERS) */}
      {activeTab === "distributions" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          
          {/* PAYMENT METHOD-WISE BREAKDOWN */}
          <div className={`border rounded-2xl p-5 shadow-lg space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 border-neutral-800/40">
              <DollarSign className="w-4 h-4 text-[#dfb76c]" />
              <h3 className={`font-display font-semibold uppercase tracking-wider text-xs ${
                isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
              }`}>Payment Route Distributions</h3>
            </div>
            
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {getPaymentMethodDistribution().length === 0 ? (
                <p className="text-xs text-gray-500 font-mono">No payment data recorded in this period.</p>
              ) : (
                getPaymentMethodDistribution().map(({ method, count, total }) => (
                  <div key={method} className={`p-3 rounded-lg border flex justify-between items-center text-xs font-mono ${
                    isIpsHighContrast ? "bg-neutral-50 border-neutral-205" : "bg-black/30 border-neutral-800/40"
                  }`}>
                    <div>
                      <span className="font-bold text-gray-200 uppercase text-[10px] block">{method}</span>
                      <span className="text-gray-500 text-[10px]">{count} transaction routes</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">£{total.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PRODUCT-WISE SALES BREAKDOWN */}
          <div className={`border rounded-2xl p-5 shadow-lg space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 border-neutral-800/40">
              <ShoppingBag className="w-4 h-4 text-[#dfb76c]" />
              <h3 className={`font-display font-semibold uppercase tracking-wider text-xs ${
                isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
              }`}>Product-Wise popularity List</h3>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {getProductDistribution().length === 0 ? (
                <p className="text-xs text-gray-500 font-mono">No products sold in this period.</p>
              ) : (
                getProductDistribution().map(({ name, qty, salesVal }) => (
                  <div key={name} className={`p-3 rounded-lg border flex justify-between items-center text-xs font-mono ${
                    isIpsHighContrast ? "bg-neutral-50 border-neutral-205" : "bg-black/30 border-neutral-800/40"
                  }`}>
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="font-bold text-gray-200 text-[10px] block truncate">{name}</span>
                      <span className="text-gray-500 text-[10px]">{qty} units processed</span>
                    </div>
                    <span className="text-sm font-bold text-[#dfb76c] shrink-0">£{salesVal.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CUSTOMER-WISE SALES BREAKDOWN */}
          <div className={`border rounded-2xl p-5 shadow-lg space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 border-neutral-800/40">
              <Users className="w-4 h-4 text-[#dfb76c]" />
              <h3 className={`font-display font-semibold uppercase tracking-wider text-xs ${
                isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
              }`}>Customer Loyalty Aggregation</h3>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {getCustomerDistribution().length === 0 ? (
                <p className="text-xs text-gray-500 font-mono">No customer sales records in this period.</p>
              ) : (
                getCustomerDistribution().map(({ name, count, spend }) => (
                  <div key={name} className={`p-3 rounded-lg border flex justify-between items-center text-xs font-mono ${
                    isIpsHighContrast ? "bg-neutral-50 border-neutral-205" : "bg-black/30 border-neutral-800/40"
                  }`}>
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="font-bold text-gray-200 text-[10px] block truncate text-capitalize">{name}</span>
                      <span className="text-gray-500 text-[10px]">{count} invoice tickets</span>
                    </div>
                    <span className="text-sm font-bold text-blue-400 shrink-0">£{spend.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
