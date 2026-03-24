const { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TOGGLE_SHORTCUT = "CommandOrControl+Shift+Space";
const DEFAULT_NOTE_ID = () => `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const APP_DATA_ROOT = path.join(__dirname, ".quicknotes");
const USER_DATA_DIR = path.join(APP_DATA_ROOT, "user-data");
const SESSION_DATA_DIR = path.join(APP_DATA_ROOT, "session-data");
const RUNTIME_CACHE_DIR = path.join(os.tmpdir(), "quicknotes-runtime-cache", String(process.pid));

let mainWindow = null;
let notesFilePath = "";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

ensureDir(USER_DATA_DIR);
ensureDir(SESSION_DATA_DIR);
ensureDir(RUNTIME_CACHE_DIR);
app.setPath("userData", USER_DATA_DIR);
app.setPath("sessionData", SESSION_DATA_DIR);
app.commandLine.appendSwitch("disk-cache-dir", RUNTIME_CACHE_DIR);
app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function getDefaultNotesState() {
  const id = DEFAULT_NOTE_ID();
  const now = new Date().toISOString();

  return {
    activeNoteId: id,
    notes: [
      {
        id,
        title: "Welcome",
        content: "QuickNotes is ready.\n\nUse Ctrl+Shift+Space to toggle this window.\nCreate, switch, and edit notes from the sidebar.",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function ensureNotesFile() {
  notesFilePath = path.join(app.getPath("userData"), "quicknotes-data.json");

  if (!fs.existsSync(notesFilePath)) {
    fs.writeFileSync(notesFilePath, JSON.stringify(getDefaultNotesState(), null, 2), "utf8");
  }
}

function readNotes() {
  ensureNotesFile();

  try {
    const raw = fs.readFileSync(notesFilePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.notes) || parsed.notes.length === 0) {
      throw new Error("Invalid note store");
    }

    return parsed;
  } catch (error) {
    const fallback = getDefaultNotesState();
    fs.writeFileSync(notesFilePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

function writeNotes(data) {
  ensureNotesFile();
  fs.writeFileSync(notesFilePath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

function createWindow() {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#0b1020",
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.on("blur", () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function toggleWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  globalShortcut.register(TOGGLE_SHORTCUT, toggleWindow);
}

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();

  ipcMain.handle("notes:load", () => readNotes());
  ipcMain.handle("notes:save", (_event, payload) => writeNotes(payload));
  ipcMain.handle("window:toggle", () => toggleWindow());
  ipcMain.handle("window:minimize", () => mainWindow && mainWindow.minimize());
  ipcMain.handle("window:close", () => mainWindow && mainWindow.hide());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
