import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackupStorageRoot } from '../src/lib/backup-service.ts';

test('uses a configured storage root for backup files', () => {
  assert.equal(resolveBackupStorageRoot('C:/SuitPro/Backups'), 'C:/SuitPro/Backups');
});

test('normalizes a supplied backup root path', () => {
  assert.equal(resolveBackupStorageRoot('C:\\SuitPro\\Backups\\'), 'C:/SuitPro/Backups');
});
