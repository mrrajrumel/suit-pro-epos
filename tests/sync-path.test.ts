import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSyncTargetPath } from '../src/lib/sync-path.ts';

test('resolves a directory selection into a default sync file path', () => {
  assert.equal(resolveSyncTargetPath('C:/SuitPro/ExcelSync'), 'C:/SuitPro/ExcelSync/sales_sync.csv');
});

test('keeps file selections unchanged', () => {
  assert.equal(resolveSyncTargetPath('C:/SuitPro/ExcelSync/sales_sync.xlsx'), 'C:/SuitPro/ExcelSync/sales_sync.xlsx');
});
