import test from "node:test";
import assert from "node:assert/strict";
import { parseInventorySpreadsheet } from "../src/lib/import-service.ts";

class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsArrayBuffer(file: Blob) {
    file.text()
      .then((text) => {
        const event = {
          target: {
            result: text
          }
        } as ProgressEvent<FileReader>;
        this.onload?.(event);
      })
      .catch(() => {
        this.onerror?.();
      });
  }
}

test("parses CSV inventory files from string-based FileReader payloads", async () => {
  const OriginalFileReader = globalThis.FileReader;
  // @ts-expect-error - test shim for Node environment
  globalThis.FileReader = MockFileReader;

  try {
    const file = new File(
      ["barcode,name,size,colour,costPrice,sellingPrice,stock\nABC-1,Test Product,XL,Blue,10,20,5"],
      "inventory.csv",
      { type: "text/csv" }
    );

    const result = await parseInventorySpreadsheet(file);

    assert.equal(result.validRows.length, 1);
    assert.equal(result.validRows[0].barcode, "ABC-1");
    assert.equal(result.validRows[0].name, "Test Product");
    assert.equal(result.errors.length, 0);
  } finally {
    globalThis.FileReader = OriginalFileReader;
  }
});
