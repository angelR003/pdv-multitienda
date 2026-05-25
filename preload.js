const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("actualizador", {
  revisar: () => ipcRenderer.invoke("check-update"),
  descargar: () => ipcRenderer.invoke("download-update"),
  instalar: () => ipcRenderer.invoke("install-update"),

  cuandoHayUpdate: (callback) => {
    ipcRenderer.on("update-available", (_, data) => callback(data));
  },

  progreso: (callback) => {
    ipcRenderer.on("update-progress", (_, data) => callback(data));
  },

  cuandoDescargada: (callback) => {
    ipcRenderer.on("update-downloaded", () => callback());
  },

  cuandoError: (callback) => {
    ipcRenderer.on("update-error", (_, data) => callback(data));
  }
});