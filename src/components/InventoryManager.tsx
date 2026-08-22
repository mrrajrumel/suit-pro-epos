import React, { useState, useEffect } from "react";
// ExcelJS is lazy-loaded in export functions to avoid large frontend bundles
import { ParentProduct, ProductVariation } from "../types.ts";
import { getProducts, addProduct, updateProduct, deleteProduct, addSystemLog } from "../lib/db-helpers.ts";
import { parseInventorySpreadsheet, executeImportUpsert } from "../lib/import-service.ts";
import type { ImportError } from "../lib/import-service.ts";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Printer,
  ShieldAlert, 
  BadgePercent, 
  Save, 
  X, 
  RotateCcw, 
  Upload, 
  Download, 
  Database, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  QrCode
} from "lucide-react";
import { requestPrintPreview } from "../lib/print-preview.ts";
import { refreshCatalogFromServer } from "../lib/catalog-service.ts";
import QRCode from "qrcode";

export default function InventoryManager({ isIpsHighContrast = false }: { isIpsHighContrast?: boolean }) {
  const [products, setProducts] = useState<ParentProduct[]>([]);
  
  // Parent Form States
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Tuxedo");
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("suitpro_categories");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.every((category) => typeof category === "string")
        ? parsed
        : ["Tuxedo", "Suits", "Jackets", "Trousers", "Shirts"];
    } catch {
      return ["Tuxedo", "Suits", "Jackets", "Trousers", "Shirts"];
    }
  });
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const handleAddCustomCategory = () => {
    const clean = newCategoryInput.trim();
    if (!clean) return;
    if (!categoriesList.includes(clean)) {
      const updated = [...categoriesList, clean];
      setCategoriesList(updated);
      localStorage.setItem("suitpro_categories", JSON.stringify(updated));
      setFormCategory(clean);
      setNotification(`Category "${clean}" has been added dynamically!`);
      setTimeout(() => setNotification(null), 3000);
    } else {
      setFormCategory(clean);
    }
    setNewCategoryInput("");
    setIsAddingCategory(false);
  };

  const [formBrand, setFormBrand] = useState("SUIT PRO");
  const [formSupplier, setFormSupplier] = useState("Savile Row");
  const [formUnit, setFormUnit] = useState("PCS");
  const [formCostPrice, setFormCostPrice] = useState<number | "">("");
  const [formSellingPrice, setFormSellingPrice] = useState<number | "">("");
  const [formStock, setFormStock] = useState<number | "">(10);
  const [formShortDescription, setFormShortDescription] = useState("");

  // Dynamic Attribute States
  const [customAttributes, setCustomAttributes] = useState<Array<{ name: string; values: string[] }>>([
    { name: "Color", values: ["Midnight Blue", "Classic Black"] },
    { name: "Size", values: ["38R", "40R"] }
  ]);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValue, setNewAttrValue] = useState<Record<string, string>>({}); // key is attrName, value is current single value text

  // Variation List Generated from Attributes
  const [formVariations, setFormVariations] = useState<ProductVariation[]>([]);

  // Expandable parent rows
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  // Editing States for specific variation
  const [editingVariationId, setEditingVariationId] = useState<string | null>(null);
  const [editVarSku, setEditVarSku] = useState("");
  const [editVarBarcode, setEditVarBarcode] = useState("");
  const [editVarStock, setEditVarStock] = useState<number>(0);
  const [editVarCost, setEditVarCost] = useState<number>(0);
  const [editVarSelling, setEditVarSelling] = useState<number>(0);

  // Notification states
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

  // QR / Barcode Scanner Search State & Handler
  const [qrScanInput, setQrScanInput] = useState("");
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  const hasCatalogCollision = (parentId: string | null, variations: ProductVariation[]) => {
    const seen = new Set<string>();
    for (const variation of variations) {
      const sku = variation.sku.trim().toLowerCase();
      const barcode = variation.barcode.trim().toLowerCase();
      if (!sku || !barcode || seen.has(sku) || seen.has(barcode)) return true;
      seen.add(sku);
      seen.add(barcode);
    }
    const existingCodes = new Set(products
      .filter((parent) => parent.id !== parentId)
      .flatMap((parent) => (parent.variations || []).flatMap((variation) => [
        variation.sku.trim().toLowerCase(),
        variation.barcode.trim().toLowerCase()
      ]))
      .filter(Boolean));
    return variations.some((variation) => existingCodes.has(variation.sku.trim().toLowerCase()) || existingCodes.has(variation.barcode.trim().toLowerCase()));
  };

  const resetForm = () => {
    setFormName("");
    setFormCostPrice("");
    setFormSellingPrice("");
    setFormStock("");
    setFormShortDescription("");
    setFormCategory("Tuxedo");
    setFormBrand("SUIT PRO");
    setFormSupplier("Savile Row");
    setFormUnit("PCS");
    setCustomAttributes([]);
    setFormVariations([]);
    setEditingParentId(null);
  };

  const handleLoadParentToForm = (parent: ParentProduct) => {
    setEditingParentId(parent.id);
    setFormName(parent.name || "");
    setFormCategory(parent.category || "Tuxedo");
    setFormBrand(parent.brand || "SUIT PRO");
    setFormSupplier(parent.supplier || "Savile Row");
    setFormUnit(parent.unit || "PCS");
    setFormShortDescription(parent.shortDescription || "");
    setFormCostPrice(parent.purchasePrice || "");
    setFormSellingPrice(parent.sellingPrice || "");
    setFormStock("");
    setCustomAttributes(parent.attributes || []);
    setFormVariations(parent.variations || []);
    setNotification(`Loaded "${parent.name}" into the form for editing.`);
    setErrorNotice(null);
    
    // Scroll smoothly to the form
    const formEl = document.getElementById("inv-name");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const toggleLabelSelection = (variationId: string) => {
    setSelectedLabelIds(prev => prev.includes(variationId) ? prev.filter(id => id !== variationId) : [...prev, variationId]);
  };

  const buildQrSvg = (parent: ParentProduct, variation: ProductVariation, size = 180) => QRCode.toString(
    JSON.stringify({ productId: parent.id, variationId: variation.id, sku: variation.sku.trim(), barcode: variation.barcode.trim() }),
    { type: "svg", width: size, margin: 2, errorCorrectionLevel: "M" }
  );

  const handleExportInventoryXlsx = async (exportSelected = false) => {
    const flatItems = products.flatMap(parent => (parent.variations || []).map(variation => ({
      id: variation.id,
      parentName: parent.name,
      category: parent.category || "Unassigned",
      brand: parent.brand || "SUIT PRO",
      supplier: parent.supplier || "Savile Row",
      combo: Object.values(variation.attributeValues || {}).join(" / ") || "Standard",
      sku: variation.sku || "",
      barcode: variation.barcode || "",
      stock: variation.stock || 0,
      costPrice: variation.purchasePrice || parent.purchasePrice || 0,
      sellingPrice: variation.sellingPrice || parent.sellingPrice || 0
    })));

    const itemsToExport = exportSelected ? flatItems.filter(item => selectedLabelIds.includes(item.id)) : flatItems;
    if (itemsToExport.length === 0) {
      setErrorNotice(exportSelected ? "Select at least one variation before exporting to Excel." : "No inventory rows are available to export.");
      setTimeout(() => setErrorNotice(null), 3000);
      return;
    }

    try {
      const excelModule = await import('exceljs');
      const ExcelJS = (excelModule && (excelModule.default || excelModule)) as any;
      if (!ExcelJS || typeof ExcelJS.Workbook !== 'function') {
        throw new Error('ExcelJS workbook factory unavailable.');
      }
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Inventory");

      sheet.columns = [
        { header: "Parent Product", key: "parentName", width: 28 },
        { header: "Category", key: "category", width: 16 },
        { header: "Brand", key: "brand", width: 14 },
        { header: "Supplier", key: "supplier", width: 16 },
        { header: "Variation", key: "combo", width: 24 },
        { header: "SKU", key: "sku", width: 18 },
        { header: "Barcode", key: "barcode", width: 18 },
        { header: "Stock", key: "stock", width: 10 },
        { header: "Cost Price", key: "costPrice", width: 12 },
        { header: "Selling Price", key: "sellingPrice", width: 12 }
      ];

      sheet.addRows(itemsToExport.map(item => ({
        parentName: item.parentName,
        category: item.category,
        brand: item.brand,
        supplier: item.supplier,
        combo: item.combo,
        sku: item.sku,
        barcode: item.barcode,
        stock: item.stock,
        costPrice: Number(item.costPrice).toFixed(2),
        sellingPrice: Number(item.sellingPrice).toFixed(2)
      })));

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDFB76C" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getColumn(1).numFmt = "@";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `SUITPRO_INVENTORY_${exportSelected ? "SELECTED" : "ALL"}_${Date.now()}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotification(`Inventory export completed for ${itemsToExport.length} item${itemsToExport.length > 1 ? "s" : ""}.`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setErrorNotice(`Excel export failed: ${err.message || "Unknown error"}`);
      setTimeout(() => setErrorNotice(null), 4000);
    }
  };

  const handlePrintBarcodeLabels = async (printAll = false) => {
    const flatItems = products.flatMap(parent => (parent.variations || []).map(variation => ({
      id: variation.id,
      parentName: parent.name,
      sku: variation.sku || "",
      barcode: variation.barcode || "",
      combo: Object.values(variation.attributeValues || {}).join(" / ")
    })));

    const itemsToPrint = printAll ? flatItems : flatItems.filter(item => selectedLabelIds.includes(item.id));
    if (itemsToPrint.length === 0) {
      setErrorNotice("Select at least one variation before printing barcode labels.");
      setTimeout(() => setErrorNotice(null), 3000);
      return;
    }

    const printWindow = { document: {
      write: (html: string) => requestPrintPreview({ title: "Barcode Labels", html, paperSize: "A4" }),
      close: () => undefined
    } };

    let qrMarkup: string[];
    try {
      qrMarkup = await Promise.all(itemsToPrint.map(async (item) => {
        const parent = products.find((candidate) => candidate.variations.some((variation) => variation.id === item.id));
        const variation = parent?.variations.find((candidate) => candidate.id === item.id);
        if (!parent || !variation) throw new Error(`Variation ${item.id} is no longer in the catalog.`);
        return buildQrSvg(parent, variation);
      }));
    } catch (error) {
      setErrorNotice(`QR label generation failed: ${error instanceof Error ? error.message : "Unknown QR error"}`);
      return;
    }
    const labelMarkup = itemsToPrint.map((item, index) => `
      <div class="label-card">
        <div class="label-title">${item.parentName}</div>
        <div class="label-subtitle">${item.combo || "Standard"}</div>
        <div class="label-code">SKU: ${item.sku}</div>
        <div class="label-barcode">${item.barcode}</div>
        <div class="label-qr">${qrMarkup[index]}</div>
      </div>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; }
            .label-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 16px; }
            .label-card { border: 1px solid #cbd5e1; background: white; border-radius: 10px; padding: 14px; page-break-inside: avoid; }
            .label-title { font-size: 13px; font-weight: 700; color: #0f172a; }
            .label-subtitle { font-size: 11px; color: #475569; margin-top: 3px; }
            .label-code { font-size: 11px; color: #334155; margin-top: 8px; font-family: monospace; }
            .label-barcode { font-size: 13px; font-weight: 700; margin-top: 6px; color: #111827; font-family: monospace; }
            .label-qr { margin-top: 10px; display: flex; justify-content: center; }
            @media print { body { background: white; } .label-card { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="label-grid">${labelMarkup}</div>
          <!-- Auto-print disabled: require manual print from UI to prevent unintended spooling -->
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleQrCodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent accidental form submission of main form
      const code = qrScanInput.trim();
      const normalizedCode = code.toLowerCase();
      if (!code) return;

      let foundParent: ParentProduct | undefined;
      let foundVar: any = null;

      // Find matching product variation or parent barcode
      for (const p of products) {
        if (p.variations) {
          const matchedV = p.variations.find(v => v.barcode.trim().toLowerCase() === normalizedCode || v.sku.trim().toLowerCase() === normalizedCode);
          if (matchedV) {
            foundParent = p;
            foundVar = matchedV;
            break;
          }
        }
        if (p.id.trim().toLowerCase() === normalizedCode) {
          foundParent = p;
          break;
        }
      }

      if (foundParent) {
        // Pre-fill parent form states
        setEditingParentId(foundParent.id);
        setFormName(foundParent.name || "");
        setFormCategory(foundParent.category || "Tuxedo");
        setFormBrand(foundParent.brand || "SUIT PRO");
        setFormSupplier(foundParent.supplier || "Savile Row");
        setFormUnit(foundParent.unit || "PCS");
        setFormShortDescription(foundParent.shortDescription || "");

        if (foundParent.attributes) {
          setCustomAttributes(foundParent.attributes);
        }

        if (foundVar) {
          setFormCostPrice(foundVar.purchasePrice || foundParent.purchasePrice || "");
          setFormSellingPrice(foundVar.sellingPrice || foundParent.sellingPrice || "");
          setFormStock(foundVar.stock || 0);
          setFormVariations(foundParent.variations || []);

          // Expand parent in ledger
          setExpandedParentIds(prev => {
            const next = new Set(prev);
            next.add(foundParent!.id);
            return next;
          });

          // Open inline editor for this variation after short delay
          setTimeout(() => {
            startEditingVariation(foundVar);
            
            // Scroll to the selected variation if element exists
            const btnId = `btn-verify-${foundVar.barcode}`;
            const el = document.getElementById(btnId);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 150);

          setNotification(`Successfully found & autofilled variant: "${foundParent.name}" (${Object.values(foundVar.attributeValues || {}).join(" / ")})`);
        } else {
          setFormCostPrice(foundParent.purchasePrice || "");
          setFormSellingPrice(foundParent.sellingPrice || "");
          setFormStock("");
          setFormVariations(foundParent.variations || []);

          setNotification(`Successfully found & autofilled master product: "${foundParent.name}"`);
        }

        setErrorNotice(null);
        setQrScanInput(""); // Clear for next scan
      } else {
        setErrorNotice(`No matching product or variation found for barcode/QR: "${code}"`);
        setTimeout(() => setErrorNotice(null), 5000);
      }
    }
  };

  useEffect(() => {
    loadProducts();
    loadBackups();
  }, []);

  async function loadProducts() {
    try {
      const data = await refreshCatalogFromServer().catch(() => getProducts());
      setProducts(data || []);
    } catch (err: any) {
      setErrorNotice("Failed to query catalog index: " + err.message);
    }
  }

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

  // Cartesian combinations helper
  const cartesianCombinations = (attributes: Array<{ name: string; values: string[] }>) => {
    if (attributes.length === 0) return [];
    let results: Array<Record<string, string>> = [{}];
    for (const attr of attributes) {
      if (attr.values.length === 0) continue;
      const temp: Array<Record<string, string>> = [];
      for (const res of results) {
        for (const val of attr.values) {
          temp.push({
            ...res,
            [attr.name]: val
          });
        }
      }
      results = temp;
    }
    return results.filter(obj => Object.keys(obj).length > 0);
  };

  // Keep Cartesian variations synchronized with forms state
  useEffect(() => {
    if (editingParentId) {
      // Guard to preserve existing customized variations/barcodes during editing
      return;
    }
    const combos = cartesianCombinations(customAttributes);
    const vars = combos.map((combo, idx) => {
      const initials = formName ? formName.split(" ").map(w => w[0]).join("").toUpperCase() : "SP";
      const cleanCombo = Object.values(combo).join("-").toUpperCase().replace(/\s+/g, "");
      return {
        id: `v-new-${idx}-${Date.now()}`,
        sku: `${initials}-${cleanCombo}-${100 + idx}`,
        barcode: String(5010000000000 + (Date.now() % 100000000) + idx),
        purchasePrice: Number(formCostPrice || 0),
        sellingPrice: Number(formSellingPrice || 0),
        wholesalePrice: Number(formSellingPrice || 0) * 0.8,
        discountPrice: Number(formSellingPrice || 0),
        offerPrice: 0,
        stock: Number(formStock || 0),
        attributeValues: combo
      };
    });
    setFormVariations(vars);
  }, [customAttributes, formCostPrice, formSellingPrice, formStock, formName, editingParentId]);

  // Manage custom attributes builders
  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    if (customAttributes.some(a => a.name.toLowerCase() === newAttrName.trim().toLowerCase())) {
      setErrorNotice("Attribute name already exists.");
      return;
    }
    setCustomAttributes([...customAttributes, { name: newAttrName.trim(), values: [] }]);
    setNewAttrName("");
  };

  const handleRemoveAttribute = (index: number) => {
    const copy = [...customAttributes];
    copy.splice(index, 1);
    setCustomAttributes(copy);
  };

  const handleAddAttributeValue = (attrName: string) => {
    const pendingVal = newAttrValue[attrName]?.trim();
    if (!pendingVal) return;
    
    setCustomAttributes(prev => prev.map(attr => {
      if (attr.name === attrName) {
        if (attr.values.includes(pendingVal)) return attr;
        return { ...attr, values: [...attr.values, pendingVal] };
      }
      return attr;
    }));

    setNewAttrValue(prev => ({ ...prev, [attrName]: "" }));
  };

  const handleRemoveAttributeValue = (attrName: string, valToRemove: string) => {
    setCustomAttributes(prev => prev.map(attr => {
      if (attr.name === attrName) {
        return { ...attr, values: attr.values.filter(v => v !== valToRemove) };
      }
      return attr;
    }));
  };

  // Add customized variation creation
  const handleCreateProductParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setNotification(null);

    if (!formName.trim()) {
      setErrorNotice("Please fill out the master product Name.");
      return;
    }

    if (formVariations.length === 0) {
      setErrorNotice("Please configure at least one combination attribute value (e.g. at least one Color or Size option).");
      return;
    }

    const payloadId = editingParentId || `p-${Date.now()}`;
    const parentPayload: ParentProduct = {
      id: payloadId,
      name: formName.trim(),
      category: formCategory,
      brand: formBrand,
      supplier: formSupplier,
      unit: formUnit,
      purchasePrice: Number(formCostPrice || 0),
      sellingPrice: Number(formSellingPrice || 0),
      wholesalePrice: Number((formSellingPrice || 0) * 0.8),
      discountPrice: Number(formSellingPrice || 0),
      offerPrice: 0,
      taxRatePct: 20.00,
      minStockAlert: 2,
      images: ["https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&auto=format&fit=crop&q=60"],
      shortDescription: formShortDescription.trim() || `${formBrand} ${formName}`,
      fullDescription: "",
      specifications: "",
      features: "",
      warrantyInfo: "",
      returnPolicy: "",
      productNotes: "",
      attributes: customAttributes,
      variations: formVariations
    };

    if (hasCatalogCollision(editingParentId, formVariations)) {
      setErrorNotice("Each variation must have a unique non-empty SKU and barcode.");
      return;
    }

    try {
      const url = editingParentId ? `/api/products/${editingParentId}` : "/api/products";
      const method = editingParentId ? "PUT" : "POST";

      // Send Parent product payload to backend
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentPayload)
      });

      const responseData: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const errData = responseData as { error?: string } | null;
        throw new Error(errData?.error || `Failed to save catalog parent with method ${method}.`);
      }
      if (!responseData || typeof responseData !== "object" || (responseData as ParentProduct).id !== payloadId || !Array.isArray((responseData as ParentProduct).variations)) {
        throw new Error("Catalog save returned an incomplete product record.");
      }

      // Refresh lists locally
      setNotification(
        editingParentId 
          ? `Product "${formName}" updated successfully.` 
          : `Parent garment "${formName}" created successfully with ${formVariations.length} variations.`
      );
      await refreshCatalogFromServer();
      await loadProducts();

      // Reset Form Fields
      resetForm();
      
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setErrorNotice("Database transaction error: " + err.message);
    }
  };

  // Delete Parent Product
  const handleDeleteParent = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely certain you wish to purge "${name}" and all associated variations? This is irreversible.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to purge on server.");

      await refreshCatalogFromServer();
      await loadProducts();
      setNotification(`Product "${name}" deleted successfully.`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setErrorNotice("Purge failed: " + err.message);
    }
  };

  // Adjust Variation Stock Level Directly
  const handleQuickVariationStockAdjust = async (parent: ParentProduct, varId: string, delta: number) => {
    const updatedParent = { ...parent };
    const variationIdx = updatedParent.variations.findIndex(v => v.id === varId);
    if (variationIdx === -1) return;

    const variation = updatedParent.variations[variationIdx];
    const nextStock = (variation.stock || 0) + Math.trunc(delta);
    if (nextStock < 0) {
      setErrorNotice("Stock cannot be reduced below zero.");
      return;
    }
    variation.stock = nextStock;

    try {
      const res = await fetch(`/api/products/${parent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedParent)
      });

      if (!res.ok) throw new Error("Failed to save variation stock update on server.");

      await refreshCatalogFromServer();
      await loadProducts();
      
      if (variation.stock <= 3) {
        await addSystemLog({
          type: "warning",
          message: `Stock level alert: [${parent.name} - SKU:${variation.sku}] edited. Remaining: ${variation.stock} units.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setErrorNotice("Failed to adjust variation stock: " + err.message);
    }
  };

  // inline Editing for Variation Row
  const startEditingVariation = (v: any) => {
    setEditingVariationId(v.id);
    setEditVarSku(v.sku);
    setEditVarBarcode(v.barcode);
    setEditVarStock(v.stock);
    setEditVarCost(v.purchasePrice);
    setEditVarSelling(v.sellingPrice);
  };

  const handleSaveVariationEdit = async (parent: ParentProduct, varId: string) => {
    const updatedParent = { ...parent };
    const variationIdx = updatedParent.variations.findIndex(v => v.id === varId);
    if (variationIdx === -1) return;

    updatedParent.variations[variationIdx] = {
      ...updatedParent.variations[variationIdx],
      sku: editVarSku.trim(),
      barcode: editVarBarcode.trim(),
      stock: Math.max(0, Math.trunc(Number(editVarStock) || 0)),
      purchasePrice: Number(editVarCost),
      sellingPrice: Number(editVarSelling)
    };

    if (hasCatalogCollision(parent.id, updatedParent.variations)) {
      setErrorNotice("Each variation must have a unique non-empty SKU and barcode.");
      return;
    }

    try {
      const res = await fetch(`/api/products/${parent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedParent)
      });

      if (!res.ok) throw new Error("Failed to save variation modifications.");

      await refreshCatalogFromServer();
      await loadProducts();
      setEditingVariationId(null);
      setNotification("Variation updated successfully.");
      setTimeout(() => setNotification(null), 2500);
    } catch (err: any) {
      setErrorNotice("Failed to save variation: " + err.message);
    }
  };

  const toggleParentExpand = (id: string) => {
    const newSet = new Set(expandedParentIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedParentIds(newSet);
  };

  // Helper to compute overall stock and price range for parent card
  const getParentStockSum = (p: ParentProduct) => {
    if (!p.variations) return 0;
    return p.variations.reduce((sum, v) => sum + (v.stock || 0), 0);
  };

  const getParentPriceRange = (p: ParentProduct) => {
    if (!p.variations || p.variations.length === 0) return `£${Number(p.sellingPrice).toFixed(2)}`;
    const prices = p.variations.map(v => Number(v.sellingPrice));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `£${min.toFixed(2)}`;
    return `£${min.toFixed(2)} - £${max.toFixed(2)}`;
  };

  // Backup handlers
  const handleCreateSqlBackup = async () => {
    setBackupLoading(true);
    setErrorNotice(null);
    try {
      const res = await fetch("/api/backup/run", { method: "POST" });
      if (res.ok) {
        setNotification("Enterprise database SQL snapshot saved successfully.");
        loadBackups();
      } else {
        const errorText = await res.text();
        setErrorNotice("SQL Snapshot compilation failed: " + errorText);
      }
    } catch (err: any) {
      setErrorNotice("Network timeout or connection refused: " + err.message);
    } finally {
      setBackupLoading(false);
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!confirm(`Warning: Restoring "${fileName}" will overwrite current live tables. Proceed?`)) {
      return;
    }
    setRestoreLoading(fileName);
    setErrorNotice(null);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName })
      });
      if (res.ok) {
        setNotification(`Disaster Recovery complete: snapshot [${fileName}] injected.`);
        loadProducts();
      } else {
        const errorText = await res.text();
        setErrorNotice("Backup injection failed: " + errorText);
      }
    } catch (err: any) {
      setErrorNotice("Restore service error: " + err.message);
    } finally {
      setRestoreLoading(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Drag and Drop csv reader
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setCsvText(evt.target?.result as string || "");
      };
      reader.readAsText(file);
    }
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let fileToParse: File | null = selectedFile;
    if (!fileToParse && csvText.trim()) {
      fileToParse = new File([csvText], "pasted_catalog.csv", { type: "text/csv" });
    }

    if (!fileToParse) {
      setImportError("Please drag/drop an Excel sheet or enter catalog CSV text.");
      return;
    }

    setImportStatus("Importing spreadsheet rows...");
    setImportError(null);

    try {
      const { validRows, errors } = await parseInventorySpreadsheet(fileToParse);
      setValidationErrors(errors);
      setValidRowsCount(validRows.length);

      if (validRows.length === 0) {
        setImportError("No valid rows found in file.");
        setImportStatus(null);
        return;
      }

      await executeImportUpsert(validRows);
      setImportStatus(`Success! Synced ${validRows.length} flat garments. Reconstructing parents catalog...`);
      loadProducts();
    } catch (err: any) {
      setImportError("Import failed: " + err.message);
      setImportStatus(null);
    }
  };

  const handleExportProductsCsv = () => {
    // Generate simple flat csv row representation
    const headers = "barcode_sku,name,size,colour,cost_price,selling_price,stock_qty\n";
    const rows = products.flatMap(p => {
      if (p.variations && p.variations.length > 0) {
        return p.variations.map(v => {
          const comboStr = Object.values(v.attributeValues || {}).join(" / ");
          return `"${v.barcode}","${p.name} - ${comboStr}","${v.attributeValues?.["Size"] || "N/A"}","${v.attributeValues?.["Color"] || "N/A"}",${v.purchasePrice},${v.sellingPrice},${v.stock}`;
        });
      } else {
        return [`"${p.id}","${p.name}","N/A","N/A",${p.purchasePrice},${p.sellingPrice},0`];
      }
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.setAttribute("href", url);
    anchor.setAttribute("download", `SUITPRO_INVENTORY_${Date.now()}.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDemoTemplate = () => {
    const headers = "barcode_sku,name,size,colour,cost_price,selling_price,stock_qty\n";
    const demoRows = [
      `"5012345678901","Royal Peak Lapel Tuxedo - Black / 40R","40R","Black",120.00,350.00,12`,
      `"5012345678902","Royal Peak Lapel Tuxedo - Navy / 38R","38R","Navy",120.00,350.00,8`,
      `"5012345678903","Italian Double Breasted Suit - Charcoal / 42L","42L","Charcoal",150.00,450.00,15`,
      `"5012345678904","Classic Tailored White Shirt - White / 15.5","15.5","White",25.00,75.00,25`
    ].join("\n");

    const blob = new Blob([headers + demoRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.setAttribute("href", url);
    anchor.setAttribute("download", `SUITPRO_INVENTORY_DEMO_TEMPLATE.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    
    setNotification("Demo spreadsheet import template downloaded successfully! Update and upload.");
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* ALERTS AND STATUS LOG NOTIFIERS */}
      {notification && (
        <div id="inv-success-banner" className={`p-4 rounded-xl border flex items-center gap-3 animate-slide-up ${
          isIpsHighContrast ? "bg-emerald-50 text-emerald-800 border-emerald-250" : "bg-emerald-950/20 text-emerald-300 border-emerald-500/10"
        }`}>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider">{notification}</p>
        </div>
      )}

      {errorNotice && (
        <div id="inv-error-banner" className={`p-4 rounded-xl border flex items-center gap-3 animate-slide-up ${
          isIpsHighContrast ? "bg-rose-50 text-rose-800 border-rose-250" : "bg-rose-950/20 text-rose-400 border-rose-500/10"
        }`}>
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider">{errorNotice}</p>
        </div>
      )}

      {/* IMPLEMENTATION BLOCK 1: CREATE NEW PRODUCT WITH MULTI-ATTRIBUTE VARIATIONS */}
      <div className={`p-6 border rounded-2xl shadow-xl transition-all duration-300 ${
        isIpsHighContrast 
          ? "bg-white border-neutral-250" 
          : "bg-[#111115]/80 border-neutral-800/60"
      }`}>
        <div className="flex items-center justify-between border-b border-neutral-800/60 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className={`font-display font-medium text-sm uppercase tracking-widest ${isIpsHighContrast ? "text-[#1a1a24]" : "text-amber-500"}`}>
              {editingParentId ? "Edit / Update Existing Bespoke Garment" : "Register Custom Bespoke Garment & Cartesian Combinations"}
            </h2>
          </div>
          {editingParentId && (
            <button
              type="button"
              onClick={resetForm}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                isIpsHighContrast ? "bg-red-100 hover:bg-red-200 text-red-700" : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
              }`}
            >
              Cancel Edit & Clear Form
            </button>
          )}
        </div>

        {/* QR Scanner & Autofill Assist Field */}
        <div className={`mb-6 p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isIpsHighContrast 
            ? "bg-neutral-50 border-neutral-250 text-neutral-800" 
            : "bg-[#0b0b0f] border-neutral-800/60 text-gray-300"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isIpsHighContrast ? "bg-amber-100 text-amber-850" : "bg-amber-500/10 text-amber-500"}`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="font-mono font-bold text-[11px] uppercase tracking-wider text-amber-500">
                QR/Barcode Scan & Autofill Assist
              </h4>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Scan old manual QR/barcodes to auto-fill details, expand active ledger & start instant editing!
              </p>
            </div>
          </div>
          
          <div className="flex-1 max-w-md w-full">
            <div className="relative">
              <input
                type="text"
                placeholder="Scan QR or Enter Barcode / SKU..."
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-xs font-mono focus:outline-none transition-all ${
                  isIpsHighContrast
                    ? "bg-white text-neutral-800 border-neutral-300 focus:border-[#b89047]"
                    : "bg-[#111115] text-white border-neutral-800 focus:border-[#dfb76c]"
                }`}
                value={qrScanInput}
                onChange={(e) => setQrScanInput(e.target.value)}
                onKeyDown={handleQrCodeScan}
              />
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <QrCode className="w-3.5 h-3.5 text-neutral-500" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateProductParent} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="md:col-span-2 space-y-1 text-left">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Bespoke Product Name</label>
            <input
              id="inv-name"
              type="text"
              required
              placeholder="e.g. Savile Row Peak Tuxedo..."
              className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div className="space-y-1 text-left">
            <div className="flex justify-between items-center">
              <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Category Classification</label>
              <button
                type="button"
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className={`text-[9px] uppercase tracking-wider font-bold transition-colors cursor-pointer ${
                  isIpsHighContrast ? "text-[#b89047] hover:text-[#a67c35]" : "text-[#dfb76c] hover:text-[#edd19b]"
                }`}
              >
                {isAddingCategory ? "← Back to List" : "+ Add Custom"}
              </button>
            </div>
            
            {isAddingCategory ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. Waistcoats, Belts..."
                  className={`flex-1 px-3 py-1.5 rounded border text-xs focus:outline-none transition-all duration-200 ${
                    isIpsHighContrast 
                      ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                      : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
                  }`}
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase transition-colors cursor-pointer ${
                    isIpsHighContrast ? "bg-[#b89047] text-white hover:bg-[#a67c35]" : "bg-[#dfb76c] text-black hover:bg-[#edd19b]"
                  }`}
                >
                  Save
                </button>
              </div>
            ) : (
              <select
                id="inv-category"
                className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                  isIpsHighContrast 
                    ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                    : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
                }`}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1 text-left">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Tailoring Unit</label>
            <input
              id="inv-unit"
              type="text"
              required
              placeholder="e.g. PCS, Box..."
              className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formUnit}
              onChange={(e) => setFormUnit(e.target.value)}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Default Purchase Price (GBP)</label>
            <input
              id="inv-cost"
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="e.g. 250..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formCostPrice}
              onChange={(e) => setFormCostPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Default Selling Price (GBP)</label>
            <input
              id="inv-selling"
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="e.g. 699..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formSellingPrice}
              onChange={(e) => setFormSellingPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Default Stock Combinations</label>
            <input
              id="inv-stock"
              type="number"
              required
              min="0"
              placeholder="e.g. 10..."
              className={`w-full font-mono px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formStock}
              onChange={(e) => setFormStock(e.target.value === "" ? "" : parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={`block font-mono uppercase tracking-wider text-[10px] ${isIpsHighContrast ? "text-neutral-550" : "text-gray-400"}`}>Luxury Brand / House</label>
            <input
              id="inv-brand"
              type="text"
              required
              className={`w-full px-3 py-2 rounded border focus:outline-none transition-all duration-200 ${
                isIpsHighContrast 
                  ? "bg-[#f8f9fa] text-neutral-800 border-neutral-200 focus:border-[#b89047]" 
                  : "bg-[#0a0a0c] text-white border-neutral-800/60 focus:border-[#dfb76c]"
              }`}
              value={formBrand}
              onChange={(e) => setFormBrand(e.target.value)}
            />
          </div>

          {/* DYNAMIC CUSTOM ATTRIBUTE BUILDER SECTION */}
          <div className="md:col-span-4 border-t border-dashed border-neutral-800/60 pt-4 mt-2 space-y-4 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className={`font-mono uppercase tracking-wider text-xs font-bold ${isIpsHighContrast ? "text-neutral-800" : "text-amber-500"}`}>
                Configure Options & Attributes (Shopify/WooCommerce Mode)
              </h3>
              
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="New Attribute (e.g. Size, Custom...)"
                  className={`px-2.5 py-1.5 rounded text-xs border focus:outline-none ${
                    isIpsHighContrast 
                      ? "bg-[#f8f9fa] border-neutral-200 text-neutral-800" 
                      : "bg-[#0c0c0e] border-neutral-800/60 text-white"
                  }`}
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddAttribute}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    isIpsHighContrast ? "bg-neutral-800 text-white hover:bg-neutral-900" : "bg-neutral-900 hover:bg-neutral-800 text-amber-500 border border-neutral-800"
                  }`}
                >
                  + Add Custom Attribute
                </button>
              </div>
            </div>

            {/* Render List of Active Attributes and Values */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customAttributes.map((attr, aIdx) => (
                <div key={attr.name} className={`p-4 rounded-xl border space-y-3 relative ${
                  isIpsHighContrast ? "bg-neutral-50/50 border-neutral-200" : "bg-[#0c0c0f] border-neutral-800/60"
                }`}>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(aIdx)}
                    className="absolute top-2.5 right-2.5 text-gray-500 hover:text-red-500 transition-colors text-xs"
                    title="Remove Attribute Type"
                  >
                    ✕
                  </button>

                  <h4 className={`text-xs font-mono uppercase tracking-wider font-bold ${isIpsHighContrast ? "text-neutral-800" : "text-gray-300"}`}>
                    Option: {attr.name}
                  </h4>

                  <div className="flex flex-wrap gap-1.5">
                    {attr.values.map(val => (
                      <span
                        key={val}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          isIpsHighContrast 
                            ? "bg-neutral-200 text-neutral-800" 
                            : "bg-neutral-900 text-gray-300 border border-neutral-800"
                        }`}
                      >
                        {val}
                        <button
                          type="button"
                          onClick={() => handleRemoveAttributeValue(attr.name, val)}
                          className="hover:text-red-500 text-[9px] ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder={`Add ${attr.name} value (e.g. S, XL...)`}
                      className={`flex-1 px-2 py-1 rounded text-xs border focus:outline-none ${
                        isIpsHighContrast 
                          ? "bg-white border-neutral-200 text-neutral-800" 
                          : "bg-[#121216] border-neutral-850 text-white"
                      }`}
                      value={newAttrValue[attr.name] || ""}
                      onChange={(e) => setNewAttrValue({ ...newAttrValue, [attr.name]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAttributeValue(attr.name);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAttributeValue(attr.name)}
                      className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                        isIpsHighContrast ? "bg-neutral-200 hover:bg-neutral-300 text-neutral-800" : "bg-neutral-900 hover:bg-neutral-800 text-white"
                      }`}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AUTO-GENERATED CARTESIAN COMBINATIONS GRID PREVIEW */}
          {formVariations.length > 0 && (
            <div className="md:col-span-4 border-t border-neutral-800/60 pt-4 space-y-2.5 text-left">
              <h4 className={`text-xs font-mono uppercase tracking-wider font-bold ${isIpsHighContrast ? "text-neutral-800" : "text-amber-500"}`}>
                Auto-Generated Combinations Preview ({formVariations.length} combinations detected)
              </h4>
              <p className="text-[11px] text-neutral-400">
                Configure separate pricing, barcodes, or custom stock counts for individual options below before database registration.
              </p>

              <div className="max-h-60 overflow-y-auto border border-neutral-800/60 rounded-xl overflow-hidden shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`font-mono border-b text-[10px] uppercase tracking-wider ${
                      isIpsHighContrast ? "bg-neutral-100 text-neutral-600" : "bg-neutral-950 text-neutral-400"
                    }`}>
                      <th className="px-4 py-2">Combination Options</th>
                      <th className="px-4 py-2">SKU</th>
                      <th className="px-4 py-2">Barcode</th>
                      <th className="px-4 py-2 text-center w-20">Stock</th>
                      <th className="px-4 py-2 text-right w-24">Purchase Price</th>
                      <th className="px-4 py-2 text-right w-24">Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200 bg-white" : "divide-neutral-850/60 bg-[#08080a]"}`}>
                    {formVariations.map((v, vIdx) => {
                      const comboName = Object.values(v.attributeValues).join(" / ");
                      return (
                        <tr key={v.id} className="hover:bg-neutral-900/40">
                          <td className="px-4 py-2 font-semibold text-white">{comboName}</td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              className={`px-2 py-0.5 rounded w-full font-mono text-[11px] border ${
                                isIpsHighContrast ? "bg-white text-neutral-800" : "bg-[#111115] text-gray-300 border-neutral-800"
                              }`}
                              value={v.sku}
                              onChange={(e) => {
                                const copy = [...formVariations];
                                copy[vIdx].sku = e.target.value;
                                setFormVariations(copy);
                              }}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              className={`px-2 py-0.5 rounded w-full font-mono text-[11px] border ${
                                isIpsHighContrast ? "bg-white text-neutral-800" : "bg-[#111115] text-gray-300 border-neutral-800"
                              }`}
                              value={v.barcode}
                              onChange={(e) => {
                                const copy = [...formVariations];
                                copy[vIdx].barcode = e.target.value;
                                setFormVariations(copy);
                              }}
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              className={`px-2 py-0.5 rounded w-16 font-mono text-[11px] text-center border ${
                                isIpsHighContrast ? "bg-white text-neutral-800" : "bg-[#111115] text-gray-300 border-neutral-800"
                              }`}
                              value={v.stock}
                              onChange={(e) => {
                                const copy = [...formVariations];
                                copy[vIdx].stock = parseInt(e.target.value) || 0;
                                setFormVariations(copy);
                              }}
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              className={`px-2 py-0.5 rounded w-20 font-mono text-[11px] text-right border ${
                                isIpsHighContrast ? "bg-white text-neutral-800" : "bg-[#111115] text-gray-300 border-neutral-800"
                              }`}
                              value={v.purchasePrice}
                              onChange={(e) => {
                                const copy = [...formVariations];
                                copy[vIdx].purchasePrice = parseFloat(e.target.value) || 0;
                                setFormVariations(copy);
                              }}
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              className={`px-2 py-0.5 rounded w-20 font-mono text-[11px] text-right border ${
                                isIpsHighContrast ? "bg-white text-neutral-800" : "bg-[#111115] text-gray-300 border-neutral-800"
                              }`}
                              value={v.sellingPrice}
                              onChange={(e) => {
                                const copy = [...formVariations];
                                copy[vIdx].sellingPrice = parseFloat(e.target.value) || 0;
                                setFormVariations(copy);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
              {editingParentId ? (
                <>
                  <Save className="w-4 h-4" /> Update Product Parent & Variations
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Save Parent Product with Variations
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MID SECTION: EXPANDABLE PARENT PRODUCTS LEDGER */}
      <div className={`border rounded-xl overflow-hidden shadow-lg transition-all duration-300 ${
        isIpsHighContrast 
          ? "bg-[#ffffff] border-neutral-200" 
          : "bg-[#121216] border-neutral-800/60"
      }`}>
        <div className={`px-5 py-4 border-b flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center ${
          isIpsHighContrast 
            ? "bg-neutral-50 border-neutral-200" 
            : "bg-[#121216]/50 border-neutral-850/60"
        }`}>
          <h3 className={`font-display font-medium text-xs uppercase tracking-widest ${isIpsHighContrast ? "text-[#1a1a24]" : "text-white"}`}>Active Bespoke Ledger</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-mono font-bold uppercase ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>Catalog size: {products.length} parent products</span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${isIpsHighContrast ? "border-neutral-300 text-neutral-700" : "border-neutral-700 text-gray-400"}`}>
              {selectedLabelIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedLabelIds(products.flatMap(p => (p.variations || []).map(v => v.id)))}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isIpsHighContrast ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-neutral-700 text-gray-300 hover:border-amber-500 hover:text-amber-400"}`}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedLabelIds([])}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isIpsHighContrast ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-neutral-700 text-gray-300 hover:border-amber-500 hover:text-amber-400"}`}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleExportInventoryXlsx(true)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isIpsHighContrast ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-neutral-700 text-gray-300 hover:border-amber-500 hover:text-amber-400"}`}
            >
              <Download className="w-3.5 h-3.5" /> Export Selected XLSX
            </button>
            <button
              type="button"
              onClick={() => handleExportInventoryXlsx(false)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isIpsHighContrast ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-neutral-700 text-gray-300 hover:border-amber-500 hover:text-amber-400"}`}
            >
              <Download className="w-3.5 h-3.5" /> Export All XLSX
            </button>
            <button
              type="button"
              onClick={() => handlePrintBarcodeLabels(false)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isIpsHighContrast ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-neutral-700 text-gray-300 hover:border-amber-500 hover:text-amber-400"}`}
            >
              <Printer className="w-3.5 h-3.5" /> Print Selected Labels
            </button>
            <button
              type="button"
              onClick={() => handlePrintBarcodeLabels(true)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isIpsHighContrast ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-neutral-700 text-gray-300 hover:border-amber-500 hover:text-amber-400"}`}
            >
              <Printer className="w-3.5 h-3.5" /> Print All Labels
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`font-mono border-b uppercase text-[10px] tracking-wider ${
                isIpsHighContrast 
                  ? "bg-neutral-100/50 text-neutral-700 border-neutral-200" 
                  : "bg-[#0a0a0c] text-gray-400 border-neutral-800/60"
              }`}>
                <th className="px-4 py-3.5 w-10"></th>
                <th className="px-4 py-3.5">Bespoke Product Name</th>
                <th className="px-4 py-3.5 font-mono">Category</th>
                <th className="px-4 py-3.5 font-mono">Brand</th>
                <th className="px-4 py-3.5 font-mono">Supplier</th>
                <th className="px-4 py-3.5 font-mono text-center">Variations</th>
                <th className="px-4 py-3.5 font-mono text-right">Price Range</th>
                <th className="px-4 py-3.5 font-mono text-center">Total Stock</th>
                <th className="px-4 py-3.5 font-mono text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200" : "divide-neutral-850/60"}`}>
              {products.map(p => {
                const isExpanded = expandedParentIds.has(p.id);
                return (
                  <React.Fragment key={p.id}>
                    {/* Main parent product row */}
                    <tr className={`transition-all duration-200 border-b cursor-pointer ${
                      isIpsHighContrast
                        ? "border-neutral-200 hover:bg-neutral-50"
                        : "border-[#dfb76c]/10 hover:bg-[#1d1d23]/40"
                    }`} onClick={() => toggleParentExpand(p.id)}>
                      
                      <td className="px-4 py-3 text-center">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-550" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </td>

                      <td className={`px-4 py-3 font-medium text-sm ${isIpsHighContrast ? "text-neutral-900 font-semibold" : "text-white font-semibold"}`}>
                        {p.name}
                      </td>

                      <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-300"}`}>
                        {p.category}
                      </td>

                      <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-300"}`}>
                        {p.brand}
                      </td>

                      <td className={`px-4 py-3 font-mono ${isIpsHighContrast ? "text-neutral-600" : "text-gray-300"}`}>
                        {p.supplier}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          isIpsHighContrast ? "bg-neutral-100 text-neutral-800" : "bg-neutral-900 text-[#dfb76c]"
                        }`}>
                          {p.variations?.length || 0} variants
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-sm text-green-400 font-mono">
                        {getParentPriceRange(p)}
                      </td>

                      <td className="px-4 py-3 text-center font-mono">
                        <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          getParentStockSum(p) === 0
                            ? "bg-red-500/15 text-red-500 border border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        }`}>
                          {getParentStockSum(p)} units
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadParentToForm(p)}
                            className={`p-1.5 rounded hover:bg-amber-500/10 text-gray-400 hover:text-amber-500 transition-colors cursor-pointer`}
                            title="Edit parent product details & variations"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParent(p.id, p.name)}
                            className={`p-1.5 rounded hover:bg-rose-500/10 text-gray-400 hover:text-red-500 transition-colors cursor-pointer`}
                            title="Purge parent garment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>

                    {/* Expandable variations details roll */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className={`p-4 ${isIpsHighContrast ? "bg-neutral-50/50" : "bg-[#0b0b0e]"}`}>
                          <div className={`border rounded-xl p-3 ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"}`}>
                            <h4 className={`text-[10px] font-mono uppercase tracking-wider font-bold mb-2.5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>
                              Variation Options Breakdown
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="font-mono text-[9px] uppercase text-gray-500 tracking-wider border-b border-neutral-800 pb-1">
                                    <th className="py-2 text-center">Print</th>
                                    <th className="py-2">Options Combination</th>
                                    <th className="py-2 font-mono">SKU / Code</th>
                                    <th className="py-2 font-mono">Barcode</th>
                                    <th className="py-2 font-mono text-center">Boutique Stock</th>
                                    <th className="py-2 font-mono text-right">Cost (GBP)</th>
                                    <th className="py-2 font-mono text-right">Retail (GBP)</th>
                                    <th className="py-2 font-mono text-center">Quick Stock Adjust</th>
                                    <th className="py-2 font-mono text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className={`divide-y ${isIpsHighContrast ? "divide-neutral-200" : "divide-neutral-850/60"}`}>
                                  {p.variations?.map(v => {
                                    const isEditingVar = editingVariationId === v.id;
                                    const comboLabel = Object.values(v.attributeValues || {}).join(" / ");
                                    return (
                                      <tr key={v.id} className="hover:bg-neutral-900/10 transition-colors">
                                        <td className="py-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={selectedLabelIds.includes(v.id)}
                                            onChange={() => toggleLabelSelection(v.id)}
                                            className="h-3.5 w-3.5 rounded border-neutral-700 bg-transparent"
                                          />
                                        </td>
                                        
                                        <td className="py-2 font-semibold text-white">{comboLabel}</td>
                                        
                                        <td className="py-2 font-mono text-neutral-400">
                                          {isEditingVar ? (
                                            <input
                                              type="text"
                                              className="px-1.5 py-0.5 rounded bg-black border border-neutral-800 text-[11px] font-mono w-32"
                                              value={editVarSku}
                                              onChange={(e) => setEditVarSku(e.target.value)}
                                            />
                                          ) : v.sku || "N/A"}
                                        </td>

                                        <td className="py-2 font-mono text-neutral-400">
                                          {isEditingVar ? (
                                            <input
                                              type="text"
                                              className="px-1.5 py-0.5 rounded bg-black border border-neutral-800 text-[11px] font-mono w-32"
                                              value={editVarBarcode}
                                              onChange={(e) => setEditVarBarcode(e.target.value)}
                                            />
                                          ) : v.barcode || "N/A"}
                                        </td>

                                        <td className="py-2 text-center font-mono font-bold">
                                          {isEditingVar ? (
                                            <input
                                              type="number"
                                              className="px-1.5 py-0.5 rounded bg-black border border-neutral-800 text-[11px] font-mono text-center w-14"
                                              value={editVarStock}
                                              onChange={(e) => setEditVarStock(parseInt(e.target.value) || 0)}
                                            />
                                          ) : (
                                            <span className={v.stock <= 2 ? "text-red-500 font-bold" : "text-green-400"}>
                                              {v.stock} unit(s)
                                            </span>
                                          )}
                                        </td>

                                        <td className="py-2 text-right font-mono text-neutral-400">
                                          {isEditingVar ? (
                                            <input
                                              type="number"
                                              step="0.01"
                                              className="px-1.5 py-0.5 rounded bg-black border border-neutral-800 text-[11px] font-mono text-right w-16"
                                              value={editVarCost}
                                              onChange={(e) => setEditVarCost(parseFloat(e.target.value) || 0)}
                                            />
                                          ) : `£${Number(v.purchasePrice || p.purchasePrice || 0).toFixed(2)}`}
                                        </td>

                                        <td className="py-2 text-right font-mono font-semibold text-white">
                                          {isEditingVar ? (
                                            <input
                                              type="number"
                                              step="0.01"
                                              className="px-1.5 py-0.5 rounded bg-black border border-neutral-800 text-[11px] font-mono text-right w-16"
                                              value={editVarSelling}
                                              onChange={(e) => setEditVarSelling(parseFloat(e.target.value) || 0)}
                                            />
                                          ) : `£${Number(v.sellingPrice || p.sellingPrice || 0).toFixed(2)}`}
                                        </td>

                                        <td className="py-2 text-center">
                                          <div className="flex justify-center gap-1 font-mono">
                                            <button
                                              type="button"
                                              onClick={() => handleQuickVariationStockAdjust(p, v.id, -1)}
                                              className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 hover:text-white"
                                            >
                                              -1
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickVariationStockAdjust(p, v.id, 1)}
                                              className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 hover:text-white"
                                            >
                                              +1
                                            </button>
                                          </div>
                                        </td>

                                        <td className="py-2 text-center">
                                          {isEditingVar ? (
                                            <div className="flex justify-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => handleSaveVariationEdit(p, v.id)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded transition-colors cursor-pointer"
                                              >
                                                <Save className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setEditingVariationId(null)}
                                                className="bg-gray-800 hover:bg-gray-750 text-neutral-400 p-1 rounded transition-colors cursor-pointer"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => startEditingVariation(v)}
                                              className="text-gray-500 hover:text-white transition-colors"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </td>

                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOWER BULK SPREADSHEET MANAGER & SQL DISASTER RECOVERYSnapshots */}
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

            <form onSubmit={handleBulkImportSubmit} className="mt-4 space-y-3 text-left">
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

              <div className="flex flex-wrap gap-2.5 pt-2">
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
                  onClick={handleDownloadDemoTemplate}
                  className={`border transition-all duration-200 px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 ${
                    isIpsHighContrast
                      ? "border-amber-600/30 hover:border-[#b89047] text-amber-700 hover:text-[#b89047] bg-white hover:bg-neutral-50 font-bold"
                      : "bg-transparent border-[#dfb76c]/30 hover:border-[#dfb76c] text-[#dfb76c] hover:text-[#edd19b]"
                  }`}
                >
                  <Download className="w-3.5 h-3.5 animate-pulse" /> Export Demo Template
                </button>
                <button
                  type="button"
                  onClick={handleExportProductsCsv}
                  className={`border transition-all duration-200 px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 ${
                    isIpsHighContrast
                      ? "border-neutral-300 hover:border-[#b89047] text-neutral-700 hover:text-[#b89047] bg-white hover:bg-neutral-50 font-bold"
                      : "bg-transparent border-neutral-800 hover:border-neutral-700 text-gray-400 hover:text-white"
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

            <div className="mt-5 space-y-2 text-left">
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
