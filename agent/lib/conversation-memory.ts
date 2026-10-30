import { DocumentConflict, readDocument, writeDocument } from "./local-store.ts";

export function normalizeFact(fact: string) {
  const normalized = fact.trim().replace(/\s+/g, " ");
  if (!normalized || Buffer.byteLength(normalized, "utf8") > 2_048) {
    throw new Error("A remembered fact must be between 1 and 2048 UTF-8 bytes.");
  }
  return normalized;
}

export async function changeFact(fact: string, action: "remember" | "forget") {
  const normalized = normalizeFact(fact);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readDocument("memory.md", "# Memory\n\n");
    const lines = current.content.split("\n");
    const matches = lines.filter(line => line.trim() === normalized || line.trim() === `- ${normalized}`);
    if (action === "remember" && matches.length) return { changed: false, fact: normalized, status: "already remembered" };
    if (action === "forget" && matches.length === 0) return { changed: false, fact: normalized, status: "not found; read_memory to find the exact saved line" };
    const content = action === "remember"
      ? `${current.content.trimEnd()}\n\n- ${normalized}\n`
      : `${lines.filter(line => line.trim() !== normalized && line.trim() !== `- ${normalized}`).join("\n").trimEnd()}\n`;
    try {
      await writeDocument("memory.md", content, current.version);
      return { changed: true, fact: normalized, status: action === "remember" ? "remembered" : "forgotten" };
    } catch (error) {
      if (!(error instanceof DocumentConflict) || attempt === 3) throw error;
    }
  }
  throw new Error("Memory changed repeatedly; please retry.");
}
