const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const url = require('url');
const dotenv = require('dotenv');

let mainWindow = null;
let nodeProcess = null;
let pythonProcess = null;

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const pythonCmd = 'python'; // Local python interpreter

// Graceful cleanup of child processes
function killSubprocesses() {
  if (nodeProcess) {
    console.log('[Electron] Killing Node server process...');
    nodeProcess.kill('SIGINT');
    nodeProcess = null;
  }
  if (pythonProcess) {
    console.log('[Electron] Killing Python detector process...');
    pythonProcess.kill('SIGINT');
    pythonProcess = null;
  }
}

// Start Node Express Backend
function startNodeBackend() {
  console.log('[Electron] Starting Node Express server directly inside main process...');

  const isProd = app.isPackaged;
  const distIndexPath = isProd
    ? path.join(app.getAppPath(), 'dist', 'index.js')
    : path.join(process.cwd(), 'dist', 'index.js');

  const distIndexUrl = url.pathToFileURL(distIndexPath).href;

  console.log(`[Electron] Production: ${isProd}, Path: ${distIndexUrl}`);

  // Set environment variables for the in-process server to pick up
  process.env.DATABASE_URL = ''; // Force local SQLite database
  process.env.PORT = '5000';
  process.env.NODE_ENV = 'production'; // Always use production mode to serve static assets
  process.env.USE_MEM_STORAGE = 'false'; // Use SQLite database
  process.env.SESSION_SECRET = 'queue-guidance-local-session-secret-key-10406';
  process.env.SQLITE_DB_PATH = isProd
    ? path.join(app.getPath('userData'), 'queue_guidance.db')
    : path.join(process.cwd(), 'queue_guidance.db');

  import(distIndexUrl)
    .then(() => {
      console.log('[Electron] Backend Express server loaded successfully inside main process.');
    })
    .catch((err) => {
      console.error('[Electron ERROR] Failed to load backend Express server:', err);
    });
}

// Start Python YOLO Detector
function startPythonDetector() {
  console.log('[Electron] Starting Python YOLO detector...');
  
  const isProd = app.isPackaged;
  const detectorExe = isWin ? 'detector-engine.exe' : 'detector-engine';
  
  const cmd = isProd 
    ? path.join(process.resourcesPath, 'detector-engine', detectorExe)
    : pythonCmd;
    
  const args = isProd ? [] : ['main.py'];
  const runCwd = isProd ? process.resourcesPath : path.join(process.cwd(), 'detector');

  console.log(`[Electron] Launching Python engine: ${cmd}`);
  console.log(`[Electron] Cwd for Python: ${runCwd}`);

  pythonProcess = spawn(cmd, args, {
    cwd: runCwd,
    shell: true,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      CORS_ORIGINS: 'http://localhost:5000,http://127.0.0.1:5000'
    }
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Detector] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Detector ERROR] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[Python Detector] Process exited with code ${code}`);
  });
}

// Wait for Node server port to be active
function waitForPort(port, host, callback) {
  const socket = new net.Socket();
  let count = 0;
  
  const tryConnection = () => {
    count++;
    console.log(`[Electron] Checking if backend port ${port} is ready... (attempt ${count})`);
    
    socket.connect(port, host, () => {
      socket.end();
      console.log(`[Electron] Backend port ${port} is active!`);
      callback();
    });
  };

  socket.on('error', () => {
    setTimeout(tryConnection, 400);
  });

  tryConnection();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless window
    show: false,  // Hide window until page is loaded
    backgroundColor: '#0c0a09', // Dark theme placeholder matching dashboard
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Track page loading details
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[Electron] WebContents started loading...');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] WebContents finished loading URL successfully.');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron ERROR] WebContents failed to load URL: ${validatedURL}, Error: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [Level ${level}] ${message} (at ${sourceId}:${line})`);
  });

  // Load the web page once the backend port is active
  waitForPort(5000, '127.0.0.1', () => {
    console.log('[Electron] Loading URL http://localhost:5000');
    mainWindow.loadURL('http://localhost:5000');
  });

  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] mainWindow ready-to-show event fired. Showing window...');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle hooks
app.whenReady().then(() => {
  // Setup persistent file logging in AppData folder
  const fs = require('fs');
  const logDir = app.getPath('userData');
  const logPath = path.join(logDir, 'app.log');
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(logPath, `[Electron Start] Log initialized at ${new Date().toISOString()}\n`);
  } catch (err) {}

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? (a instanceof Error ? a.stack : JSON.stringify(a)) : a).join(' ');
    logStream.write(`[INFO] ${msg}\n`);
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? (a instanceof Error ? a.stack : JSON.stringify(a)) : a).join(' ');
    logStream.write(`[ERROR] ${msg}\n`);
    originalError.apply(console, args);
  };

  console.log('[Electron] Initializing services...');

  // Load environment variables from .env file
  const envPath = app.isPackaged
    ? path.join(app.getAppPath(), '.env')
    : path.join(process.cwd(), '.env');

  console.log(`[Electron] Loading environment variables from: ${envPath}`);
  dotenv.config({ path: envPath });
  console.log(`[Electron] SUPABASE_URL exists: ${!!process.env.SUPABASE_URL}`);
  console.log(`[Electron] SUPABASE_ANON_KEY exists: ${!!process.env.SUPABASE_ANON_KEY}`);


  // Start server processes
  startNodeBackend();
  startPythonDetector();

  // Create Window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killSubprocesses();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  killSubprocesses();
});

// IPC communication for custom title bar controls
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
  killSubprocesses();
  app.quit();
});
