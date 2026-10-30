import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { deleteNote, NoteNotFound, readNote, saveNote, searchNotes, updateNote } from "../agent/lib/notes-store.ts";
import { DocumentConflict } from "../agent/lib/local-store.ts";

const directory = await mkdtemp(join(tmpdir(), "companion-notes-test-"));
process.env.COMPANION_DATA_DIR = directory;
after(() => rm(directory, { recursive: true, force: true }));
let example;

test("empty note search works before the directory exists", async () => {
  assert.deepEqual(await searchNotes(), []);
});
test("saves metadata and deduplicates retries of the same operation", async () => {
  const input = { title: "Project choices", body: "We chose OpenRouter for this companion.", tags: ["project"] };
  example = await saveNote(input, "operation-1", "session-1");
  assert.equal(example.sourceSessionId, "session-1");
  assert.equal(example.createdAt, example.updatedAt);
  assert.deepEqual(await saveNote(input, "operation-1", "session-1"), example);
  await assert.rejects(saveNote({ ...input, body: "different" }, "operation-1", "session-1"), DocumentConflict);
});
test("search matches all words across titles, body, and tags without returning full bodies", async () => {
  const results = await searchNotes("OPENROUTER project");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, example.id);
  assert.equal("body" in results[0], false);
  assert.ok(results[0].snippet.length <= 180);
  assert.deepEqual(await searchNotes("unmatched"), []);
});
test("updates preserve provenance and reject stale editors", async () => {
  const oldVersion = example.version;
  example = await updateNote(example.id, { title: "Revised choice", body: "Still using OpenRouter", tags: [] }, oldVersion);
  assert.equal(example.sourceSessionId, "session-1");
  await assert.rejects(updateNote(example.id, { title: "Stale", body: "Do not overwrite" }, oldVersion), DocumentConflict);
  assert.equal((await readNote(example.id)).title, "Revised choice");
});
test("notes persist across independent processes", () => {
  const moduleUrl = new URL("../agent/lib/notes-store.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `const {readNote}=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(await readNote(${JSON.stringify(example.id)})));`], { env: process.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).body, example.body);
});
test("independent note writes cannot overwrite one another", async () => {
  const notes = await Promise.all([
    saveNote({ title: "First", body: "alpha" }, "operation-2"),
    saveNote({ title: "Second", body: "beta" }, "operation-3"),
  ]);
  assert.notEqual(notes[0].id, notes[1].id);
  assert.equal((await searchNotes()).length, 3);
});
test("deletion rejects stale versions and removes searchable content", async () => {
  await assert.rejects(deleteNote(example.id, "wrong"), DocumentConflict);
  await deleteNote(example.id, example.version);
  await assert.rejects(readNote(example.id), NoteNotFound);
  assert.deepEqual(await searchNotes("OpenRouter"), []);
  const tombstone = await readFile(join(directory, "notes", `${example.id}.json`), "utf8");
  assert.equal(tombstone.includes("OpenRouter"), false);
  await assert.rejects(saveNote({ title: "Project choices", body: "We chose OpenRouter for this companion.", tags: ["project"] }, "operation-1", "session-1"), NoteNotFound);
});
test("rejects traversal, invalid fields, and oversized multibyte content", async () => {
  await assert.rejects(readNote("../../.env.local"), /Invalid note ID/);
  await assert.rejects(saveNote({ title: "", body: "hello" }, "bad-title"));
  await assert.rejects(saveNote({ title: "Large", body: "🟣".repeat(5000) }, "bad-size"), /16 KiB/);
});
test("permits bounded content even when JSON escaping expands its size", async () => {
  const note = await saveNote({ title: "Escaping", body: '"'.repeat(16000) }, "escape-test");
  assert.equal((await readNote(note.id)).body.length, 16000);
});
