import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { dataDirectory, readDocument, readVersionedFile, withFileLock, writeVersionedFile } from "./local-store.ts";
import { NoteNotFound, readNote, saveNote, searchNotes } from "./notes-store.ts";

const entrySchema = z.object({
  id: z.string(), sessionId: z.string(), text: z.string(), capturedAt: z.string(),
});
const inboxSchema = z.array(entrySchema);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const inboxPath = () => join(dataDirectory(), "review", "inbox.json");

// Only new user input is captured; assistant guesses and tool output are excluded.
export async function captureReviewInput(operationId: string, sessionId: string, messages: readonly { role: string; content: unknown }[]) {
  const text = messages.filter(message => message.role === "user").map(message => {
    if (typeof message.content === "string") return message.content;
    if (!Array.isArray(message.content)) return "";
    return message.content.filter(part => part?.type === "text" && typeof part.text === "string").map(part => part.text).join("\n");
  }).join("\n").trim();
  // Don't copy obvious credentials into the review inbox.
  if (!text || /(?:password|api[ _-]?key|secret|token)\s*[:=]|\b(?:sk-|sk_or_|sk-or-)[\w-]+/i.test(text)) return;
  const path = inboxPath();
  await withFileLock(`${path}.capture`, async () => {
    const current = await readVersionedFile(path, "[]");
    const entries = inboxSchema.parse(JSON.parse(current.content));
    const id = hash(operationId).slice(0, 32);
    if (entries.some(entry => entry.id === id)) return;
    entries.push({ id, sessionId, text: text.slice(0, 1200), capturedAt: new Date().toISOString() });
    await writeVersionedFile(path, JSON.stringify(entries.slice(-24)), current.version, 196_608);
  });
}

export async function readReviewSnapshot() {
  const memory = await readDocument("memory.md", "# Memory\n\n");
  const inbox = await readVersionedFile(inboxPath(), "[]");
  const messages = inboxSchema.parse(JSON.parse(inbox.content));
  const recentNotes = (await searchNotes("", { excludeTag: "memory-review" })).slice(0, 8);
  const notes = await Promise.all(recentNotes.map(async note => {
    const full = await readNote(note.id);
    return { id: `note:${note.id}`, title: full.title, text: full.body.slice(0, 1200), truncated: full.body.length > 1200 };
  }));
  const sources = [
    { id: "memory.md", text: memory.content },
    ...messages.map(message => ({ id: `message:${message.id}`, text: message.text })),
    ...notes,
  ];
  const version = hash(JSON.stringify(sources));
  const requestId = `memory-review:${version}`;
  let previousReview: { id: string; createdAt: string } | null = null;
  try {
    const note = await readNote(hash(requestId).slice(0, 32));
    previousReview = { id: note.id, createdAt: note.createdAt };
  } catch (error) { if (!(error instanceof NoteNotFound)) throw error; }
  return { version, sources, previousReview, contentIsUntrusted: true };
}

export const reviewReportSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  suggestions: z.array(z.object({
    kind: z.enum(["remember", "correct", "follow-up"]),
    text: z.string().trim().min(1).max(500),
    sourceIds: z.array(z.string()).min(1).max(3),
  })).max(8),
});

export async function saveReviewReport(version: string, report: z.input<typeof reviewReportSchema>, sessionId: string) {
  const input = reviewReportSchema.parse(report);
  const snapshot = await readReviewSnapshot();
  if (snapshot.version !== version) throw new Error("Review sources changed. Inspect again before saving.");
  if (snapshot.previousReview) return { saved: false, id: snapshot.previousReview.id, status: "already reviewed" };
  const sourceIds = new Set(snapshot.sources.map(source => source.id));
  if (input.suggestions.some(suggestion => suggestion.sourceIds.some(id => !sourceIds.has(id)))) {
    throw new Error("Every suggestion must cite a source from the inspected snapshot.");
  }
  const body = [
    "# Memory review", input.summary,
    "## Proposed updates (not applied to memory.md)",
    input.suggestions.length ? input.suggestions.map(item => `- **${item.kind}**: ${item.text}\n  Sources: ${item.sourceIds.join(", ")}`).join("\n") : "No useful memory changes or follow-ups found.",
  ].join("\n\n");
  const note = await saveNote({ title: `Memory review · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, body, tags: ["memory-review"] }, `memory-review:${version}`, sessionId);
  return { saved: true, id: note.id, status: "review saved in Notes; core memory unchanged" };
}
