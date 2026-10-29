import { createNotesPanel } from "./notes-panel.js";
import { SessionStore } from "eve/client";
import { openInteractions } from "eve/events";

const $ = id => document.getElementById(id);
const notesPanel = createNotesPanel();
const cacheKey = "companion-chat-v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch { /* Start fresh if storage is unavailable. */ }
const store = new SessionStore({ baseUrl: location.origin, initialEvents: saved.events || [], initialSession: saved.session, optimistic: true });
let storageWarning = false;
const element = (tag, text, className) => {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
};

function renderInteraction(interaction) {
  const block = element("div", interaction.request.prompt, "interaction");
  if (interaction.status !== "open") return block;
  for (const option of interaction.request.options || []) {
    const button = element("button", option.label);
    button.onclick = () => store.send({ answers: [{ interactionId: interaction.interactionId, optionId: option.id }] }).catch(showChatError);
    block.append(button);
  }
  return block;
}
function showChatError(error) { $("chat-error").textContent = error.message || "The request failed. Try again."; }

function render() {
  const state = store.snapshot;
  const log = $("messages");
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 100;
  const nodes = state.messages.map(message => {
    const article = element("article", "", `message ${message.role}`);
    article.append(element("small", message.role === "user" ? "You" : "Companion"));
    for (const part of message.parts) {
      if (part.type === "text") article.append(element("div", part.text));
      if (part.type === "tool") article.append(element("div", `${part.label || part.name} · ${part.state}`, "tool"));
    }
    return article;
  });
  if (!nodes.length) nodes.push(element("p", "Start wherever you like.", "empty"));
  for (const interaction of openInteractions(state.view).filter(item => item.answer === undefined)) nodes.push(renderInteraction(interaction));
  log.replaceChildren(...nodes);
  if (nearBottom) log.scrollTop = log.scrollHeight;
  const busy = state.status !== "idle";
  const waiting = openInteractions(state.view).some(item => item.answer === undefined);
  $("message").disabled = busy || waiting;
  $("send").disabled = busy || waiting;
  $("new-chat").disabled = busy;
  $("stop").hidden = state.status !== "busy" && !waiting;
  $("chat-status").textContent = state.status === "resuming" ? "Restoring conversation…" : busy ? "Thinking…" : waiting ? "Waiting for your answer" : "Ready when you are";
  $("chat-error").textContent = state.error?.message || (storageWarning ? "Browser storage is full or unavailable; this conversation may not restore after reload." : "");
  try { localStorage.setItem(cacheKey, JSON.stringify({ session: state.session, events: state.events })); }
  catch { storageWarning = true; }
}
store.subscribe(render);
store.setCallbacks({ onFinish: () => {
  if (currentFile === "memory.md" && !dirty) void loadFile(currentFile);
  void notesPanel.refresh();
} });
store.observe();
render();
if (saved.session) void store.resume().catch(showChatError);

$("chat-form").onsubmit = async event => {
  event.preventDefault();
  const message = $("message").value.trim();
  if (!message) return;
  try { await store.send({ message }); $("message").value = ""; } catch (error) { showChatError(error); }
};
$("message").onkeydown = event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); $("chat-form").requestSubmit(); }
};
$("stop").onclick = () => store.cancel().catch(showChatError);
$("new-chat").onclick = () => { store.newSession(); $("message").focus(); };

let currentFile = "identity.md", version = null, baseline = "", dirty = false, saving = false;
let fileRequest = 0;
const descriptions = {
  "identity.md": "Who the companion is. These are your instructions.",
  "soul.md": "Values, voice, and relationship style. Edited by you.",
  "memory.md": "Durable notes. You and the agent can update this file.",
};
function editorState() {
  dirty = $("file-content").value !== baseline;
  $("save-file").disabled = saving || !dirty;
  $("file-status").textContent = saving ? "Saving…" : dirty ? "Unsaved changes" : "Up to date";
}
async function fileRequestJson(path, init) {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
async function loadFile(name) {
  if (saving || (dirty && !confirm("Discard unsaved changes?"))) return;
  const requestId = ++fileRequest;
  $("file-content").disabled = true;
  $("save-file").disabled = true;
  $("file-status").textContent = "Loading…";
  $("file-error").textContent = "";
  try {
    const file = await fileRequestJson(`/companion/files/${name}`);
    if (requestId !== fileRequest) return;
    currentFile = name; version = file.version; baseline = file.content;
    $("file-content").value = file.content; $("file-content").disabled = false;
    $("file-description").textContent = descriptions[name];
    for (const button of $("file-tabs").children) button.setAttribute("aria-pressed", String(button.dataset.file === name));
    editorState();
  } catch (error) { if (requestId === fileRequest) { $("file-error").textContent = error.message; $("file-status").textContent = "Could not load file"; } }
}
$("file-content").oninput = editorState;
$("file-tabs").onclick = event => { if (event.target.dataset.file) void loadFile(event.target.dataset.file); };
$("reload-file").onclick = () => loadFile(currentFile);
$("save-file").onclick = async () => {
  const content = $("file-content").value;
  saving = true; editorState(); $("file-error").textContent = "";
  try {
    const file = await fileRequestJson(`/companion/files/${currentFile}`, { method: "PUT", body: JSON.stringify({ content, expectedVersion: version }) });
    version = file.version; baseline = content;
  } catch (error) { $("file-error").textContent = error.message; }
  finally { saving = false; editorState(); }
};
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
void loadFile(currentFile);
