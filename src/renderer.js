const notesList = document.getElementById("notesList");
const newNoteBtn = document.getElementById("newNoteBtn");
const noteTitle = document.getElementById("noteTitle");
const noteContent = document.getElementById("noteContent");
const saveStatus = document.getElementById("saveStatus");
const updatedAt = document.getElementById("updatedAt");
const minimizeBtn = document.getElementById("minimizeBtn");
const closeBtn = document.getElementById("closeBtn");

let state = {
  activeNoteId: null,
  notes: []
};

let saveTimer = null;

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

function createEmptyNote() {
  const now = new Date().toISOString();

  return {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: "Untitled note",
    content: "",
    createdAt: now,
    updatedAt: now
  };
}

function sortNotes() {
  state.notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderNotesList() {
  sortNotes();
  notesList.innerHTML = "";

  state.notes.forEach((note) => {
    const item = document.createElement("button");
    item.className = `note-item ${note.id === state.activeNoteId ? "active" : ""}`;
    item.type = "button";
    item.dataset.noteId = note.id;
    item.innerHTML = `
      <div class="note-item-title">${escapeHtml(note.title || "Untitled note")}</div>
      <p class="note-item-preview">${escapeHtml((note.content || "No content yet").slice(0, 72))}</p>
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
}

function render() {
  if (!state.activeNoteId && state.notes[0]) {
    state.activeNoteId = state.notes[0].id;
  }

  renderNotesList();
  renderEditor();
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
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

newNoteBtn.addEventListener("click", () => {
  const note = createEmptyNote();
  state.notes.unshift(note);
  state.activeNoteId = note.id;
  render();
  queueSave();
  noteTitle.focus();
  noteTitle.select();
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

minimizeBtn.addEventListener("click", () => {
  window.quickNotes.minimizeWindow();
});

closeBtn.addEventListener("click", () => {
  window.quickNotes.closeWindow();
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "Space") {
    event.preventDefault();
    window.quickNotes.toggleWindow();
  }
});

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
});

async function bootstrap() {
  state = await window.quickNotes.loadNotes();
  render();
}

bootstrap();
