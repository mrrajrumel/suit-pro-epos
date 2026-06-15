import * as XLSX from "xlsx";

export interface ValidProductRow {
  barcode: string;
  name: string;
  size: string;
  colour: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
}

export interface ImportError {
  row: number;
  barcode: string;
  message: string;
}

/**
 * Parses raw Excel (XLSX, XLS) or CSV spreadsheets using the 'xlsx' library.
 * Validates mandatory fields and data formats, generating validation errors for non-compliant inventory rows.
 */
export async function parseInventorySpreadsheet(
  file: File
): Promise<{ validRows: ValidProductRow[]; errors: ImportError[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          return resolve({
            validRows: [],
            errors: [{ row: 0, barcode: "FILE_READ", message: "Failed to read binary information from local spreadsheet handle." }]
          });
        }

        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return resolve({
            validRows: [],
            errors: [{ row: 0, barcode: "SHEET_EMPTY", message: "No active worksheets found in the target document." }]
          });
        }

        const worksheet = workbook.Sheets[sheetName];
        
        // Convert worksheet to raw array grid containing primitive rows
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

        if (rows.length === 0) {
          return resolve({
            validRows: [],
            errors: [{ row: 0, barcode: "EMPTY_FILE", message: "Document contains zero rows." }]
          });
        }

        const validRows: ValidProductRow[] = [];
        const errors: ImportError[] = [];

        // Check if there's a header line that we need to skip
        let startIdx = 0;
        const firstRow = rows[0];
        const isHeader = firstRow.some((cell: any) => {
          const s = String(cell || "").toLowerCase();
          return s.includes("barcode") || s.includes("sku") || s.includes("name") || s.includes("price") || s.includes("stock") || s.includes("colour") || s.includes("size");
        });

        if (isHeader) {
          startIdx = 1;
        }

        // Parse individual rows
        for (let i = startIdx; i < rows.length; i++) {
          const rawRow = rows[i];
          if (!rawRow || rawRow.length === 0) continue;

          // Check if row is physically blank/empty
          const isBlank = rawRow.every((val) => val === undefined || val === null || String(val).trim() === "");
          if (isBlank) continue;

          const rowNum = i + 1; // 1-indexed Excel user coordinates

          const rawBarcode = rawRow[0] !== undefined ? String(rawRow[0]).trim() : "";
          const name = rawRow[1] !== undefined ? String(rawRow[1]).trim() : "";
          const size = rawRow[2] !== undefined ? String(rawRow[2]).trim() : "N/A";
          const colour = rawRow[3] !== undefined ? String(rawRow[3]).trim() : "N/A";
          const rawCost = rawRow[4];
          const rawSelling = rawRow[5];
          const rawStock = rawRow[6];

          // 1. Validate Barcode SKU
          if (!rawBarcode) {
            errors.push({
              row: rowNum,
              barcode: "MISSING",
              message: "Required value Barcode SKU is absent or blank."
            });
            continue;
          }

          // 2. Validate Product Name
          if (!name) {
            errors.push({
              row: rowNum,
              barcode: rawBarcode,
              message: "Required product Name column is absent."
            });
            continue;
          }

          // 3. Validate Cost Price
          const costPrice = parseFloat(String(rawCost || 0));
          if (isNaN(costPrice) || costPrice < 0) {
            errors.push({
              row: rowNum,
              barcode: rawBarcode,
              message: `Cost price "${rawCost}" must be a valid positive decimal value.`
            });
            continue;
          }

          // 4. Validate Selling Price
          const sellingPrice = parseFloat(String(rawSelling || 0));
          if (isNaN(sellingPrice) || sellingPrice < 0) {
            errors.push({
              row: rowNum,
              barcode: rawBarcode,
              message: `Selling price "${rawSelling}" must be a valid positive decimal value.`
            });
            continue;
          }

          // 5. Validate Stock Quantity
          const stock = parseInt(String(rawStock !== "" && rawStock !== undefined ? rawStock : 0), 10);
          if (isNaN(stock) || stock < 0) {
            errors.push({
              row: rowNum,
              barcode: rawBarcode,
              message: `Stock level "${rawStock}" must be a valid positive integer value.`
            });
            continue;
          }

          // Add to valid rows
          validRows.push({
            barcode: rawBarcode,
            name,
            size: size || "N/A",
            colour: colour || "N/A",
            costPrice,
            sellingPrice,
            stock
          });
        }

        resolve({ validRows, errors });
      } catch (err: any) {
        resolve({
          validRows: [],
          errors: [{ row: 0, barcode: "EXCEPTION", message: `Parsing error encountered: ${err.message}` }]
        });
      }
    };

    reader.onerror = () => {
      reject(new Error("Unable to read local binary file handle."));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Commits pre-validated inventory rows directly into the system warehouse repository through a batch transaction.
 */
export async function executeImportUpsert(
  validRows: ValidProductRow[]
): Promise<{ inserted: number; updated: number }> {
  const response = await fetch("/api/products/bulk-upsert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ products: validRows })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Batch database synchronization aborted.");
  }

  return response.json();
}
