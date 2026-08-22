export function resolveSyncTargetPath(selectedPath: string): string {
  const trimmed = selectedPath.trim();
  if (!trimmed) {
    return 'C:/SuitPro/ExcelSync/sales_sync.csv';
  }

  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized.endsWith('.csv') || normalized.endsWith('.xlsx') || normalized.endsWith('.xls')) {
    return normalized;
  }

  return `${normalized.replace(/\/$/, '')}/sales_sync.csv`;
}
