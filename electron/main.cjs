const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

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
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        callback();
      }
    }).on('error', () => {
      if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        callback();
      }
    });
  };
  check();
}

function createWindow() {
  const appIcon = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Future Driving School',
    backgroundColor: '#0f172a',
    icon: appIcon,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
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

  // Enable F12 and Ctrl+Shift+I for DevTools inspection
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('MainWindow failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
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

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
