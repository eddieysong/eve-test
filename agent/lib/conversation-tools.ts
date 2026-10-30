import { defineTool } from "eve/tools";
import { z } from "zod";
import { changeFact } from "./conversation-memory.ts";
import { searchNotes } from "./notes-store.ts";

function requireLocal(auth: { authenticator: string } | null | undefined) {
  if (auth?.authenticator !== "local-dev") throw new Error("Conversation memory tools require the authenticated local companion.");
}

export function conversationTools() {
  return {
    remember: defineTool({
      description: "Remember one short, lasting fact or preference the user wants kept across conversations. Appends to memory.md while preserving existing content. Do not store secrets or invent facts. Tell the user what was actually saved.",
      inputSchema: z.object({ fact: z.string().min(1).max(2048) }),
      execute: ({ fact }, ctx) => { requireLocal(ctx.session.auth.current); return changeFact(fact, "remember"); },
    }),
    forget: defineTool({
      description: "Forget an exact saved fact from memory.md at the user's request. Use read_memory first to get the exact saved line, without its bullet. Preserves unrelated lines. This does not erase notes or chat history.",
      inputSchema: z.object({ fact: z.string().min(1).max(2048) }),
      execute: ({ fact }, ctx) => { requireLocal(ctx.session.auth.current); return changeFact(fact, "forget"); },
    }),
    list_notes: defineTool({
      description: "List recent saved notes with their IDs, titles, and short excerpts. Use the returned IDs with read_note, update_note, or delete_note. This reads notes; it does not create or change them.",
      inputSchema: z.object({}),
      execute: (_input, ctx) => { requireLocal(ctx.session.auth.current); return searchNotes(); },
    }),
    get_current_time: defineTool({
      description: "Read the current date, time, and weekday. Use this when the user asks about now, today, or the current time instead of guessing. Defaults to America/Toronto; accepts an IANA time zone.",
      inputSchema: z.object({ timeZone: z.string().min(1).max(100).default("America/Toronto") }),
      execute: ({ timeZone }) => {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "full", timeStyle: "long" }).format(now);
        return { iso: now.toISOString(), timeZone, formatted };
      },
    }),
  };
}
