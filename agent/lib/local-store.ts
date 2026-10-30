import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";

export const documentNames = ["identity.md", "soul.md", "memory.md"] as const;
export type DocumentName = (typeof documentNames)[number];
export const maxBytes = 16_384;

export class DocumentConflict extends Error {
  constructor() { super("This file changed. Reload it before saving again."); }
}

export function dataDirectory() {
  if (process.env.VERCEL || !process.env.COMPANION_DATA_DIR) {
    throw new Error("This file store requires local dev. Cloud editing needs durable storage.");
  }
  return process.env.COMPANION_DATA_DIR;
}

function filename(name: string) {
  if (!documentNames.includes(name as DocumentName)) throw new Error("Unknown companion file.");
  return join(dataDirectory(), name);
}

export function documentVersion(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export async function readDocument(name: string, fallback = "") {
  const document = await readVersionedFile(filename(name), fallback);
  return { name, ...document };
}

export async function readVersionedFile(path: string, fallback = "") {
  try {
    const content = await readFile(path, "utf8");
    return { content, version: documentVersion(content) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { content: fallback, version: null };
  }
}

// The lock covers compare + rename across Eve's separate runtime processes.
// A killed writer leaves a lock: fail visibly rather than risk overwriting data.
export async function writeDocument(name: string, content: string, expectedVersion: string | null) {
  const document = await writeVersionedFile(filename(name), content, expectedVersion);
  return { name, ...document };
}

export async function withFileLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const lock = `${path}.lock`;
  let acquired = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await mkdir(lock); acquired = true; break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await setTimeout(25);
    }
  }
  if (!acquired) throw new Error("This file is locked. Retry after the other writer finishes.");
  try { return await operation(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

export async function writeVersionedFile(path: string, content: string, expectedVersion: string | null, byteLimit = maxBytes) {
  if (Buffer.byteLength(content, "utf8") > byteLimit) throw new Error(`Files are limited to ${byteLimit / 1024} KiB.`);
  return withFileLock(path, async () => {
    const current = await readVersionedFile(path);
    if (current.version !== expectedVersion) throw new DocumentConflict();
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temporary, path);
      return { content, version: documentVersion(content) };
    } finally { await rm(temporary, { force: true }); }
  });
}
