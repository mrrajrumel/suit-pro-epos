const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const THERMAL_PAGE_SIZE_MICRONS = { width: 72000, height: 210000 };
const net = require('net');

async function findAvailablePort(startPort = 3000, endPort = 3015) {
  const tryPort = (port) => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      server.close();
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(null);
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(port));
    });
    server.listen(port, '127.0.0.1');
  });

  for (let port = startPort; port <= endPort; port += 1) {
    const available = await tryPort(port);
    if (available) {
      return available;
    }
  }

  throw new Error(`Unable to find an available localhost port between ${startPort} and ${endPort}`);
}

// Boot the bundled Express backend server in the background
async function startBackend() {
  const appRoot = app.getAppPath();
  const isPackagedApp = app.isPackaged;
  const dataRoot = isPackagedApp
    ? path.join(app.getPath('userData'), 'SuitPro')
    : process.cwd();

  console.log(`[Electron] Starting backend from appRoot=${appRoot} cwd=${process.cwd()} isPackaged=${isPackagedApp} userData=${app.getPath('userData')} dataRoot=${dataRoot}`);

  if (!fs.existsSync(dataRoot)) {
    try {
      fs.mkdirSync(dataRoot, { recursive: true });
    } catch (err) {
      console.warn(`[Electron] Could not create dataRoot=${dataRoot}:`, err);
    }
  }

  process.env.SUITPRO_ROOT = appRoot;
  process.env.SUITPRO_DATA_DIR = dataRoot;

  try {
    const port = await findAvailablePort(3000, 3015);
    process.env.PORT = `${port}`;
    require(path.join(appRoot, 'dist', 'server.cjs'));
    console.log(`Express background server loaded successfully inside Electron on port ${port}.`);
    return port;
  } catch (err) {
    console.error('Failed to start Express backend inside Electron:', err);
    throw err;
  }
}

let splashWindow = null;
let mainWindow = null;
let isQuitting = false;
let startupRetryTimer = null;
let printJobWindow = null;
let printJobInProgress = false;

function safeDestroyWindow(win) {
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 760,
    height: 430,
    frame: false,
    resizable: false,
    show: true,
    alwaysOnTop: true,
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashHtml = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0;
            font-family: Segoe UI, Arial, sans-serif;
            background: radial-gradient(circle at top, #1f2937 0%, #020617 70%, #01040a 100%);
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            width: 92%;
            max-width: 620px;
            padding: 28px 30px;
            border: 1px solid rgba(223, 183, 108, 0.25);
            border-radius: 18px;
            background: rgba(2, 6, 23, 0.88);
            box-shadow: 0 22px 60px rgba(0,0,0,0.35);
            text-align: center;
          }
          .title { font-size: 24px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
          .sub { margin-top: 10px; color: #cbd5e1; font-size: 13px; }
          .brand { margin-top: 16px; color: #dfb76c; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; }
          .bar { margin-top: 18px; height: 8px; width: 100%; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
          .bar > span { display: block; width: 42%; height: 100%; background: linear-gradient(90deg, #fbbf24, #dfb76c); animation: pulse 1.2s infinite ease-in-out; }
          @keyframes pulse { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">SuitPro</div>
          <div class="sub">Preparing your retail workspace and local services…</div>
          <div class="brand">Offline-first · secure · fast startup</div>
          <div class="bar"><span></span></div>
        </div>
      </body>
    </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.center();
}

function showStartupFailure(error) {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  const message = String(error && error.message ? error.message : error);
  const failureHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
    body{margin:0;padding:32px;background:#020617;color:#f8fafc;font:14px Segoe UI,Arial,sans-serif}
    main{max-width:620px;margin:40px auto;padding:28px;border:1px solid #7f1d1d;border-radius:12px;background:#111827}
    h1{color:#fca5a5;font-size:20px}p{line-height:1.6;color:#cbd5e1}pre{white-space:pre-wrap;color:#fecaca;background:#020617;padding:14px;border-radius:8px}
  </style></head><body><main><h1>SuitPro could not start</h1><p>The local POS service stopped during startup. Close and reopen the application after checking that the installation folder is accessible.</p><pre>${message.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</pre></main></body></html>`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(failureHtml)}`);
}

async function createWindow() {
  app.setName('SuitPro');
  app.setAppUserModelId('com.suitpro.london.pos');
  app.setAboutPanelOptions({
    applicationName: 'SuitPro',
    applicationVersion: app.getVersion(),
    authors: ['Rumel Ahmed (@mrrajrumel)'],
    copyright: '© 2026 Rumel Ahmed (@mrrajrumel)'
  });

  createSplashWindow();

  let port;
  try {
    port = await startBackend();
  } catch (error) {
    console.error('[Electron] Fatal startup failure:', error);
    showStartupFailure(error);
    return;
  }
  const url = `http://127.0.0.1:${port}`;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    title: "SuitPro • Retail POS",
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setIcon(path.join(__dirname, 'public', 'favicon.ico'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    if (isQuitting || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    safeDestroyWindow(splashWindow);
    splashWindow = null;
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.once('closed', () => {
    if (startupRetryTimer) {
      clearTimeout(startupRetryTimer);
      startupRetryTimer = null;
    }
    mainWindow = null;
    safeDestroyWindow(splashWindow);
    splashWindow = null;
  });

  let attempt = 0;
  const loadApp = () => {
    if (isQuitting || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    attempt += 1;
    mainWindow.loadURL(url).then(() => {
      if (isQuitting || !mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      safeDestroyWindow(splashWindow);
      splashWindow = null;
      mainWindow.show();
      mainWindow.focus();
    }).catch((loadErr) => {
      if (isQuitting || !mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      if (attempt >= 12) {
        showStartupFailure(loadErr);
        return;
      }
      const retryDelay = attempt < 8 ? 700 : 1500;
      console.error(`Failed to load ${url} (attempt ${attempt}):`, loadErr);
      console.log(`Waiting for Express local server to start on ${url}, retrying in ${retryDelay}ms...`);
      startupRetryTimer = setTimeout(loadApp, retryDelay);
    });
  };

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Electron failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
  });

  loadApp();
}

ipcMain.handle('select-local-path', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'openDirectory', 'createDirectory'],
    title: 'Choose spreadsheet sync location',
    buttonLabel: 'Select path'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('electron-get-printers', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return [];
  }
  try {
    return (await mainWindow.webContents.getPrintersAsync()).map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      isDefault: printer.isDefault,
      status: printer.status
    }));
  } catch (error) {
    console.error('[SUIT PRO] Printer enumeration failed:', error);
    return [];
  }
});

ipcMain.handle('electron-print-html', async (_event, payload) => {
  if (printJobInProgress) {
    return { success: false, error: 'A print job is already in progress.' };
  }
  if (!payload || typeof payload.html !== 'string' || payload.html.length > 2_000_000) {
    return { success: false, error: 'Invalid print document.' };
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'POS window is not available for printing.' };
  }

  let availablePrinters;
  try {
    availablePrinters = await mainWindow.webContents.getPrintersAsync();
  } catch (error) {
    console.error('[SUIT PRO] Printer enumeration failed before print:', error);
    return { success: false, error: 'Windows printer list is unavailable.' };
  }
  if (!Array.isArray(availablePrinters) || availablePrinters.length === 0) {
    return { success: false, error: 'No Windows printers are installed or available.' };
  }
  const deviceName = typeof payload.options?.deviceName === 'string' ? payload.options.deviceName.trim() : '';
  const silent = payload.options?.silent !== false;
  const targetPrinter = availablePrinters.find((printer) => printer.name === deviceName) || availablePrinters.find((printer) => printer.isDefault) || availablePrinters[0];
  if (silent && (!targetPrinter || (deviceName && targetPrinter.name !== deviceName))) {
    return { success: false, error: 'Please select an available printer before printing.' };
  }

  printJobInProgress = true;
  return new Promise((resolve) => {
    const paperSize = payload.options?.paperSize === 'A4' ? 'A4' : '80mm';
    const pageStyle = paperSize === 'A4'
      ? '@page { size: A4; margin: 12mm; }'
      : '@page { size: 72mm 210mm; margin: 0; } html,body{width:72mm;max-width:72mm;min-width:0;overflow-x:hidden;overflow-wrap:anywhere;word-break:break-word;box-sizing:border-box}*,*::before,*::after{box-sizing:border-box;max-width:100%}table{width:100%;table-layout:fixed;word-break:break-word}img,svg,canvas{max-width:100%;height:auto}';
    const html = payload.html.replace('</head>', `<style>${pageStyle} html,body{margin:0;background:#fff;color:#000}</style></head>`);
    const printFile = path.join(os.tmpdir(), `suitpro-print-${Date.now()}-${Math.random().toString(16).slice(2)}.html`);
    fs.writeFileSync(printFile, html, 'utf8');
    if (printJobWindow && !printJobWindow.isDestroyed()) printJobWindow.destroy();
    printJobWindow = new BrowserWindow({
      show: false,
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });

    const finish = (result) => {
      if (printJobWindow && !printJobWindow.isDestroyed()) printJobWindow.destroy();
      try { fs.rmSync(printFile, { force: true }); } catch (error) { console.warn('[SUIT PRO] Temporary print file cleanup failed:', error); }
      printJobWindow = null;
      printJobInProgress = false;
      resolve(result);
    };

    printJobWindow.webContents.once('did-finish-load', async () => {
      try {
        const state = await printJobWindow.webContents.executeJavaScript(`(async()=>{await document.fonts.ready; await Promise.all(Array.from(document.images).map(image=>image.complete ? Promise.resolve() : new Promise(resolve=>{image.addEventListener('load',resolve,{once:true}); image.addEventListener('error',resolve,{once:true});}))); return {bodyLength: document.body?.innerHTML?.length || 0, textLength: document.body?.innerText?.length || 0, images: document.images.length};})()`);
        console.log('[SUIT PRO Print] Loaded document state:', state);
        if (!state || state.bodyLength === 0) {
          finish({ success: false, error: 'Print document loaded without body content.' });
          return;
        }
      } catch (error) {
        finish({ success: false, error: `Print document readiness check failed: ${error.message}` });
        return;
      }
      printJobWindow.webContents.print({
        silent,
        deviceName: silent ? targetPrinter.name : undefined,
        pageSize: paperSize === 'A4' ? 'A4' : THERMAL_PAGE_SIZE_MICRONS,
        margins: { marginType: 'none' },
        printBackground: true
      }, (success, failureReason) => {
        finish(success ? { success: true } : { success: false, error: failureReason || 'Printer rejected the document.' });
      });
    });
    printJobWindow.webContents.once('did-fail-load', (_event, code, description) => {
      finish({ success: false, error: `Print document could not load (${code}): ${description}` });
    });
    printJobWindow.loadFile(printFile).catch((error) => finish({ success: false, error: error.message }));
  });
});

ipcMain.handle('electron-open-cash-drawer', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Main window not available for drawer control.' };
  }

  console.log('[SUIT PRO] Cash drawer open command requested from renderer process.');
  return { success: true, message: 'Cash drawer command queued successfully.' };
});

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  isQuitting = true;
  if (startupRetryTimer) {
    clearTimeout(startupRetryTimer);
    startupRetryTimer = null;
  }
  if (printJobWindow && !printJobWindow.isDestroyed()) {
    printJobWindow.destroy();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
