import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DocumentConflict, readDocument, writeDocument } from "../agent/lib/local-store.ts";

const directory = await mkdtemp(join(tmpdir(), "companion-store-test-"));
process.env.COMPANION_DATA_DIR = directory;
after(() => rm(directory, { recursive: true, force: true }));

test("missing documents expose a template without writing it", async () => {
  assert.deepEqual(await readDocument("identity.md", "template"), { name: "identity.md", content: "template", version: null });
});
test("saves a private Markdown file that a fresh reader can load", async () => {
  const saved = await writeDocument("identity.md", "# Identity\nTest fixture", null);
  assert.equal(await readFile(join(directory, "identity.md"), "utf8"), saved.content);
  assert.deepEqual(await readDocument("identity.md"), saved);
});
test("stale saves cannot overwrite a newer edit", async () => {
  await assert.rejects(writeDocument("identity.md", "stale", null), DocumentConflict);
  assert.match((await readDocument("identity.md")).content, /Test fixture/);
});
test("a separate process recalls the same saved document", () => {
  const moduleUrl = new URL("../agent/lib/local-store.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `const {readDocument}=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(await readDocument('identity.md')));`], { env: process.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).content, /Test fixture/);
});
test("two writers starting at the same version have exactly one winner", async () => {
  const results = await Promise.allSettled([
    writeDocument("memory.md", "first", null), writeDocument("memory.md", "second", null),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected" && r.reason instanceof DocumentConflict).length, 1);
});
test("memory can be corrected and cleared without resurrecting old content", async () => {
  const current = await readDocument("memory.md");
  const cleared = await writeDocument("memory.md", "", current.version);
  assert.equal((await readDocument("memory.md", "fallback")).content, "");
  assert.equal((await readDocument("memory.md")).version, cleared.version);
});
test("rejects paths and oversized UTF-8 content", async () => {
  await assert.rejects(readDocument("../.env.local"), /Unknown companion file/);
  await assert.rejects(writeDocument("memory.md", "🟣".repeat(5000), null), /16 KiB/);
});
test("cloud cannot accidentally write ephemeral local storage", async () => {
  process.env.VERCEL = "1";
  try { await assert.rejects(readDocument("memory.md"), /Cloud editing needs durable storage/); }
  finally { delete process.env.VERCEL; }
});
