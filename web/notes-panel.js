const $ = id => document.getElementById(id);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
};

async function request(path, options = {}) {
  const response = await fetch(`/companion/notes${path}`, {
    ...options, headers: { "content-type": "application/json" },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export function createNotesPanel() {
  let selected = null, baseline = "", dirty = false, saving = false;
  let query = "", listSequence = 0, openSequence = 0;
  let requestId = crypto.randomUUID();
  const fields = () => ({
    title: $("note-title").value.trim(), body: $("note-body").value.trim(),
    tags: $("note-tags").value.split(",").map(tag => tag.trim()).filter(Boolean),
  });
  const fingerprint = () => JSON.stringify(fields());
  const showError = error => { $("note-error").textContent = error.message; };
  function updateState() {
    dirty = fingerprint() !== baseline;
    $("save-note").disabled = saving || !dirty || !fields().title || !fields().body;
    $("delete-note").disabled = saving;
    $("new-note").disabled = saving;
    $("note-status").textContent = saving ? "Saving…" : dirty ? "Unsaved changes" : selected ? "Saved" : "New note";
  }
  function fill(note = null) {
    selected = note;
    requestId = crypto.randomUUID();
    $("note-title").value = note?.title || "";
    $("note-body").value = note?.body || "";
    $("note-tags").value = note?.tags.join(", ") || "";
    $("delete-note").hidden = !note;
    $("note-metadata").textContent = note ? `Updated ${new Date(note.updatedAt).toLocaleString()} · ${note.sourceSessionId ? "Saved from a conversation" : "Created in the editor"}` : "";
    $("note-error").textContent = "";
    baseline = fingerprint(); updateState();
  }
  function canLeave() { return !saving && (!dirty || confirm("Discard unsaved note changes?")); }
  async function open(id, checkChanges = true) {
    if (checkChanges && !canLeave()) return;
    const sequence = ++openSequence;
    const before = fingerprint();
    try {
      const note = await request(`/${id}`);
      if (sequence === openSequence && !saving && fingerprint() === before) fill(note);
    } catch (error) { if (sequence === openSequence) showError(error); }
  }
  async function refresh() {
    const sequence = ++listSequence;
    try {
      const notes = await request(`?q=${encodeURIComponent(query)}`);
      if (sequence !== listSequence) return;
      $("notes-summary").textContent = notes.length ? `${notes.length}${notes.length === 50 ? "+" : ""} ${notes.length === 1 ? "note" : "notes"}` : query ? "No matching notes." : "No notes yet. Save one here, or ask the companion.";
      $("notes-list").replaceChildren(...notes.map(note => {
        const item = document.createElement("li");
        const button = node("button", "", "note-card");
        button.type = "button";
        button.append(node("strong", note.title), node("span", note.snippet, "note-snippet"));
        button.onclick = () => void open(note.id);
        item.append(button); return item;
      }));
      // Agent edits become visible, without replacing an unsaved draft.
      if (selected && !dirty && !saving && notes.some(note => note.id === selected.id)) await open(selected.id, false);
    } catch (error) { showError(error); }
  }
  for (const name of ["note-title", "note-body", "note-tags"]) $(name).oninput = updateState;
  $("note-search-form").onsubmit = event => {
    event.preventDefault(); query = $("note-search").value.trim(); void refresh();
  };
  $("new-note").onclick = () => {
    if (!canLeave()) return;
    ++openSequence; fill(); $("note-title").focus();
  };
  $("note-form").onsubmit = async event => {
    event.preventDefault();
    if (saving || !dirty) return;
    ++openSequence;
    const input = fields(), previous = selected;
    saving = true; updateState(); $("note-error").textContent = "";
    for (const id of ["note-title", "note-body", "note-tags"]) $(id).disabled = true;
    try {
      const note = await request(previous ? `/${previous.id}` : "", {
        method: previous ? "PUT" : "POST",
        body: JSON.stringify({ ...input, ...(previous ? { expectedVersion: previous.version } : { requestId }) }),
      });
      fill(note);
    } catch (error) { showError(error); }
    finally {
      saving = false;
      for (const id of ["note-title", "note-body", "note-tags"]) $(id).disabled = false;
      updateState(); void refresh();
    }
  };
  $("delete-note").onclick = async () => {
    if (!selected || saving || !confirm(`Permanently delete “${selected.title}”? This does not erase earlier chat messages.`)) return;
    saving = true; updateState(); ++openSequence;
    try { await request(`/${selected.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: selected.version }) }); fill(); }
    catch (error) { showError(error); }
    finally { saving = false; updateState(); void refresh(); }
  };
  for (const name of ["files", "notes"]) $(name + "-tab").onclick = () => {
    for (const panel of ["files", "notes"]) {
      $(panel + "-panel").hidden = name !== panel;
      $(panel + "-tab").setAttribute("aria-selected", String(name === panel));
    }
    if (name === "notes") void refresh();
  };
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  fill();
  return { refresh };
}
