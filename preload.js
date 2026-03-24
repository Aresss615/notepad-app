const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quickNotes", {
  loadNotes: () => ipcRenderer.invoke("notes:load"),
  saveNotes: (payload) => ipcRenderer.invoke("notes:save", payload),
  toggleWindow: () => ipcRenderer.invoke("window:toggle"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  closeWindow: () => ipcRenderer.invoke("window:close")
});
