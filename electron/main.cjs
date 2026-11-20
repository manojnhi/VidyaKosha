const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { app, BrowserWindow, dialog, shell } = require('electron');

let mainWindow = null;

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3000;
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Server returned status ${res.statusCode}`));
        } else {
          setTimeout(check, 200);
        }
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('Timed out waiting for VidyaKosha backend server.'));
        } else {
          setTimeout(check, 200);
        }
      });
    };
    check();
  });
}

async function bootDesktopApp() {
  const port = await findAvailablePort();
  const dataDir = path.join(app.getPath('userData'), 'data');
  const distDir = path.join(__dirname, 'app', 'dist');
  const serverBundle = path.join(__dirname, 'app', 'server.cjs');

  if (!fs.existsSync(serverBundle) || !fs.existsSync(distDir)) {
    throw new Error('Packaged application bundle (app/server.cjs or app/dist) is missing.');
  }

  process.env.NODE_ENV = 'production';
  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);
  process.env.VIDYAKOSHA_DATA_DIR = dataDir;
  process.env.VIDYAKOSHA_DIST_DIR = distDir;

  require(serverBundle);
  await waitForServer(port);

  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 390,
    minHeight: 620,
    title: 'VidyaKosha Digital Library',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${port}`)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(() => {
  bootDesktopApp().catch((err) => {
    dialog.showErrorBox('VidyaKosha Startup Error', err instanceof Error ? err.message : String(err));
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
