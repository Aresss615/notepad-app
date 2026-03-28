const notesList = document.getElementById("notesList");
const newNoteBtn = document.getElementById("newNoteBtn");
const duplicateNoteBtn = document.getElementById("duplicateNoteBtn");
const deleteNoteBtn = document.getElementById("deleteNoteBtn");
const focusSearchBtn = document.getElementById("focusSearchBtn");
const searchInput = document.getElementById("searchInput");
const noteCounter = document.getElementById("noteCounter");
const shortcutHint = document.getElementById("shortcutHint");
const noteTitle = document.getElementById("noteTitle");
const noteContent = document.getElementById("noteContent");
const saveStatus = document.getElementById("saveStatus");
const updatedAt = document.getElementById("updatedAt");
const minimizeBtn = document.getElementById("minimizeBtn");
const closeBtn = document.getElementById("closeBtn");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const sidebarResizeHandle = document.getElementById("sidebarResizeHandle");
const lineNumbers = document.getElementById("lineNumbers");
const cursorInfo = document.getElementById("cursorInfo");
const selectionInfo = document.getElementById("selectionInfo");
const docStats = document.getElementById("docStats");
const activeLabel = document.getElementById("activeLabel");
const appShell = document.querySelector(".app-shell");

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_COLLAPSED_WIDTH = 78;

let state = {
  activeNoteId: null,
  notes: []
};

const isMac = navigator.userAgentData?.platform === "macOS" || /Mac/i.test(navigator.userAgent);
const modKey = isMac ? "⌘" : "Ctrl";

let saveTimer = null;
let filterText = "";
let sidebarWidth = 320;
let isSidebarCollapsed = false;
let isResizingSidebar = false;

function formatDate(isoString) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function getActiveNote() {
  return state.notes.find((note) => note.id === state.activeNoteId) || state.notes[0] || null;
}

function getFilteredNotes() {
  const term = filterText.trim().toLowerCase();

  if (!term) {
    return [...state.notes];
  }

  return state.notes.filter((note) => {
    return `${note.title}\n${note.content}`.toLowerCase().includes(term);
  });
}

function createEmptyNote(seedTitle = "Untitled note", seedContent = "") {
  const now = new Date().toISOString();

  return {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: seedTitle,
    content: seedContent,
    createdAt: now,
    updatedAt: now
  };
}

function sortNotes() {
  state.notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markSaving(text) {
  saveStatus.textContent = text;
}

async function persist() {
  sortNotes();
  await window.quickNotes.saveNotes(state);
  markSaving("Saved");
  renderNotesList();
}

function queueSave() {
  markSaving("Saving...");

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    persist().catch(() => {
      markSaving("Save failed");
    });
  }, 250);
}

function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  persist().catch(() => {
    markSaving("Save failed");
  });
}

function updateLineNumbers() {
  const totalLines = Math.max(1, noteContent.value.split("\n").length);
  lineNumbers.textContent = Array.from({ length: totalLines }, (_value, index) => index + 1).join("\n");
}

function updateEditorMetrics() {
  const value = noteContent.value;
  const lines = Math.max(1, value.split("\n").length);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const chars = value.length;
  const selection = Math.abs(noteContent.selectionEnd - noteContent.selectionStart);
  const caret = noteContent.selectionStart;
  const upToCaret = value.slice(0, caret).split("\n");
  const row = upToCaret.length;
  const col = upToCaret[upToCaret.length - 1].length + 1;

  cursorInfo.textContent = `Ln ${row}, Col ${col}`;
  selectionInfo.textContent = `${selection} selected`;
  docStats.textContent = `${lines} lines • ${words} words • ${chars} chars`;
  updateLineNumbers();
  lineNumbers.scrollTop = noteContent.scrollTop;
}

function focusEditor() {
  noteContent.focus();
}

function createNote() {
  const note = createEmptyNote();
  filterText = "";
  searchInput.value = "";
  state.notes.unshift(note);
  state.activeNoteId = note.id;
  render();
  queueSave();
  noteTitle.focus();
  noteTitle.select();
}

function duplicateActiveNote() {
  const activeNote = getActiveNote();

  if (!activeNote) {
    return;
  }

  const copy = createEmptyNote(`${activeNote.title} Copy`, activeNote.content);
  filterText = "";
  searchInput.value = "";
  state.notes.unshift(copy);
  state.activeNoteId = copy.id;
  render();
  queueSave();
}

function updateSidebarLayout() {
  const width = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;
  appShell.style.setProperty("--sidebar-width", `${width}px`);
  appShell.classList.toggle("sidebar-collapsed", isSidebarCollapsed);
  toggleSidebarBtn.textContent = isSidebarCollapsed ? ">" : "<";
  toggleSidebarBtn.setAttribute("aria-label", isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
  sidebarResizeHandle.setAttribute("aria-hidden", String(isSidebarCollapsed));
}

function toggleSidebar() {
  isSidebarCollapsed = !isSidebarCollapsed;
  updateSidebarLayout();
}

function resizeSidebar(nextWidth) {
  sidebarWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, nextWidth));
  isSidebarCollapsed = false;
  updateSidebarLayout();
}

function deleteActiveNote() {
  const activeNote = getActiveNote();

  if (!activeNote) {
    return;
  }

  const confirmed = window.confirm(`Delete "${activeNote.title || "Untitled note"}"? This cannot be undone.`);

  if (!confirmed) {
    return;
  }

  if (state.notes.length === 1) {
    const freshNote = createEmptyNote();
    state.notes = [freshNote];
    state.activeNoteId = freshNote.id;
  } else {
    state.notes = state.notes.filter((note) => note.id !== activeNote.id);
    state.activeNoteId = state.notes[0]?.id || null;
  }

  render();
  queueSave();
}

function updateActiveNote(changes) {
  const activeNote = getActiveNote();

  if (!activeNote) {
    return;
  }

  Object.assign(activeNote, changes, {
    updatedAt: new Date().toISOString()
  });

  updatedAt.textContent = `Updated ${formatDate(activeNote.updatedAt)}`;
  queueSave();
  renderNotesList();
  updateEditorMetrics();
}

function renderNotesList() {
  sortNotes();
  const filteredNotes = getFilteredNotes();
  notesList.innerHTML = "";
  noteCounter.textContent = filterText
    ? `${filteredNotes.length} of ${state.notes.length} notes`
    : `${filteredNotes.length} ${filteredNotes.length === 1 ? "note" : "notes"}`;
  shortcutHint.textContent = filterText ? `${modKey}+F search` : `${modKey}+N new`;

  if (!filteredNotes.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No matching notes. Try a different search or create a new note.";
    notesList.appendChild(emptyState);
    return;
  }

  filteredNotes.forEach((note) => {
    const item = document.createElement("button");
    item.className = `note-item ${note.id === state.activeNoteId ? "active" : ""}`;
    item.type = "button";
    item.dataset.noteId = note.id;
    item.innerHTML = `
      <div class="note-item-title">${escapeHtml(note.title || "Untitled note")}</div>
      <p class="note-item-preview">${escapeHtml((note.content || "No content yet").slice(0, 90))}</p>
      <p class="note-item-date">${formatDate(note.updatedAt)}</p>
    `;
    item.addEventListener("click", () => {
      state.activeNoteId = note.id;
      render();
    });
    notesList.appendChild(item);
  });
}

function renderEditor() {
  const activeNote = getActiveNote();

  if (!activeNote) {
    return;
  }

  noteTitle.value = activeNote.title;
  noteContent.value = activeNote.content;
  updatedAt.textContent = `Updated ${formatDate(activeNote.updatedAt)}`;
  activeLabel.textContent = activeNote.title || "Untitled note";
  updateEditorMetrics();
}

function ensureActiveNoteVisible() {
  const activeItem = notesList.querySelector(".note-item.active");

  if (activeItem) {
    activeItem.scrollIntoView({ block: "nearest" });
  }
}

function render() {
  if (!state.activeNoteId && state.notes[0]) {
    state.activeNoteId = state.notes[0].id;
  }

  renderNotesList();
  renderEditor();
  ensureActiveNoteVisible();
}

function switchNote(direction) {
  const filteredNotes = getFilteredNotes();
  const currentIndex = filteredNotes.findIndex((note) => note.id === state.activeNoteId);

  if (currentIndex === -1 || !filteredNotes.length) {
    return;
  }

  const nextIndex = (currentIndex + direction + filteredNotes.length) % filteredNotes.length;
  state.activeNoteId = filteredNotes[nextIndex].id;
  render();
}

newNoteBtn.addEventListener("click", createNote);
duplicateNoteBtn.addEventListener("click", duplicateActiveNote);
deleteNoteBtn.addEventListener("click", deleteActiveNote);
focusSearchBtn.addEventListener("click", () => searchInput.focus());
toggleSidebarBtn.addEventListener("click", toggleSidebar);

searchInput.addEventListener("input", (event) => {
  filterText = event.target.value;
  renderNotesList();
});

noteTitle.addEventListener("input", (event) => {
  const value = event.target.value.trimStart();
  updateActiveNote({
    title: value || "Untitled note"
  });
});

noteContent.addEventListener("input", (event) => {
  updateActiveNote({
    content: event.target.value
  });
});

noteContent.addEventListener("scroll", () => {
  lineNumbers.scrollTop = noteContent.scrollTop;
});

noteContent.addEventListener("click", updateEditorMetrics);
noteContent.addEventListener("select", updateEditorMetrics);

minimizeBtn.addEventListener("click", () => {
  window.quickNotes.minimizeWindow();
});

closeBtn.addEventListener("click", () => {
  window.quickNotes.closeWindow();
});

sidebarResizeHandle.addEventListener("pointerdown", (event) => {
  if (isSidebarCollapsed) {
    return;
  }

  isResizingSidebar = true;
  sidebarResizeHandle.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing-sidebar");
});

sidebarResizeHandle.addEventListener("pointermove", (event) => {
  if (!isResizingSidebar) {
    return;
  }

  resizeSidebar(event.clientX);
});

sidebarResizeHandle.addEventListener("pointerup", (event) => {
  if (!isResizingSidebar) {
    return;
  }

  isResizingSidebar = false;
  sidebarResizeHandle.releasePointerCapture(event.pointerId);
  document.body.classList.remove("resizing-sidebar");
});

sidebarResizeHandle.addEventListener("dblclick", () => {
  isSidebarCollapsed = false;
  sidebarWidth = 320;
  updateSidebarLayout();
});

window.addEventListener("keydown", (event) => {
  const usesModifier = event.ctrlKey || event.metaKey;

  if (usesModifier && event.shiftKey && event.code === "Space") {
    event.preventDefault();
    window.quickNotes.toggleWindow();
    return;
  }

  if (!usesModifier) {
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      switchNote(1);
    }

    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      switchNote(-1);
    }
    return;
  }

  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
    return;
  }

  if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateActiveNote();
    return;
  }

  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    markSaving("Saving...");
    saveNow();
    return;
  }

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (event.key === "1") {
    event.preventDefault();
    notesList.focus();
    ensureActiveNoteVisible();
    return;
  }

  if (event.key === "2") {
    event.preventDefault();
    focusEditor();
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    deleteActiveNote();
    return;
  }

  if (event.key.toLowerCase() === "w") {
    event.preventDefault();
    window.quickNotes.closeWindow();
  }
});

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
});

async function bootstrap() {
  state = await window.quickNotes.loadNotes();
  updateSidebarLayout();
  render();
}

bootstrap();
