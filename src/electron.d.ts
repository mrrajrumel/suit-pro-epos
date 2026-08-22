export interface ElectronAPI {
  selectLocalPath: () => Promise<string | null>;
  getPrinters?: () => Promise<Array<{ name: string; displayName: string; isDefault: boolean; status: number }>>;
  printHtml?: (html: string, options?: { title?: string; paperSize?: "58mm" | "80mm" | "A4"; deviceName?: string; silent?: boolean }) => Promise<{ success: boolean; error?: string }>;
  openCashDrawer?: () => Promise<{ success: boolean; error?: string; message?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
