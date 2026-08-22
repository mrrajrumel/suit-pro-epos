const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectLocalPath: () => ipcRenderer.invoke('select-local-path'),
  getPrinters: () => ipcRenderer.invoke('electron-get-printers'),
  printHtml: (html, options) => ipcRenderer.invoke('electron-print-html', { html, options }),
  openCashDrawer: () => ipcRenderer.invoke('electron-open-cash-drawer')
});
