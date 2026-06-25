const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'AsistTrack · Panel Administrativo',
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, 'public', 'favicon.svg'), // O la ruta del icono que indiques
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false  // Permite fetch a APIs externas (Render)
    },
    autoHideMenuBar: true,
  });

  // Eliminar la Content Security Policy que bloquea peticiones externas
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *"]
      }
    });
  });

  const devUrl = 'http://localhost:5173';
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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
