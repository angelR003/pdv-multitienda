const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

let win;
let updateDisponible = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL("http://localhost:3000/login.html");
  win.webContents.openDevTools();
}

function iniciarBackend() {
  try {
    require(path.join(__dirname, "backend", "src", "app.js"));
    console.log("Backend iniciado desde Electron");
  } catch (error) {
    console.error("ERROR INICIANDO BACKEND:", error);
  }
}

function configurarActualizador() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    updateDisponible = true;

    if (win) {
      win.webContents.send("update-available", {
        version: info.version
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    updateDisponible = false;
  });

  autoUpdater.on("download-progress", (progress) => {
    if (win) {
      win.webContents.send("update-progress", {
        percent: Math.round(progress.percent)
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    if (win) {
      win.webContents.send("update-downloaded");
    }
  });

  autoUpdater.on("error", (error) => {
    console.error("Error actualizador:", error.message);

    if (win) {
      win.webContents.send("update-error", {
        mensaje: error.message
      });
    }
  });
}

ipcMain.handle("check-update", async () => {
  if (!app.isPackaged) {
    return {
      ok: false,
      mensaje: "Las actualizaciones solo funcionan en el exe instalado."
    };
  }

  try {
    const resultado = await autoUpdater.checkForUpdates();
    return { ok: true, resultado };
  } catch (error) {
    return { ok: false, mensaje: error.message };
  }
});

ipcMain.handle("download-update", async () => {
  if (!app.isPackaged) {
    return {
      ok: false,
      mensaje: "Las actualizaciones solo funcionan en el exe instalado."
    };
  }

  if (!updateDisponible) {
    return {
      ok: false,
      mensaje: "No hay actualización disponible."
    };
  }

  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    return { ok: false, mensaje: error.message };
  }
});

ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});

app.whenReady().then(() => {
  iniciarBackend();
  configurarActualizador();

  setTimeout(() => {
    createWindow();

    setTimeout(() => {
      if (app.isPackaged) {
        autoUpdater.checkForUpdates().catch((error) => {
          console.log("No se pudo revisar actualización:", error.message);
        });
      }
    }, 3000);
  }, 5000);
});

app.on("window-all-closed", () => {
  app.quit();
});