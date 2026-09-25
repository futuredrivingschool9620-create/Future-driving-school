const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

// Hardware acceleration and Windows DWM compositing stabilization switches:
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('disable-web-security');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow = null;
let serverProcess = null;

// Start Express server as child process in packaged mode
function startServer() {
  if (!isDev) {
    const serverDir = path.join(process.resourcesPath, 'server');
    const serverPath = path.join(serverDir, 'dist', 'server.js');
    const envPath = path.join(serverDir, '.env');
    const serverModules = path.join(serverDir, 'node_modules');

    console.log('Starting packaged server at:', serverPath);
    console.log('Working directory:', serverDir);

    // Setup logging to AppData for debugging
    const logDir = app.getPath('userData');
    const logFile = path.join(logDir, 'server.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n=== Server started at ${new Date().toISOString()} ===\n`);

    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: serverDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: '3001',
        DOTENV_CONFIG_PATH: envPath,
        NODE_PATH: serverModules,
      },
      stdio: 'pipe',
    });

    serverProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log(`[Server]: ${msg}`);
      logStream.write(`[Server]: ${msg}\n`);
    });

    serverProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      console.error(`[Server Error]: ${msg}`);
      logStream.write(`[Server Error]: ${msg}\n`);
    });

    serverProcess.on('error', (err) => {
      console.error('[Server spawn error]:', err);
      logStream.write(`[Server spawn error]: ${err.message}\n`);
    });

    serverProcess.on('close', (code) => {
      console.log(`[Server] exited with code ${code}`);
      logStream.write(`[Server] exited with code ${code}\n`);
    });
  }
}

function waitForServer(callback, maxAttempts = 30) {
  let attempts = 0;
  const check = () => {
    attempts++;
    http.get('http://localhost:3001/api/health', (res) => {
      if (res.statusCode === 200) {
        console.log(`[Server] Health check passed on attempt ${attempts}`);
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.warn(`[Server] Health check timed out after ${maxAttempts} attempts`);
        callback();
      }
    }).on('error', (err) => {
      if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.warn(`[Server] Health check failed after ${maxAttempts} attempts:`, err.message);
        callback();
      }
    });
  };
  check();
}

let appConfig = {
  liveUrl: '',
  fallbackToLocal: true,
};

try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    appConfig = { ...appConfig, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('[Electron] Could not read config.json, using defaults:', e.message);
}

function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  const clean = (v) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p1 = clean(v1);
  const p2 = clean(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function loadAppContent() {
  if (!mainWindow) return;
  const updateDir = path.join(app.getPath('userData'), 'update');
  const updateIndexPath = path.join(updateDir, 'index.html');
  const updateVersionJson = path.join(updateDir, 'version.json');

  let useUpdate = false;
  if (fs.existsSync(updateIndexPath)) {
    if (fs.existsSync(updateVersionJson)) {
      try {
        const updateVer = JSON.parse(fs.readFileSync(updateVersionJson, 'utf8'));
        const packagedVersion = app.getVersion();
        if (compareVersions(updateVer.version || updateVer.buildId, packagedVersion) >= 0) {
          useUpdate = true;
        }
      } catch {
        useUpdate = true;
      }
    } else {
      useUpdate = true;
    }
  }

  if (useUpdate && fs.existsSync(updateIndexPath)) {
    console.log('[Electron] Loading updated in-app bundle from:', updateIndexPath);
    mainWindow.loadFile(updateIndexPath);
  } else {
    const defaultIndexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
    console.log('[Electron] Loading packaged app bundle from:', defaultIndexPath);
    mainWindow.loadFile(defaultIndexPath);
  }
}

function createWindow() {
  const appIcon = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Future Driving School',
    backgroundColor: '#f8fafc',
    icon: appIcon,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  // Remove native menu bar for clean modern app experience
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // External link handler
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent Windows non-client titlebar redraw flash when React page titles change
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  // Enable F12 and Ctrl+Shift+I for DevTools inspection
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('MainWindow failed to load:', errorCode, errorDescription, validatedURL);
    if (validatedURL && (validatedURL.includes('/login') || !validatedURL.includes('index.html'))) {
      console.log('[Electron] Attempting recovery to local index.html');
      loadAppContent();
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] Renderer process gone:', details.reason, details.exitCode);
    if (details.reason !== 'clean-exit') {
      console.log('[Electron] Automatically reloading window after renderer crash...');
      loadAppContent();
    }
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[Electron] Window unresponsive, attempting to reload...');
    loadAppContent();
  });

  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log(`[Renderer]: ${message}`);
  });

  const liveUrl = process.env.LIVE_APP_URL || (appConfig.liveUrl && appConfig.liveUrl.trim() !== '' ? appConfig.liveUrl.trim() : null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else if (liveUrl) {
    console.log('[Electron] Connecting to live cloud application:', liveUrl);
    mainWindow.loadURL(liveUrl).catch((err) => {
      console.warn('[Electron] Could not load live URL, falling back to local files:', err.message);
      if (appConfig.fallbackToLocal) {
        loadAppContent();
      }
    });
  } else {
    loadAppContent();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

function getCurrentAppVersion() {
  try {
    const updateDir = path.join(app.getPath('userData'), 'update');
    const updateVersionJson = path.join(updateDir, 'version.json');
    if (fs.existsSync(updateVersionJson)) {
      const v = JSON.parse(fs.readFileSync(updateVersionJson, 'utf8'));
      if (v && (v.version || v.buildId)) {
        return v.version || v.buildId;
      }
    }
  } catch {}
  return app.getVersion();
}

ipcMain.handle('get-app-version', () => {
  return getCurrentAppVersion();
});

ipcMain.on('get-app-version-sync', (event) => {
  event.returnValue = getCurrentAppVersion();
});

ipcMain.on('open-external-url', (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// Purge cache and reload application on update
ipcMain.on('app-reload-update', () => {
  if (mainWindow) {
    console.log('[Electron] Purging cache and reloading application...');
    mainWindow.webContents.session.clearCache().then(() => {
      loadAppContent();
    });
  }
});

// Download and apply in-app hot update bundle without downloading or running a new .exe
ipcMain.handle('apply-in-app-update', async (_event, updateUrl) => {
  try {
    if (!updateUrl) throw new Error('No update URL provided');
    console.log('[Electron] Downloading in-app update bundle from:', updateUrl);

    const updateDir = path.join(app.getPath('userData'), 'update');
    const zipPath = path.join(app.getPath('userData'), 'update-bundle.zip');

    const res = await fetch(updateUrl);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);

    if (!fs.existsSync(updateDir)) {
      fs.mkdirSync(updateDir, { recursive: true });
    }

    // Unpack on Windows via PowerShell Expand-Archive
    await new Promise((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${updateDir}' -Force`
      ]);
      ps.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Extraction failed with code ${code}`));
      });
      ps.on('error', reject);
    });

    try { fs.unlinkSync(zipPath); } catch {}

    const updateIndex = path.join(updateDir, 'index.html');
    if (fs.existsSync(updateIndex) && mainWindow) {
      console.log('[Electron] In-app update extracted successfully! Reloading...');
      mainWindow.webContents.session.clearCache().then(() => {
        mainWindow.loadFile(updateIndex);
      });
    }
    return { success: true };
  } catch (err) {
    console.error('[Electron] Error applying in-app update:', err);
    return { success: false, error: err.message };
  }
});

// Single instance lock to prevent duplicate instances from causing port 3001 conflicts & memory exhaustion
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Electron] Another instance is already running. Quitting this duplicate process.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startServer();
    waitForServer(() => {
      createWindow();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function killServer() {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/T', '/F']);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error killing server process:', e);
    }
    serverProcess = null;
  }
}

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killServer();
});

process.on('exit', () => {
  killServer();
});


