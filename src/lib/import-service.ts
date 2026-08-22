// ExcelJS is large; load dynamically when needed to avoid bundling into main frontend chunk

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

function parseCsvTextToRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeRows(rows: Array<Array<unknown>>): Array<Array<unknown>> {
  return rows
    .filter((row) => Array.isArray(row) && row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map((row) => row.map((cell) => (cell === undefined || cell === null ? "" : cell)));
}

async function readSpreadsheetRows(file: File): Promise<Array<Array<unknown>>> {
  const lowerName = file.name.toLowerCase();
  const isCsv = lowerName.endsWith(".csv") || file.type.includes("csv");

  if (isCsv) {
    const text = await file.text();
    return normalizeRows(parseCsvTextToRows(text));
  }

  const buffer = await file.arrayBuffer();
  let ExcelJS: any;
  try {
    const excelModule = await import('exceljs');
    ExcelJS = (excelModule && (excelModule.default || excelModule)) as any;
  } catch (loadErr) {
    throw new Error('Spreadsheet engine is unavailable. Please install the Excel support package or use CSV files instead.');
  }

  if (!ExcelJS || typeof ExcelJS.Workbook !== 'function') {
    throw new Error('Spreadsheet engine could not be initialized.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    return [];
  }

  const rows: Array<Array<unknown>> = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1));
  });

  return normalizeRows(rows);
}

/**
 * Parses raw CSV or Excel spreadsheet data and validates mandatory fields.
 */
export async function parseInventorySpreadsheet(
  file: File
): Promise<{ validRows: ValidProductRow[]; errors: ImportError[] }> {
  try {
    const rows = await readSpreadsheetRows(file);

    if (rows.length === 0) {
      return {
        validRows: [],
        errors: [{ row: 0, barcode: "EMPTY_FILE", message: "Document contains zero rows." }]
      };
    }

    const validRows: ValidProductRow[] = [];
    const errors: ImportError[] = [];

    let startIdx = 0;
    const firstRow = rows[0];
    const isHeader = firstRow.some((cell: unknown) => {
      const s = String(cell || "").toLowerCase();
      return s.includes("barcode") || s.includes("sku") || s.includes("name") || s.includes("price") || s.includes("stock") || s.includes("colour") || s.includes("size");
    });

    if (isHeader) {
      startIdx = 1;
    }

    for (let index = startIdx; index < rows.length; index += 1) {
      const rawRow = rows[index];
      if (!rawRow || rawRow.length === 0) continue;

      const isBlank = rawRow.every((val) => val === undefined || val === null || String(val).trim() === "");
      if (isBlank) continue;

      const rowNum = index + 1;
      const rawBarcode = rawRow[0] !== undefined ? String(rawRow[0]).trim() : "";
      const name = rawRow[1] !== undefined ? String(rawRow[1]).trim() : "";
      const size = rawRow[2] !== undefined ? String(rawRow[2]).trim() : "N/A";
      const colour = rawRow[3] !== undefined ? String(rawRow[3]).trim() : "N/A";
      const rawCost = rawRow[4];
      const rawSelling = rawRow[5];
      const rawStock = rawRow[6];

      if (!rawBarcode) {
        errors.push({
          row: rowNum,
          barcode: "MISSING",
          message: "Required value Barcode SKU is absent or blank."
        });
        continue;
      }

      if (!name) {
        errors.push({
          row: rowNum,
          barcode: rawBarcode,
          message: "Required product Name column is absent."
        });
        continue;
      }

      const costText = String(rawCost ?? "0").trim();
      const costPrice = Number(costText);
      if (!/^\d+(\.\d+)?$/.test(costText) || !Number.isFinite(costPrice) || costPrice < 0) {
        errors.push({
          row: rowNum,
          barcode: rawBarcode,
          message: `Cost price "${rawCost}" must be a valid positive decimal value.`
        });
        continue;
      }

      const sellingText = String(rawSelling ?? "0").trim();
      const sellingPrice = Number(sellingText);
      if (!/^\d+(\.\d+)?$/.test(sellingText) || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
        errors.push({
          row: rowNum,
          barcode: rawBarcode,
          message: `Selling price "${rawSelling}" must be a valid positive decimal value.`
        });
        continue;
      }

      const stockText = String(rawStock ?? "0").trim();
      const stock = Number(stockText);
      if (!/^\d+$/.test(stockText) || !Number.isSafeInteger(stock) || stock < 0) {
        errors.push({
          row: rowNum,
          barcode: rawBarcode,
          message: `Stock level "${rawStock}" must be a valid positive integer value.`
        });
        continue;
      }

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

    const seenBarcodes = new Set<string>();
    const uniqueRows: ValidProductRow[] = [];
    for (const row of validRows) {
      const normalizedBarcode = row.barcode.trim().toLowerCase();
      if (seenBarcodes.has(normalizedBarcode)) {
        errors.push({ row: 0, barcode: row.barcode, message: "Duplicate barcode/SKU appears more than once in the import." });
        continue;
      }
      seenBarcodes.add(normalizedBarcode);
      uniqueRows.push({ ...row, barcode: row.barcode.trim() });
    }

    return { validRows: uniqueRows, errors };
  } catch (error: any) {
    return {
      validRows: [],
      errors: [{ row: 0, barcode: "EXCEPTION", message: `Parsing error encountered: ${error?.message || "Unknown import error"}` }]
    };
  }
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

  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !Number.isInteger((result as { inserted?: unknown }).inserted) || !Number.isInteger((result as { updated?: unknown }).updated)) {
    throw new Error("Batch database returned an invalid import result.");
  }
  return result as { inserted: number; updated: number };
}
