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

// ── Update Bundle Integrity ──
// A partially-extracted bundle (interrupted download/PowerShell expand) used to be loaded
// anyway. Because index.html then referenced asset files that were never written, the
// window rendered an empty #root — a permanent blank white screen. Every bundle must now
// prove it is complete before it can ever be loaded.
function verifyBundleIntegrity(bundleDir) {
  const indexPath = path.join(bundleDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('Update bundle is missing index.html');
  }

  const html = fs.readFileSync(indexPath, 'utf8');
  const referenced = [];
  const pattern = /(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const ref = match[1];
    if (!ref || ref.startsWith('#') || ref.startsWith('data:') || /^(https?:)?\/\//i.test(ref)) {
      continue;
    }
    referenced.push(ref.replace(/^\.\//, ''));
  }

  const missing = referenced.filter(
    (rel) => !fs.existsSync(path.join(bundleDir, rel.split('/').join(path.sep)))
  );

  if (missing.length > 0) {
    throw new Error(`Update bundle is incomplete. Missing: ${missing.join(', ')}`);
  }
  return true;
}

function isBundleUsable(bundleDir) {
  try {
    return verifyBundleIntegrity(bundleDir) === true;
  } catch (e) {
    console.warn('[Electron] Rejecting update bundle:', e.message);
    return false;
  }
}

function expandArchive(zipPath, destinationDir) {
  return new Promise((resolve, reject) => {
    const escapeSingleQuotes = (p) => String(p).replace(/'/g, "''");
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${escapeSingleQuotes(zipPath)}' -DestinationPath '${escapeSingleQuotes(destinationDir)}' -Force`,
      ],
      { windowsHide: true }
    );
    ps.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Extraction failed with code ${code}`));
    });
    ps.on('error', reject);
  });
}

// Guards against overlapping document loads, which are themselves a source of flashing.
let isContentLoading = false;
let lastContentLoadAt = 0;

function loadAppContent() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (isContentLoading) {
    console.log('[Electron] A content load is already in flight; ignoring duplicate request.');
    return;
  }

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

  if (useUpdate && fs.existsSync(updateIndexPath) && isBundleUsable(updateDir)) {
    console.log('[Electron] Loading verified in-app bundle from:', updateIndexPath);
    isContentLoading = true;
    lastContentLoadAt = Date.now();
    mainWindow.loadFile(updateIndexPath).catch((err) => {
      console.error('[Electron] Failed to load in-app bundle:', err.message);
    }).finally(() => {
      isContentLoading = false;
    });
    return;
  }

  if (useUpdate) {
    // Self-heal: never let a corrupt bundle blank the window. Removing it makes the next
    // start (and this load) fall back to the known-good packaged application.
    console.warn('[Electron] In-app bundle failed verification; quarantining it and using packaged app.');
    try {
      fs.rmSync(updateDir, { recursive: true, force: true });
    } catch (e) {
      console.error('[Electron] Could not remove corrupt in-app bundle:', e.message);
    }
  } else if (fs.existsSync(updateDir)) {
    // The stored in-app bundle is older than this installation, so it will never be used
    // again. Removing it reclaims disk and removes any chance of a stale bundle loading.
    console.log('[Electron] Removing superseded in-app bundle from a previous version.');
    try {
      fs.rmSync(updateDir, { recursive: true, force: true });
    } catch (e) {
      console.error('[Electron] Could not remove superseded in-app bundle:', e.message);
    }
  }

  const defaultIndexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  if (!fs.existsSync(defaultIndexPath)) {
    console.error('[Electron] Packaged application bundle is missing at:', defaultIndexPath);
    return;
  }

  console.log('[Electron] Loading packaged app bundle from:', defaultIndexPath);
  isContentLoading = true;
  lastContentLoadAt = Date.now();
  mainWindow.loadFile(defaultIndexPath).catch((err) => {
    console.error('[Electron] Failed to load packaged bundle:', err.message);
  }).finally(() => {
    isContentLoading = false;
  });
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

  // ── Recovery governor ──
  // Previously ANY load failure, renderer crash, or momentary hang triggered an immediate
  // window reload. Those reloads are what users saw as "flickering", and a repeating
  // reload loop left a permanently blank white window. Recovery is now rate limited,
  // de-bounced, and only ever performed when the window is genuinely unusable.
  const RECOVERY_WINDOW_MS = 60000;
  const MAX_RECOVERIES_PER_WINDOW = 2;
  const recoveryTimestamps = [];
  let isRecovering = false;
  let isUnresponsive = false;

  const canRecover = () => {
    const now = Date.now();
    while (recoveryTimestamps.length > 0 && now - recoveryTimestamps[0] > RECOVERY_WINDOW_MS) {
      recoveryTimestamps.shift();
    }
    return recoveryTimestamps.length < MAX_RECOVERIES_PER_WINDOW;
  };

  const recoverWindow = (reason) => {
    if (!mainWindow || mainWindow.isDestroyed() || isRecovering) return;
    if (!canRecover()) {
      console.error(
        `[Electron] Recovery suppressed (${reason}): limit of ${MAX_RECOVERIES_PER_WINDOW} reloads per minute reached. Leaving the current view untouched.`
      );
      return;
    }
    isRecovering = true;
    recoveryTimestamps.push(Date.now());
    console.warn(`[Electron] Recovering window (${reason})...`);
    setTimeout(() => {
      isRecovering = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        loadAppContent();
      }
    }, 300);
  };

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // -3 (ERR_ABORTED) is emitted for normal superseded navigations; never treat as failure.
      if (errorCode === -3) return;
      if (isMainFrame === false) return;
      console.error('MainWindow failed to load:', errorCode, errorDescription, validatedURL);
      recoverWindow(`did-fail-load ${errorCode}`);
    }
  );

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] Renderer process gone:', details.reason, details.exitCode);
    if (details.reason !== 'clean-exit') {
      recoverWindow(`render-process-gone ${details.reason}`);
    }
  });

  mainWindow.on('unresponsive', () => {
    isUnresponsive = true;
    console.warn('[Electron] Window reported unresponsive; allowing it to recover on its own...');
    // A brief main-thread block (large export, PDF parse, heavy render) is normal and must
    // never trigger a reload. Only a sustained hang of 15s justifies a single recovery.
    setTimeout(() => {
      if (isUnresponsive) {
        recoverWindow('sustained unresponsive window');
      }
    }, 15000);
  });

  mainWindow.on('responsive', () => {
    if (isUnresponsive) {
      console.log('[Electron] Window responsive again; no recovery needed.');
    }
    isUnresponsive = false;
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
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // The in-app updater already loads the freshly installed bundle. Skipping the immediate
  // follow-up reload keeps an upgrade to a single, flicker-free load.
  if (Date.now() - lastContentLoadAt < 3000) {
    console.log('[Electron] Reload skipped: fresh content was loaded moments ago.');
    return;
  }

  console.log('[Electron] Purging cache and reloading application...');
  mainWindow.webContents.session.clearCache().then(() => {
    loadAppContent();
  });
});

// Download and apply in-app hot update bundle without downloading or running a new .exe
ipcMain.handle('apply-in-app-update', async (_event, updateUrl) => {
  const userDataDir = app.getPath('userData');
  const liveDir = path.join(userDataDir, 'update');
  const stagingDir = path.join(userDataDir, 'update-staging');
  const previousDir = path.join(userDataDir, 'update-previous');
  const zipPath = path.join(userDataDir, 'update-bundle.zip');

  try {
    if (!updateUrl) throw new Error('No update URL provided');
    console.log('[Electron] Downloading in-app update bundle from:', updateUrl);

    const res = await fetch(updateUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error('Downloaded update bundle is empty');
    fs.writeFileSync(zipPath, buffer);

    // 1. Extract into a throwaway staging directory — never straight over the live bundle,
    //    so an interrupted extraction can no longer leave a half-written app behind.
    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.mkdirSync(stagingDir, { recursive: true });
    await expandArchive(zipPath, stagingDir);

    // 2. Prove the bundle is complete (index.html + every referenced asset) before use.
    verifyBundleIntegrity(stagingDir);

    // 3. Activate it, keeping the previous bundle as a rollback point.
    let activated = false;
    try {
      fs.rmSync(previousDir, { recursive: true, force: true });
      if (fs.existsSync(liveDir)) {
        fs.renameSync(liveDir, previousDir);
      }
      fs.renameSync(stagingDir, liveDir);
      activated = true;
    } catch (swapErr) {
      console.warn('[Electron] In-place swap unavailable, copying verified bundle:', swapErr.message);
      if (fs.existsSync(stagingDir)) {
        fs.cpSync(stagingDir, liveDir, { recursive: true, force: true });
        activated = true;
      }
    }

    if (!activated) {
      throw new Error('Could not activate the verified update bundle');
    }

    try { fs.rmSync(previousDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}

    console.log('[Electron] In-app update verified and applied successfully. Loading new bundle...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.session.clearCache().then(() => {
        loadAppContent();
      });
    }
    return { success: true };
  } catch (err) {
    console.error('[Electron] Error applying in-app update:', err);

    // Roll back so the user is always left with a working application.
    try {
      if (!fs.existsSync(liveDir) && fs.existsSync(previousDir)) {
        fs.renameSync(previousDir, liveDir);
        console.log('[Electron] Rolled back to the previously installed bundle.');
      }
      fs.rmSync(stagingDir, { recursive: true, force: true });
      fs.rmSync(zipPath, { force: true });
    } catch (cleanupErr) {
      console.error('[Electron] Update rollback cleanup failed:', cleanupErr.message);
    }

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


