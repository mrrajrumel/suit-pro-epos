import React, { useState, useEffect } from "react";
import { Product } from "../types.ts";
import { getProducts, addProduct, updateProduct, deleteProduct, addSystemLog } from "../lib/db-helpers.ts";
import { parseInventorySpreadsheet, executeImportUpsert } from "../lib/import-service.ts";
import type { ImportError } from "../lib/import-service.ts";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ShieldAlert, 
  BadgePercent, 
  Save, 
  X, 
  RotateCcw, 
  Upload, 
  Download, 
  Database, 
  RefreshCw, 
  Play 
} from "lucide-react";

export default function InventoryManager({ isIpsHighContrast = false }: { isIpsHighContrast?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [formBarcode, setFormBarcode] = useState("");
  const [formName, setFormName] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formColour, setFormColour] = useState("");
  const [formCostPrice, setFormCostPrice] = useState<number | "">("");
  const [formSellingPrice, setFormSellingPrice] = useState<number | "">("");
  const [formStock, setFormStock] = useState<number | "">("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Product | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Bulk Import / Export States
  const [csvText, setCsvText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  const [validRowsCount, setValidRowsCount] = useState<number>(0);

  // Backup & Restore States
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    loadBackups();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data || []);
    } catch (err: any) {
      setErrorNotice("Failed to query catalog index: " + err.message);
    }
  }

  // Backup loading helper
  async function loadBackups() {
    try {
      const res = await fetch("/api/backup/list");
      if (res.ok) {
        const list = await res.json();
        setBackups(list || []);
      }
    } catch (err) {
      console.error("Failed to query central backup logs: ", err);
    }
  }

  // Handle new clothing item creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setNotification(null);

    if (!formBarcode.trim() || !formName.trim() || formCostPrice === "" || formSellingPrice === "" || formStock === "") {
      setErrorNotice("Please fill out all required clothing specification fields.");
      return;
    }

    // Prevent duplicate barcode constraints
    const exists = products.some(p => p.barcode === formBarcode.trim());
    if (exists) {
      setErrorNotice(`Standard Security Rule Error: A product with barcode/SKU [${formBarcode}] already exists.`);
      return;
    }

    const payload: Omit<Product, "id"> = {
      barcode: formBarcode.trim(),
      name: formName.trim(),
      size: formSize.trim() || "N/A",
      colour: formColour.trim() || "N/A",
      costPrice: Number(formCostPrice),
      sellingPrice: Number(formSellingPrice),
      stock: Number(formStock),
    };

    try {
      const newId = await addProduct(payload);
      
      // Update local storage/synced servers state
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setNotification(`Item successfully added with serial database reference ${newId}.`);
      loadProducts();
      
      // Clear forms
      setFormBarcode("");
      setFormName("");
      setFormSize("");
      setFormColour("");
      setFormCostPrice("");
      setFormSellingPrice("");
      setFormStock("");
      
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setErrorNotice("Database insert error: " + err.message);
    }
  };

  // Inline Quick Stock Adjuster
  const handleQuickStockAdjust = async (product: Product, delta: number) => {
    const updated = { ...product, stock: Math.max(0, product.stock + delta) };
    try {
      await updateProduct(updated);
      setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
      
      // Push stock update to server
      await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: updated.stock })
      });
      
      if (updated.stock <= 3) {
        await addSystemLog({
          type: "warning",
          message: `Stock level alert: [${product.name}] inventory levels edited directly to standard minimum. Remaining units: ${updated.stock}.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setErrorNotice("Failed to adjust catalog stock: " + err.message);
    }
  };

  // Editing Row logic
  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditFields({ ...product });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFields(null);
  };

  const handleSaveEdit = async () => {
    if (!editFields) return;
    try {
      await updateProduct(editFields);
      setProducts(prev => prev.map(p => p.id === editFields.id ? editFields : p));
      
      await fetch(`/api/products/${editFields.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: editFields.barcode,
          name: editFields.name,
          size: editFields.size,
          colour: editFields.colour,
          costPrice: editFields.costPrice,
          sellingPrice: editFields.sellingPrice,
          stock: editFields.stock
        })
      });

      setNotification("Sartorial inventory specifications successfully updated.");
      setEditingId(null);
      setEditFields(null);
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setErrorNotice("Inline details saver failed: " + err.message);
    }
  };

  const handleDeleteSpec = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely certain you wish to purge "${name}" from SUIT PRO catalog archives? This is irreversible.`)) {
      return;
    }
    
    try {
      await deleteProduct(id);
      await fetch(`/api/products/${id}`, { method: "DELETE" });

      setProducts(prev => prev.filter(p => p.id !== id));
      setNotification(`Purge complete: deleted product "${name}" from server files.`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setErrorNotice("Catalog purge failed: " + err.message);
    }
  };

  // Bulk import parser trigger using the robust xlsx parsing service
  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine the source file to parse
    let fileToParse: File | null = selectedFile;
    if (!fileToParse && csvText.trim()) {
      fileToParse = new File([csvText], "pasted_catalog.csv", { type: "text/csv" });
    }

    if (!fileToParse) {
      setImportError("Please drag and drop a valid spreadsheet file or paste product data in standard CSV format.");
      return;
    }

    setImportStatus("Running high-capacity spreadsheet import engine...");
    setImportError(null);

    try {
      // 1. Parse Excel/CSV sheets using xlsx package
      const { validRows, errors } = await parseInventorySpreadsheet(fileToParse);
      
      setValidationErrors(errors);
      setValidRowsCount(validRows.length);

      if (validRows.length === 0) {
        setImportError("No valid inventory rows detected in the provided file. Check formatting rules.");
        setImportStatus(null);
        return;
      }

      // 2. Commit to database and sync server repositories
      const result = await executeImportUpsert(validRows);

      setImportStatus(
        `Import execution complete: UPSERT successfully committed. Inserts: ${result.inserted}, Updates: ${result.updated}.`
      );
      
      if (errors.length > 0) {
        setNotification(`Processed with warnings: ${errors.length} row(s) failed validation.`);
      } else {
        setNotification("Inventory database successfully synchronized.");
      }

      // Reload products list configuration
      await loadProducts();
      
      // Clean up inputs on total success
      setSelectedFile(null);
      setCsvText("");
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error("Spreadsheet main import pipeline aborted: ", err);
      setImportError("Spreadsheet import pipeline failure: " + err.message);
      setImportStatus(null);
    }
  };

  // File drag & upload reader hook
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportStatus(`Loading local file details: "${file.name}"...`);
    setImportError(null);
    setValidationErrors([]);
    setValidRowsCount(0);

    // If it's a small text-readable file (like CSV), load text preview
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
      // For binary files (Excel), show loading metadata
      setCsvText(`[Binary spreadsheet: ${file.name} | Size: ${Math.round(file.size / 1024)} KB]`);
    }

    try {
      // Dynamic early feedback pre-validation
      const { validRows, errors } = await parseInventorySpreadsheet(file);
      setValidRowsCount(validRows.length);
      setValidationErrors(errors);
      setImportStatus(`Pre-validation complete for "${file.name}". ${validRows.length} active rows detected.`);
    } catch (err: any) {
      setImportError("Pre-validation file read failed: " + err.message);
    }
  };

  // Local spreadsheet exporter (Products state to CSV attachment stream)
  const handleExportProductsCsv = () => {
    if (products.length === 0) return;
    const headers = "barcode_sku,name,size,colour,cost_price,selling_price,stock_qty\n";
    const rows = products.map(p => 
      `"${p.barcode}","${p.name.replace(/"/g, '""')}","${p.size}","${p.colour}",${p.costPrice},${p.sellingPrice},${p.stock}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `suitpro_inventory_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SQL Backups Engine Triggers
  const handleCreateSqlBackup = async () => {
    setBackupLoading(true);
    setNotification(null);
    try {
      const res = await fetch("/api/backup/run", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Corporate snapshot relational dump written successfully: "${data.file_name}"`);
        loadBackups();
      } else {
        setErrorNotice(data.error || "Procedural SQL snapshot aborted.");
      }
    } catch (err: any) {
      setErrorNotice("Fail checking relational backup drivers: " + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!confirm(`Executing disaster recovery restore: This will overwrite clothing catalog records from "${fileName}". Continue?`)) {
      return;
    }
    setRestoreLoading(fileName);
    setNotification(null);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Restoration status complete. Recovered items: ${data.restored_products}, sales: ${data.restored_transactions}`);
        loadProducts();
      } else {
        setErrorNotice(data.error || "Relational SQL execution engine error.");
      }
    } catch (err: any) {
      setErrorNotice("Disaster recovery protocol aborted: " + err.message);
    } finally {
      setRestoreLoading(null);
    }
  };

  return (
    <div className={`space-y-6 min-h-screen p-1 transition-all duration-300 ${isIpsHighContrast ? "bg-[#f8f9fa] text-[#1a1a24]" : "bg-[#0a0a0c] text-gray-200"}`}>
      
      {/* HEADER SPECS */}
      <div className={`border-b pb-4 ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/60"}`}>
        <h2 className={`font-display text-2xl font-bold uppercase tracking-tight ${isIpsHighContrast ? "text-[#1a1a24]" : "text-white"}`}>Sartorial Catalog & Stock Management</h2>
        <p className={`text-xs mt-1 uppercase tracking-wider font-mono ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
          Model: Enterprise level POS inventory coordinator and master index analyzer.
        </p>
      </div>

      {notification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-emerald-400 text-xs font-mono">
          [SUCCESS] {notification}
        </div>
      )}
      {errorNotice && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-500 text-xs font-mono">
          [ERROR] {errorNotice}
        </div>
      )}

      {/* TOP SECTION: Inventory Spec Registration Form */}
      <div className={`rounded-xl p-5 shadow-lg border ${
        isIpsHighContrast ? "bg-[#ffffff] border-neutral-200" : "bg-[#121216] border-neutral-800/60"
      }`}>
        <h3 className={`font-display font-semibold text-xs uppercase tracking-widest border-b pb-3 flex items-center gap-2 ${
          isIpsHighContrast ? "text-[#1a1a24] border-neutral-200" : "text-white border-[#dfb76c]/10"
        }`}>
          Catalog Registry Form
        </h3>

        <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-xs font-sans">
          <div className="space-y-1">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>SKU / Barcode ID (Unique)</label>
            <input
              id="inv-barcode"
              type="text"
              required
              placeholder="e.g. 88008..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-[#b89047] border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-[#dfb76c] border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formBarcode}
              onChange={(e) => setFormBarcode(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Product Description Name</label>
            <input
              id="inv-name"
              type="text"
              required
              placeholder="e.g. Peak Lapel Ivory Silk Tuxedo Blazer..."
              className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Garment Size</label>
            <input
              id="inv-size"
              type="text"
              placeholder="e.g. 40R..."
              className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formSize}
              onChange={(e) => setFormSize(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Primary Colourway</label>
            <input
              id="inv-color"
              type="text"
              placeholder="e.g. Ivory Satin..."
              className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formColour}
              onChange={(e) => setFormColour(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Wholesale Cost Price (£)</label>
            <input
              id="inv-cost"
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="e.g. 200..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formCostPrice}
              onChange={(e) => setFormCostPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Retail Checkout Price (£)</label>
            <input
              id="inv-selling"
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="e.g. 550..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formSellingPrice}
              onChange={(e) => setFormSellingPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Initial Showroom Stock Qty</label>
            <input
              id="inv-stock"
              type="number"
              required
              min="0"
              placeholder="e.g. 25..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formStock}
              onChange={(e) => setFormStock(e.target.value === "" ? "" : parseInt(e.target.value))}
            />
          </div>

          <div className="md:col-span-4 flex justify-end pt-2">
            <button
              id="create-product-trigger"
              type="submit"
              className={`font-display font-semibold transition-all duration-200 px-6 py-2.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-lg uppercase tracking-wider ${
                isIpsHighContrast 
                  ? "bg-[#b89047] hover:bg-[#a67c35] text-white" 
                  : "bg-[#dfb76c] hover:bg-[#c9a35e] text-black"
              }`}
            >
              <Plus className="w-4 h-4" /> Register New Suit Specification
            </button>
          </div>
        </form>
      </div>

      {/* MID SECTION: SARTORIAL PRODUCTS LIST AND TABLE */}
      <div className={`border rounded-xl overflow-hidden shadow-lg transition-all duration-300 ${
        isIpsHighContrast 
          ? "bg-[#ffffff] border-neutral-200" 
          : "bg-[#121216] border-neutral-800/60"
      }`}>
        <div className={`px-5 py-4 border-b flex justify-between items-center ${
          isIpsHighContrast 
            ? "bg-neutral-50 border-neutral-200" 
            : "bg-[#121216]/50 border-neutral-850/60"
        }`}>
          <h3 className={`font-display font-medium text-xs uppercase tracking-widest ${isIpsHighContrast ? "text-[#1a1a24]" : "text-white"}`}>Active Stock Ledger</h3>
          <span className={`text-xs font-mono font-bold uppercase ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>Index size: {products.length} types registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`font-mono border-b uppercase text-[10px] tracking-wider ${
                isIpsHighContrast 
                  ? "bg-neutral-100/50 text-neutral-700 border-neutral-200" 
                  : "bg-[#0a0a0c] text-gray-400 border-neutral-800/60"
              }`}>
                <th className="px-4 py-3.5">SKU / Barcode</th>
                <th className="px-4 py-3.5">Clothing Item Name</th>
                <th className="px-4 py-3.5">Size/Colour</th>
                <th className="px-4 py-3.5 text-right">Cost Price</th>
                <th className="px-4 py-3.5 text-right">Selling Price</th>
                <th className="px-4 py-3.5 text-center">Profit Markup Yield</th>
                <th className="px-4 py-3.5 text-center">Floor Stock</th>
                <th className="px-4 py-3.5 text-center">Quick Adjust</th>
                <th className="px-4 py-3.5 text-center">Manage Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200" : "divide-neutral-850/60"}`}>
              {products.map(p => {
                const isEditing = editingId === p.id;
                
                // Yield calculation: Gross Margin % = (Selling - Cost) / Selling * 100
                const profitDiff = (isEditing && editFields ? editFields.sellingPrice - editFields.costPrice : p.sellingPrice - p.costPrice);
                const sellingPriceForYield = isEditing && editFields ? editFields.sellingPrice : p.sellingPrice;
                const markupPercent = sellingPriceForYield > 0 ? (profitDiff / sellingPriceForYield) * 100 : 0;
                
                return (
                  <tr key={p.id} className={`transition-all duration-200 border-b ${
                    isIpsHighContrast
                      ? "border-neutral-200 hover:bg-neutral-50/70"
                      : "border-[#dfb76c]/10 hover:bg-[#1d1d23]/40"
                  }`}>
                    
                    {/* SKU BARCODE */}
                    <td className={`px-4 py-3 font-mono font-semibold uppercase ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>
                      {isEditing && editFields ? (
                        <input
                          id={`edit-barcode-${p.id}`}
                          type="text"
                          className={`px-2 py-1 rounded w-16 text-xs text-center border focus:outline-none focus:border-[#dfb76c] ${
                            isIpsHighContrast
                              ? "bg-white text-[#b89047] border-neutral-200"
                              : "bg-[#0b0b0d] text-[#dfb76c] border-[#dfb76c]/20"
                          }`}
                          value={editFields.barcode}
                          onChange={(e) => setEditFields({ ...editFields, barcode: e.target.value })}
                        />
                      ) : p.barcode}
                    </td>

                    {/* NAME */}
                    <td className={`px-4 py-3 font-medium ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                      {isEditing && editFields ? (
                        <input
                          id={`edit-name-${p.id}`}
                          type="text"
                          className={`px-2 py-1 rounded w-full text-xs border focus:outline-none focus:border-[#dfb76c] ${
                            isIpsHighContrast
                              ? "bg-white text-neutral-800 border-neutral-200"
                              : "bg-[#0b0b0d] text-white border-[#dfb76c]/20"
                          }`}
                          value={editFields.name}
                          onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                        />
                      ) : p.name}
                    </td>

                    {/* SIZE / COLOUR */}
                    <td className={`px-4 py-3 ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                      {isEditing && editFields ? (
                        <div className="flex gap-1.5">
                          <input
                             id={`edit-size-${p.id}`}
                             type="text"
                             className={`px-2 py-1 rounded w-12 text-xs text-center border focus:outline-none focus:border-[#dfb76c] ${
                               isIpsHighContrast
                                 ? "bg-white text-neutral-800 border-neutral-200"
                                 : "bg-[#0b0b0d] text-white border-[#dfb76c]/20"
                             }`}
                             value={editFields.size}
                             onChange={(e) => setEditFields({ ...editFields, size: e.target.value })}
                          />
                          <input
                             id={`edit-colour-${p.id}`}
                             type="text"
                             className={`px-2 py-1 rounded w-16 text-xs text-center border focus:outline-none focus:border-[#dfb76c] ${
                               isIpsHighContrast
                                 ? "bg-white text-neutral-800 border-neutral-200"
                                 : "bg-[#0b0b0d] text-white border-[#dfb76c]/20"
                             }`}
                             value={editFields.colour}
                             onChange={(e) => setEditFields({ ...editFields, colour: e.target.value })}
                          />
                        </div>
                      ) : `${p.size || "N/A"} / ${p.colour || "N/A"}`}
                    </td>

                    {/* COST PRICE */}
                    <td className={`px-4 py-3 text-right font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-300"}`}>
                      {isEditing && editFields ? (
                        <input
                          id={`edit-cost-${p.id}`}
                          type="number"
                          step="0.01"
                          className={`px-1.5 py-1 rounded w-16 text-xs text-right border focus:outline-none focus:border-[#dfb76c] font-mono ${
                            isIpsHighContrast
                              ? "bg-white text-neutral-800 border-neutral-200"
                              : "bg-[#0b0b0d] text-white border-[#dfb76c]/20"
                          }`}
                          value={editFields.costPrice}
                          onChange={(e) => setEditFields({ ...editFields, costPrice: parseFloat(e.target.value) || 0 })}
                        />
                      ) : `£${p.costPrice.toFixed(2)}`}
                    </td>

                    {/* SELLING PRICE */}
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                      {isEditing && editFields ? (
                        <input
                          id={`edit-selling-${p.id}`}
                          type="number"
                          step="0.01"
                          className={`px-1.5 py-1 rounded w-16 text-xs text-right border focus:outline-none focus:border-[#dfb76c] font-mono ${
                            isIpsHighContrast
                              ? "bg-white text-[#b89047] border-neutral-200"
                              : "bg-[#0b0b0d] text-[#dfb76c] border-[#dfb76c]/20"
                          }`}
                          value={editFields.sellingPrice}
                          onChange={(e) => setEditFields({ ...editFields, sellingPrice: parseFloat(e.target.value) || 0 })}
                        />
                      ) : `£${p.sellingPrice.toFixed(2)}`}
                    </td>

                    {/* YIELD MARGIN ANALYZER */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                          +{markupPercent.toFixed(1)}% Yield
                        </span>
                        <span className={`text-[9px] font-mono ${isIpsHighContrast ? "text-neutral-500" : "text-gray-500"}`}>£{profitDiff.toFixed(2)} Net</span>
                      </div>
                    </td>

                    {/* STOCK LEVEL */}
                    <td className="px-4 py-3 text-center">
                      {isEditing && editFields ? (
                        <input
                          id={`edit-stock-${p.id}`}
                          type="number"
                          className={`px-2 py-0.5 rounded w-12 text-xs text-center font-mono border focus:outline-none focus:border-[#dfb76c] ${
                            isIpsHighContrast
                              ? "bg-white text-neutral-850 border-neutral-200"
                              : "bg-[#0b0b0d] text-white border-[#dfb76c]/20"
                          }`}
                          value={editFields.stock}
                          onChange={(e) => setEditFields({ ...editFields, stock: parseInt(e.target.value) || 0 })}
                        />
                      ) : (
                        <span className={`inline-block px-2.5 py-1 rounded-full font-bold font-mono text-[10px] ${
                          p.stock === 0 
                            ? "bg-red-500/15 text-red-500 border border-red-500/20" 
                            : p.stock <= 3 
                              ? isIpsHighContrast
                                ? "bg-amber-550/10 text-[#b89047] border border-amber-500/20 animate-pulse"
                                : "bg-amber-500/10 text-[#dfb76c] border border-amber-500/20 animate-pulse" 
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        }`}>
                          {p.stock === 0 ? "DEPLETED" : `${p.stock} Unit(s)`}
                        </span>
                      )}
                    </td>

                    {/* QUICK ADJUST BUTTONS */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1 font-mono text-xs font-bold">
                        <button
                          id={`stock-dec-${p.id}`}
                          onClick={() => handleQuickStockAdjust(p, -1)}
                          className={`border px-2 py-1 rounded transition-all duration-200 cursor-pointer ${
                            isIpsHighContrast
                              ? "bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700"
                              : "bg-[#0b0b0d] hover:bg-gray-800 border-neutral-800/60 text-gray-400 hover:text-white"
                          }`}
                        >
                          -1
                        </button>
                        <button
                          id={`stock-inc-${p.id}`}
                          onClick={() => handleQuickStockAdjust(p, 1)}
                          className={`border px-2 py-1 rounded transition-all duration-200 cursor-pointer ${
                            isIpsHighContrast
                              ? "bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700"
                              : "bg-[#0b0b0d] hover:bg-gray-800 border-neutral-800/60 text-gray-400 hover:text-white"
                          }`}
                        >
                          +1
                        </button>
                      </div>
                    </td>

                    {/* EDIT ACTIONS */}
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex justify-center gap-2">
                          <button
                            id={`edit-save-${p.id}`}
                            onClick={handleSaveEdit}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded transition-colors cursor-pointer"
                            title="Confirm specifications"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`edit-cancel-${p.id}`}
                            onClick={cancelEditing}
                            className={`p-1 rounded transition-all duration-200 cursor-pointer ${
                              isIpsHighContrast
                                ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                                : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                            }`}
                            title="Abort changes"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-1.5">
                          <button
                            id={`edit-start-${p.id}`}
                            onClick={() => startEditing(p)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isIpsHighContrast
                                ? "text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100"
                                : "text-gray-500 hover:text-white hover:bg-gray-800"
                            }`}
                            title="Edit clothing spec row"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`purge-${p.id}`}
                            onClick={() => handleDeleteSpec(p.id, p.name)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isIpsHighContrast
                                ? "text-neutral-500 hover:text-red-600 hover:bg-red-50"
                                : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                            }`}
                            title="Purge clothing catalog item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* IMPLEMENTATION BLOCK 2: UNIFIED BULK SPREADSHEET MANAGER PANE & BACKUP RESTORE MODULE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        
        {/* BULK MANAGER PANE */}
        <div className={`rounded-xl p-5 shadow-lg flex flex-col justify-between border transition-all duration-300 ${
          isIpsHighContrast 
            ? "bg-[#ffffff] border-neutral-200" 
            : "bg-[#121216] border-neutral-800/60"
        }`}>
          <div>
            <h3 className={`font-display font-semibold text-xs uppercase tracking-widest border-b pb-3 flex items-center gap-2 ${
              isIpsHighContrast 
                ? "text-[#1a1a24] border-neutral-200" 
                : "text-white border-neutral-850/60"
            }`}>
              <Upload className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} /> Unified Bulk Spreadsheet Manager
            </h3>
            
            <p className={`text-xs mt-2 ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
              Upload core inventory dataset files (.csv, .xlsx, .xls format) to register large catalogs, or export the active listings database.
            </p>

            <div className={`rounded-lg p-2.5 mt-3 text-[9px] font-mono uppercase tracking-wider block border ${
              isIpsHighContrast 
                ? "bg-neutral-50 text-neutral-500 border-neutral-200" 
                : "bg-[#0a0a0c] text-gray-500 border-neutral-800/60"
            }`}>
              Format Rule: barcode_sku, name, size, colour, cost_price, selling_price, stock_qty
            </div>

            <form onSubmit={handleBulkImportSubmit} className="mt-4 space-y-3">
              <div className="flex flex-col items-center justify-center w-full">
                <label className={`flex flex-col items-center justify-center w-full h-24 border border-dashed rounded-lg cursor-pointer transition-all ${
                  isIpsHighContrast 
                    ? "border-neutral-300 hover:border-[#b89047] bg-neutral-50 hover:bg-neutral-100" 
                    : "border-[#dfb76c]/20 hover:border-[#dfb76c]/40 bg-[#0e0e11] hover:bg-[#1d1d23]"
                }`}>
                  <div className="flex flex-col items-center justify-center pt-4 pb-4">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Drag & Drop Excel / CSV Sheet</p>
                    <p className="text-[10px] text-gray-500 mt-1">Select from computer storage</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".csv,.xlsx,.xls"
                    className="hidden" 
                    onChange={handleCsvFileUpload}
                  />
                </label>
              </div>

              {csvText && (
                <div className="space-y-1">
                  <label className={`text-[10px] font-mono block ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>Loaded Data Preview:</label>
                  <textarea
                    rows={4}
                    readOnly
                    className={`w-full rounded p-2 text-[10px] font-mono border focus:outline-none focus:border-[#dfb76c] ${
                      isIpsHighContrast
                        ? "bg-neutral-50 border-neutral-200 text-neutral-800"
                        : "bg-[#0b0b0d] border-[#dfb76c]/10 text-gray-400"
                    }`}
                    value={csvText}
                  />
                </div>
              )}

              {validRowsCount > 0 && (
                <div className="text-[10px] font-mono text-emerald-500 flex items-center justify-between uppercase">
                  <span>Pre-validated Row Count:</span>
                  <span className="font-bold">{validRowsCount} items ready</span>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className={`rounded-lg p-2.5 mt-2 border ${
                  isIpsHighContrast
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-rose-950/20 border-rose-500/10 text-rose-350"
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Validation Outliers Report ({validationErrors.length})
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[9px] uppercase">
                    {validationErrors.map((err, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-2 border-b border-rose-500/5 pb-1">
                        <span className="opacity-75">Row {err.row}:</span>
                        <span className={`font-mono text-xs ${isIpsHighContrast ? "text-neutral-700" : "text-[#dfb76c]"}`}>{err.barcode}</span>
                        <span className="text-right text-rose-400 max-w-[180px] break-all">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importStatus && (
                <p className="text-[10px] font-mono text-emerald-400 uppercase">[STATUS] {importStatus}</p>
              )}
              {importError && (
                <p className="text-[10px] font-mono text-rose-500 uppercase">[ERROR] {importError}</p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className={`font-display font-semibold transition-all duration-200 px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer ${
                    isIpsHighContrast
                      ? "bg-[#b89047] hover:bg-[#a67c35] text-white font-bold"
                      : "bg-[#dfb76c] hover:bg-[#c9a35e] text-[#0e0e11]"
                  }`}
                >
                  Process Bulk Catalog Import
                </button>
                <button
                  type="button"
                  onClick={handleExportProductsCsv}
                  className={`border transition-all duration-200 px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 ${
                    isIpsHighContrast
                      ? "border-neutral-300 hover:border-[#b89047] text-neutral-700 hover:text-[#b89047] bg-white hover:bg-neutral-50 font-bold"
                      : "bg-transparent border-[#dfb76c]/30 hover:border-[#dfb76c] text-[#dfb76c] hover:text-white"
                  }`}
                >
                  <Download className="w-3.5 h-3.5" /> Export Catalog Database
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* BACKUP & RESTORE MODULE */}
        <div className={`rounded-xl p-5 shadow-lg flex flex-col justify-between border transition-all duration-300 ${
          isIpsHighContrast 
            ? "bg-[#ffffff] border-neutral-200" 
            : "bg-[#121216] border-neutral-800/60"
        }`}>
          <div>
            <h3 className={`font-display font-semibold text-xs uppercase tracking-widest border-b pb-3 flex items-center gap-2 ${
              isIpsHighContrast 
                ? "text-[#1a1a24] border-neutral-200" 
                : "text-white border-neutral-850/60"
            }`}>
              <Database className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} /> Relational Backup & Disaster Recovery
            </h3>

            <p className={`text-xs mt-2 ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
              Create instant relational SQL commit snapshots of products catalog, ledger invoices and configurations. Re-inject backups seamlessly.
            </p>

            <button
              onClick={handleCreateSqlBackup}
              disabled={backupLoading}
              className={`mt-4 font-display font-bold px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer disabled:opacity-55 transition-all duration-200 ${
                isIpsHighContrast
                  ? "bg-[#b89047] hover:bg-[#a67c35] text-white"
                  : "bg-[#dfb76c] hover:bg-[#c9a35e] text-[#0e0e11]"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${backupLoading ? "animate-spin" : ""}`} />
              {backupLoading ? "Constructing Backup Dump..." : "Generate SQL Relational Backup"}
            </button>

            <div className="mt-5 space-y-2">
              <h4 className={`text-[10px] uppercase tracking-wider font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-400"}`}>Available Database Backups:</h4>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                {backups.length === 0 ? (
                  <p className="text-gray-600 italic py-2">No active snapshot files detected in cloud directory.</p>
                ) : (
                  backups.map((bak, idx) => (
                    <div key={idx} className={`rounded-lg p-2 flex justify-between items-center border transition-all duration-200 ${
                      isIpsHighContrast
                        ? "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
                        : "bg-[#0b0b0d] border-neutral-800 hover:border-[#dfb76c]/20"
                    }`}>
                      <div>
                        <div className={`font-semibold truncate max-w-[200px] ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{bak.file_name}</div>
                        <div className="text-gray-500 text-[9px]">{bak.size_kb} KB | {new Date(bak.created_at).toLocaleString("en-GB")}</div>
                      </div>
                      <button
                        onClick={() => handleRestoreBackup(bak.file_name)}
                        disabled={restoreLoading !== null}
                        className={`px-2.5 py-1 rounded transition-all duration-200 text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer border ${
                          isIpsHighContrast
                            ? "border-neutral-300 hover:border-emerald-600 hover:bg-emerald-50 text-neutral-700 hover:text-emerald-700 font-bold"
                            : "bg-transparent border-[#dfb76c]/30 hover:bg-[#dfb76c] text-[#dfb76c] hover:text-[#0e0e11] font-bold"
                        }`}
                      >
                        {restoreLoading === bak.file_name ? "Executing Restore..." : "Restore Database"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
