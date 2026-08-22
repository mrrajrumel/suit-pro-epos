import { requestPrintPreview } from "../lib/print-preview.ts";
import React, { useState, useEffect } from "react";
import { Supplier, SupplierPayment, PurchaseOrder } from "../types.ts";
import { Plus, Edit2, Trash2, Printer, Search, Mail, Phone, MapPin, Building, Landmark, History, PlusCircle } from "lucide-react";

interface SupplierManagerProps {
  isIpsHighContrast?: boolean;
}

const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "sup-scabal",
    name: "Scabal Fabrics Ltd",
    companyName: "Scabal SA",
    contactPerson: "Gregor MacIntosh",
    phone: "+44 20 7734 5800",
    email: "gregor@scabal.com",
    address: "12 Savile Row, London, W1S 3PQ",
    vatNumber: "GB 123 4567 89",
    paymentTerms: "Net 30",
    notes: "Premium worsted wool fabric supplier. Wool Super 150s & Cashmere blends.",
    outstandingBalance: 12400
  },
  {
    id: "sup-huntsman",
    name: "Huntsman Tailors",
    companyName: "Huntsman Savile Row",
    contactPerson: "Clara Vance",
    phone: "+44 20 7734 7441",
    email: "clara.vance@huntsmansavilerow.com",
    address: "11 Savile Row, London, W1S 3PS",
    vatNumber: "GB 987 6543 21",
    paymentTerms: "Net 15",
    notes: "Tuxedo & Dinner jacket master tailoring consultants. Special materials sourcing.",
    outstandingBalance: 3200
  }
];

export default function SupplierManager({ isIpsHighContrast = false }: SupplierManagerProps) {
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
      console.warn(`Supplier ledger write failed for ${key}. Keeping in-memory state only.`, error);
      try {
        localStorage.setItem(`${key}_backup`, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    return safeReadJson<Supplier[]>("suitpro_suppliers", SEED_SUPPLIERS);
  });

  const [payments, setPayments] = useState<SupplierPayment[]>(() => {
    const stored = safeReadJson<SupplierPayment[] | null>("suitpro_supplier_payments", null);
    if (stored) return stored;
    return [
      {
        id: "sp-1",
        supplierId: "sup-scabal",
        amount: 5000,
        date: "2026-06-15",
        reference: "INV-SC-8891 Settlement",
        notes: "Partial payment for Super 180s flannel fabric bolt."
      }
    ];
  });

  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrder[]>(() => {
    const stored = safeReadJson<PurchaseOrder[] | null>("suitpro_purchase_orders", null);
    if (stored) return stored;
    return [
      {
        id: "po-1",
        supplierId: "sup-scabal",
        date: "2026-06-10",
        status: "Received",
        items: [
          { sku: "FAB-SC-150", name: "Super 150s Wool Fabric Bolt", qty: 2, costPrice: 4000 }
        ],
        totalAmount: 8000
      }
    ];
  });

  useEffect(() => {
    safeWriteJson("suitpro_suppliers", suppliers);
  }, [suppliers]);

  useEffect(() => {
    safeWriteJson("suitpro_supplier_payments", payments);
  }, [payments]);

  useEffect(() => {
    safeWriteJson("suitpro_purchase_orders", purchaseHistory);
  }, [purchaseHistory]);

  // Form states for Add/Edit Supplier
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [outstandingBalance, setOutstandingBalance] = useState("0");

  // Payment states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  // Functions
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setSupplierName("");
    setCompanyName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setVatNumber("");
    setPaymentTerms("Net 30");
    setNotes("");
    setOutstandingBalance("0");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupplierName(sup.name);
    setCompanyName(sup.companyName);
    setContactPerson(sup.contactPerson);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setVatNumber(sup.vatNumber);
    setPaymentTerms(sup.paymentTerms);
    setNotes(sup.notes);
    setOutstandingBalance(sup.outstandingBalance.toString());
    setIsModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) return;

    if (editingSupplier) {
      setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? {
        ...s,
        name: supplierName,
        companyName,
        contactPerson,
        phone,
        email,
        address,
        vatNumber,
        paymentTerms,
        notes,
        outstandingBalance: parseFloat(outstandingBalance) || 0
      } : s));
    } else {
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name: supplierName,
        companyName,
        contactPerson,
        phone,
        email,
        address,
        vatNumber,
        paymentTerms,
        notes,
        outstandingBalance: parseFloat(outstandingBalance) || 0
      };
      setSuppliers(prev => [...prev, newSup]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteSupplier = (id: string) => {
    if (window.confirm("Are you sure you want to delete this supplier and audit ledger?")) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      setPayments(prev => prev.filter(p => p.supplierId !== id));
      setPurchaseHistory(prev => prev.filter(po => po.supplierId !== id));
    }
  };

  const handlePostPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0 || !paySupplierId) return;

    // Deduct from supplier outstanding balance
    setSuppliers(prev => prev.map(s => s.id === paySupplierId ? { ...s, outstandingBalance: Math.max(0, s.outstandingBalance - amt) } : s));

    // Register payment
    const newPayment: SupplierPayment = {
      id: `sp-${Date.now()}`,
      supplierId: paySupplierId,
      amount: amt,
      date: new Date().toISOString().split("T")[0],
      reference: payReference || "Supplier Remittance Advice",
      notes: payNotes
    };

    setPayments(prev => [newPayment, ...prev]);

    // Reset Form
    setPayAmount("");
    setPayReference("");
    setPayNotes("");
    setIsPaymentModalOpen(false);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* HEADER DECK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-neutral-800/60 print:hidden">
        <div>
          <h2 className={`font-display text-xl font-bold uppercase tracking-wider ${
            isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
          }`}>Enterprise Supplier Management</h2>
          <p className="text-xs text-gray-400 mt-1">Sartorial merchants, cloth manufacturers, purchase order sheets, and credit line payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              isIpsHighContrast 
                ? "bg-[#b89047] hover:bg-[#b89047]/90 text-white border-none" 
                : "bg-slate-950 border-[#dfb76c]/30 hover:border-[#dfb76c] text-[#dfb76c]"
            }`}
          >
            <Plus className="w-4 h-4" /> Add New Supplier
          </button>
          <button
            type="button"
            onClick={() => {
              if (suppliers.length > 0) {
                setPaySupplierId(suppliers[0].id);
                setIsPaymentModalOpen(true);
              }
            }}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 bg-[#dfb76c]/10 border-[#dfb76c]/20 text-[#dfb76c] hover:bg-[#dfb76c]/20`}
          >
            <PlusCircle className="w-4 h-4" /> Record Bill Payment
          </button>
          <button
            type="button"
            onClick={() => requestPrintPreview({ title: "Supplier Ledger", html: document.documentElement.outerHTML, paperSize: "A4" })}
            className="p-2 bg-[#121216]/40 border border-neutral-850 text-gray-300 rounded-lg hover:text-white cursor-pointer"
            title="Print Supplier Ledger"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SEARCH BAR DECK */}
      <div className="flex items-center gap-3 max-w-md print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 text-xs border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#dfb76c] ${
              isIpsHighContrast ? "bg-white text-[#111116] border-neutral-250" : "bg-[#111115]/50 text-white border-neutral-850"
            }`}
            placeholder="Search merchants, companies or contacts..."
          />
        </div>
      </div>

      {/* MAIN TWO COLUMN VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: SUPPLIERS LIST */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className={`text-xs font-bold uppercase tracking-widest ${
            isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
          }`}>Partner Merchants</h3>

          <div className="space-y-4">
            {filteredSuppliers.length === 0 ? (
              <div className="p-10 text-center text-gray-500 border border-neutral-850 rounded-2xl">
                No merchants indexed matching query.
              </div>
            ) : (
              filteredSuppliers.map(s => (
                <div 
                  key={s.id}
                  className={`p-5 border rounded-2xl flex flex-col justify-between space-y-4 transition-all ${
                    isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#111115]/40 border-[#262633]/60 hover:border-neutral-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-base font-bold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{s.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-mono font-bold border ${
                          isIpsHighContrast ? "bg-neutral-50 text-neutral-600 border-neutral-200" : "bg-[#111115] text-[#dfb76c] border-[#dfb76c]/30"
                        }`}>{s.paymentTerms}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Building className="w-3.5 h-3.5 shrink-0" />
                        <span>Company: {s.companyName} | Contact: {s.contactPerson}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-start">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 bg-[#121216]/40 border border-neutral-850 text-gray-400 rounded-lg hover:text-white cursor-pointer"
                        title="Edit Supplier Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSupplier(s.id)}
                        className="p-1.5 bg-[#121216]/40 border border-neutral-850 text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        title="Delete Merchant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* CONTACT & ACCOUNT DETAILS METRICS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-t border-b border-neutral-800/40 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#dfb76c] shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#dfb76c] shrink-0" />
                      <span>{s.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#dfb76c] shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </div>
                  </div>

                  {/* BOTTOM LEDGER METRICS */}
                  <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 pt-1.5">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-gray-500">VAT Number Ref</span>
                      <p className="text-xs font-mono font-bold text-gray-300">{s.vatNumber || "None Provided"}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-gray-500 block">Outstanding Balance Credit Line</span>
                      <p className={`text-base font-mono font-bold ${
                        s.outstandingBalance > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}>£{s.outstandingBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* NOTES CARD */}
                  {s.notes && (
                    <div className="p-2.5 bg-[#121216]/40 rounded-xl border border-neutral-850/60 text-[11px] text-gray-400 italic">
                      Notes: {s.notes}
                    </div>
                  )}

                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: HISTORY & PAYMENTS AUDIT TRAIL */}
        <div className="space-y-6">
          
          {/* RECENT REMITTANCES */}
          <div className={`p-4 border rounded-2xl space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#181822]/35 border-[#262633]/60"
          }`}>
            <div className="flex justify-between items-center border-b border-neutral-800/40 pb-2">
              <h3 className={`text-xs font-bold uppercase tracking-widest ${
                isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
              }`}>Remittance History</h3>
              <History className="w-4 h-4 text-gray-500" />
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {payments.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No payments logged yet.</p>
              ) : (
                payments.map(p => {
                  const merchantName = suppliers.find(s => s.id === p.supplierId)?.name || "Deleted Merchant";
                  return (
                    <div key={p.id} className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-850 text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between items-baseline">
                        <span className="font-sans font-bold text-gray-300 truncate">{merchantName}</span>
                        <span className="text-emerald-400 font-bold">£{p.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Ref: {p.reference}</span>
                        <span>{p.date}</span>
                      </div>
                      {p.notes && <p className="text-[10px] text-gray-400 italic font-sans">Notes: {p.notes}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RECENT PURCHASE INVOICE RECEIPTS */}
          <div className={`p-4 border rounded-2xl space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#181822]/35 border-[#262633]/60"
          }`}>
            <div className="flex justify-between items-center border-b border-neutral-800/40 pb-2">
              <h3 className={`text-xs font-bold uppercase tracking-widest ${
                isIpsHighContrast ? "text-neutral-900" : "text-[#dfb76c]"
              }`}>Purchase Orders</h3>
              <Landmark className="w-4 h-4 text-gray-500" />
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {purchaseHistory.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No purchase orders filed.</p>
              ) : (
                purchaseHistory.map(po => {
                  const merchantName = suppliers.find(s => s.id === po.supplierId)?.name || "Deleted Merchant";
                  return (
                    <div key={po.id} className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-850 text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between items-baseline">
                        <span className="font-sans font-bold text-gray-300 truncate">{merchantName}</span>
                        <span className="text-blue-400 font-bold">£{po.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Items: {po.items.map(i => `${i.qty}x ${i.name}`).join(", ")}</span>
                        <span>{po.date}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold inline-block border ${
                        po.status === "Received" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                      }`}>{po.status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ADD/EDIT MERCHANT DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#111115] border border-[#dfb76c]/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-[#dfb76c] uppercase tracking-widest pb-3 border-b border-neutral-850">
              {editingSupplier ? "Edit Merchant Profile" : "Register New Partner Merchant"}
            </h3>

            <form onSubmit={handleSaveSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Merchant / Supplier Name</label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#dfb76c]"
                  placeholder="e.g. Savile Row Fabrics Ltd"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Registered Company Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg"
                  placeholder="e.g. SR Fabrics SA"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Account Contact Person</label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg"
                  placeholder="e.g. James Smith"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Contact Phone</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg font-mono"
                  placeholder="+44 20 •••• ••••"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg font-mono"
                  placeholder="accounts@merchant.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Warehouse Address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg"
                  placeholder="e.g. Savile Row, Mayfair, London"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">VAT Number</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg font-mono"
                  placeholder="e.g. GB 123 4567 89"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-[#dfb76c] border border-neutral-850 rounded-lg"
                >
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Outstanding Balance Debt (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={outstandingBalance}
                  onChange={(e) => setOutstandingBalance(e.target.value)}
                  className="w-full p-2 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg font-mono"
                  placeholder="£0.00"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Merchant Notes / Procurement Memo</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg"
                  placeholder="e.g. Master fabric supplier. Delivers fabric bolts directly to tailoring workshop rooms."
                />
              </div>

              <div className="sm:col-span-2 flex gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2 border border-neutral-850 text-gray-400 rounded-lg uppercase hover:bg-neutral-800/10 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-[#dfb76c] text-black rounded-lg uppercase cursor-pointer font-bold hover:opacity-90"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD BILL PAYMENT DIALOG */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#111115] border border-[#dfb76c]/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-[#dfb76c] uppercase tracking-widest pb-3 border-b border-neutral-850">Record Supplier Remittance</h3>

            <form onSubmit={handlePostPayment} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Select Supplier Merchant</label>
                <select
                  value={paySupplierId}
                  onChange={(e) => setPaySupplierId(e.target.value)}
                  className="w-full p-2.5 bg-[#0c0d12] text-[#dfb76c] border border-neutral-850 rounded-lg"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Credit: £{s.outstandingBalance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Payment Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg font-mono"
                  placeholder="£0.00"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Reference Number / Advice Note</label>
                <input
                  type="text"
                  required
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg"
                  placeholder="e.g. REMITTANCE-SC-1002"
                />
              </div>

              <div>
                <label className="text-gray-400 uppercase tracking-wider text-[9px] block mb-1">Audit Notes</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full p-2.5 bg-[#0c0d12] text-white border border-neutral-850 rounded-lg"
                  placeholder="e.g. Bank transfer settled from Revolut corporate pool."
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-1/2 py-2 border border-neutral-850 text-gray-400 rounded-lg uppercase hover:bg-neutral-800/10 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-[#dfb76c] text-black rounded-lg uppercase cursor-pointer font-bold hover:opacity-90"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
