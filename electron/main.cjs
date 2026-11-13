/**
 * Smart Jozveh - Electron Main Process
 * Designed for High Performance, Low Memory Usage & Broad Windows Compatibility
 * Compatible with Windows 7 SP1 (with Electron 22.3.27) through Windows 11
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Detect Windows Version
const osRelease = os.release();
const isWin7Or8 = osRelease.startsWith('6.1') || osRelease.startsWith('6.2') || osRelease.startsWith('6.3');

// Low Memory Optimization for 32-bit and low-spec systems
if (isWin7Or8 || process.arch === 'ia32') {
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}

// Preserve strict TLS/SSL certificate validation (DO NOT disable certificate checks)
// We keep standard secure connections

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'جزوه‌نگار هوشمند (Smart Jozveh)',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    backgroundColor: '#0f172a',
    show: false,
  });

  // Graceful show when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // In production, load the built dist/index.html; in development, load dev server
  const distPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  // Handle external links safely in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Native IPC handlers for Desktop Integration
ipcMain.handle('get-platform-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    isWin7Or8,
    version: app.getVersion(),
  };
});

// Select folder natively for saving outputs
ipcMain.handle('select-save-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'انتخاب پوشه ذخیره خروجی‌های Word و جزوه',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});
