const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const https = require('https');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 17842; // custom port to avoid conflicts
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// --- Backend management ---

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.join(__dirname, '..', 'backend');
}

function getPythonPath() {
  const backendPath = getBackendPath();
  if (process.platform === 'win32') {
    return path.join(backendPath, 'venv', 'Scripts', 'python.exe');
  }
  return path.join(backendPath, 'venv', 'bin', 'python3');
}

function startBackend() {
  const backendPath = getBackendPath();
  const pythonPath = getPythonPath();

  if (!fs.existsSync(pythonPath)) {
    console.error('Python venv not found at:', pythonPath);
    return;
  }

  console.log('Starting backend...', pythonPath, backendPath);

  backendProcess = spawn(pythonPath, [
    '-m', 'uvicorn',
    'main:app',
    '--host', '127.0.0.1',
    '--port', String(BACKEND_PORT),
    '--no-access-log',
  ], {
    cwd: backendPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  backendProcess.stdout.on('data', d => console.log('[backend]', d.toString().trim()));
  backendProcess.stderr.on('data', d => console.error('[backend]', d.toString().trim()));
  backendProcess.on('exit', (code) => console.log('[backend] exited with code', code));
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function waitForBackend(retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(`${BACKEND_URL}/health`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else tryAgain();
      }).on('error', tryAgain);
    };
    const tryAgain = () => {
      attempts++;
      if (attempts >= retries) reject(new Error('Backend failed to start'));
      else setTimeout(check, delay);
    };
    check();
  });
}

// --- Window ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0A0A0F',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'src', 'icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC handlers ---

ipcMain.handle('get-backend-url', () => BACKEND_URL);

ipcMain.handle('download-file', async (event, { url, filename, backendPayload }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      { name: 'Videos', extensions: ['mp4', 'webm', 'mkv'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePath) return { success: false, reason: 'cancelled' };

  return new Promise((resolve) => {
    const axios = require('axios');
    const file = fs.createWriteStream(filePath);

    axios({
      method: 'POST',
      url: `${BACKEND_URL}/download`,
      data: backendPayload,
      responseType: 'stream',
      timeout: 120000,
      onDownloadProgress: (prog) => {
        if (mainWindow && prog.total > 0) {
          mainWindow.webContents.send('download-progress', {
            percent: prog.loaded / prog.total,
          });
        }
      },
    }).then(response => {
      response.data.pipe(file);
      file.on('finish', () => {
        file.close();
        shell.showItemInFolder(filePath);
        resolve({ success: true, path: filePath });
      });
    }).catch(err => {
      fs.unlink(filePath, () => {});
      resolve({ success: false, reason: err.message });
    });
  });
});

// --- App lifecycle ---

app.whenReady().then(async () => {
  startBackend();
  createWindow();

  try {
    await waitForBackend();
    mainWindow?.webContents.send('backend-ready');
  } catch (e) {
    mainWindow?.webContents.send('backend-error', 'Backend failed to start. Make sure dependencies are installed.');
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', stopBackend);
