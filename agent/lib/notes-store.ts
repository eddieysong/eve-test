import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { dataDirectory, DocumentConflict, readVersionedFile, writeVersionedFile } from "./local-store.ts";

export const noteInput = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(16_384),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
});
export const noteId = z.string().regex(/^[a-f0-9]{32}$/, "Invalid note ID.");
const storedNote = noteInput.extend({
  id: noteId,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sourceSessionId: z.string().nullable(),
});
type NoteInput = z.input<typeof noteInput>;

export class NoteNotFound extends Error {
  constructor() { super("This note no longer exists."); }
}

function notePath(id: string) {
  return join(dataDirectory(), "notes", `${noteId.parse(id)}.json`);
}

function validateInput(input: NoteInput) {
  const parsed = noteInput.parse(input);
  if (Buffer.byteLength(parsed.body, "utf8") > 16_384) throw new RangeError("Note bodies are limited to 16 KiB.");
  return parsed;
}

export async function readNote(id: string) {
  const document = await readVersionedFile(notePath(id));
  if (document.version === null) throw new NoteNotFound();
  const record = JSON.parse(document.content);
  if (record.deleted === true) throw new NoteNotFound();
  return { ...storedNote.parse(record), version: document.version };
}

export async function saveNote(input: NoteInput, requestId: string, sourceSessionId: string | null = null) {
  const fields = validateInput(input);
  const id = createHash("sha256").update(requestId).digest("hex").slice(0, 32);
  const now = new Date().toISOString();
  const note = { ...fields, id, sourceSessionId, createdAt: now, updatedAt: now };
  try {
    const document = await writeVersionedFile(notePath(id), JSON.stringify(note), null, 131_072);
    return { ...note, version: document.version };
  } catch (error) {
    if (!(error instanceof DocumentConflict)) throw error;
    const existing = await readNote(id);
    if (existing.title !== fields.title || existing.body !== fields.body || JSON.stringify(existing.tags) !== JSON.stringify(fields.tags) || existing.sourceSessionId !== sourceSessionId) throw error;
    return existing;
  }
}

export async function updateNote(id: string, input: NoteInput, expectedVersion: string) {
  const fields = validateInput(input);
  const current = await readNote(id);
  if (current.version !== expectedVersion) throw new DocumentConflict();
  const { version: _version, ...previous } = current;
  const note = { ...previous, ...fields, updatedAt: new Date().toISOString() };
  const saved = await writeVersionedFile(notePath(id), JSON.stringify(note), expectedVersion, 131_072);
  return { ...note, version: saved.version };
}

export async function deleteNote(id: string, expectedVersion: string) {
  await readNote(id);
  // Keep only an ID tombstone so a delayed create retry cannot resurrect content.
  await writeVersionedFile(notePath(id), JSON.stringify({ id, deleted: true }), expectedVersion);
  return { deleted: true, id };
}

export async function searchNotes(query = "", options: { excludeTag?: string } = {}) {
  let files: string[];
  try { files = await readdir(join(dataDirectory(), "notes")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = [];
  for (const file of files.filter(name => /^[a-f0-9]{32}\.json$/.test(name))) {
    let note;
    try { note = await readNote(file.slice(0, -5)); }
    catch (error) { if (error instanceof NoteNotFound) continue; throw error; }
    if (options.excludeTag && note.tags.includes(options.excludeTag)) continue;
    const heading = `${note.title} ${note.tags.join(" ")}`.toLocaleLowerCase();
    const body = note.body.toLocaleLowerCase();
    if (!words.every(word => heading.includes(word) || body.includes(word))) continue;
    const firstMatch = words.length ? Math.max(0, body.indexOf(words.find(word => body.includes(word)) || "") - 40) : 0;
    results.push({
      id: note.id, title: note.title, tags: note.tags,
      snippet: note.body.slice(firstMatch, firstMatch + 180),
      createdAt: note.createdAt, updatedAt: note.updatedAt, sourceSessionId: note.sourceSessionId,
      score: words.filter(word => heading.includes(word)).length,
    });
  }
  return results.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    .slice(0, 50).map(({ score: _score, ...note }) => note);
}
