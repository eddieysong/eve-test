import { defineChannel, DELETE, GET, POST, PUT } from "eve/channels";
import { localDev, routeAuth } from "eve/channels/auth";
import { z } from "zod";
import html from "../lib/web/index.html?raw";
import css from "../lib/web/style.css?raw";
import javascript from "../lib/web/client.bundle.js?raw";
import { readCompanionDocument } from "../lib/documents.ts";
import { documentNames, DocumentConflict, writeDocument } from "../lib/local-store.ts";

import { deleteNote, NoteNotFound, noteId, noteInput, readNote, saveNote, searchNotes, updateNote } from "../lib/notes-store.ts";

const nameSchema = z.enum(documentNames);
const updateSchema = z.object({ content: z.string().max(16_384), expectedVersion: z.string().nullable() });
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

type Handler = Parameters<typeof GET>[1];
function protectedRoute(handler: Handler): Handler {
  return async (request, context) => {
    const auth = await routeAuth(request, localDev());
    if (auth instanceof Response) return auth;
    if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) {
      return Response.json({ error: "Same-origin requests required." }, { status: 403, headers });
    }
    try { return await handler(request, context); }
    catch (error) {
      const status = error instanceof NoteNotFound ? 404 : error instanceof DocumentConflict ? 409 : error instanceof z.ZodError || error instanceof SyntaxError || error instanceof RangeError ? 400 : 500;
      return Response.json({ error: status === 500 ? "File operation failed. Check the server terminal." : (error as Error).message }, { status, headers });
    }
  };
}

export default defineChannel({
  routes: [
    GET("/", protectedRoute(async () => new Response(html, { headers: { ...headers, "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" } }))),
    GET("/companion/client", protectedRoute(async () => new Response(javascript, { headers: { ...headers, "content-type": "text/javascript" } }))),
    GET("/companion/style", protectedRoute(async () => new Response(css, { headers: { ...headers, "content-type": "text/css" } }))),
    GET("/companion/notes", protectedRoute(async request => {
      const query = z.string().max(200).parse(new URL(request.url).searchParams.get("q") ?? "");
      return Response.json(await searchNotes(query), { headers });
    })),
    POST("/companion/notes", protectedRoute(async request => {
      const input = noteInput.extend({ requestId: z.string().uuid() }).parse(await request.json());
      return Response.json(await saveNote(input, input.requestId), { status: 201, headers });
    })),
    GET("/companion/notes/:id", protectedRoute(async (_request, { params }) => {
      return Response.json(await readNote(noteId.parse(params.id)), { headers });
    })),
    PUT("/companion/notes/:id", protectedRoute(async (request, { params }) => {
      const input = noteInput.extend({ expectedVersion: z.string() }).parse(await request.json());
      return Response.json(await updateNote(noteId.parse(params.id), input, input.expectedVersion), { headers });
    })),
    DELETE("/companion/notes/:id", protectedRoute(async (request, { params }) => {
      const input = z.object({ expectedVersion: z.string() }).parse(await request.json());
      return Response.json(await deleteNote(noteId.parse(params.id), input.expectedVersion), { headers });
    })),
    GET("/companion/files/:name", protectedRoute(async (_request, { params }) => {
      return Response.json(await readCompanionDocument(nameSchema.parse(params.name)), { headers });
    })),
    PUT("/companion/files/:name", protectedRoute(async (request, { params }) => {
      const name = nameSchema.parse(params.name);
      if (Number(request.headers.get("content-length")) > 100_000) return new Response("Request too large", { status: 413, headers });
      const input = updateSchema.parse(await request.json());
      return Response.json(await writeDocument(name, input.content, input.expectedVersion), { headers });
    })),
  ],
});
