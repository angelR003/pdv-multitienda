const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
  });

  win.loadURL("http://localhost:3000/login.html");
}

app.whenReady().then(() => {
  app.whenReady().then(() => {
  try {
    require(path.join(__dirname, "backend", "src", "app.js"));
    console.log("Backend iniciado desde Electron");
  } catch (error) {
    console.error("ERROR INICIANDO BACKEND:", error);
  }

  setTimeout(() => {
    createWindow();
  }, 5000);
});

  setTimeout(() => {
    createWindow();
  }, 5000);
});

app.on("window-all-closed", () => {
  app.quit();
});