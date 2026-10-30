# Companion prototype

An Eve companion using **OpenRouter directly**. Identity and soul start as
placeholders; no character or personal memories are invented for you.

## This first slice

- Browser chat with streaming replies, stop, and new conversation.
- Resume the current conversation after a page reload in the same browser.
- Edit `identity.md`, `soul.md`, and `memory.md` beside the conversation.
- Core memory tools maintain the short, always-loaded `memory.md`.
- A Notes panel and note tools save, search, read, edit, and delete detailed notes.
- Memory is recalled in new conversations; identity updates apply on the next
  model call without restarting Eve.

This version is **local first**. Cloud browser sign-in and durable cloud file
storage are the next step. It deliberately rejects editing outside `eve dev`
and refuses to write local files on Vercel. The previously deployed service
continues to run its earlier source until explicitly replaced.

## Run locally

Requires Node.js 24.

```sh
npm ci
# If .env.local does not exist:
[ -f .env.local ] || cp .env.example .env.local
# Add OPENROUTER_API_KEY to .env.local, then:
npm run dev
```

Open the URL printed by Eve, normally <http://127.0.0.1:2000>.
For a second checkout running alongside the original:

```sh
npm run dev -- --port 2001
```

The dev script bundles the browser client and disables Eve's default development
extensions. It sets `COMPANION_DATA_DIR` to the checkout's `.companion/` folder.
Set that variable to an absolute path to reuse another private data folder.
Restart dev after editing `web/client.js`; Markdown edits in the UI need no restart.

The CLI client remains available:

```sh
npm run chat -- "Hello"
```

Use `EVE_URL=http://127.0.0.1:2001` when testing a nondefault port.

## Where your files live

`agent/lib/templates/identity.md` and `soul.md` are public starter templates.
The editor shows a template until you save a private override.

Saved `identity.md`, `soul.md`, and `memory.md` live in **`.companion/`**.
That folder is Git-ignored. Back it up yourself; this prototype has no version
history or automatic backup. Never commit personal memories or transcripts to
this public repository.

Each file is limited to 16 KiB. Saves compare the version you opened with the
current version, so a stale editor or agent cannot silently overwrite another
change. Reload and reconcile after a conflict. Files persist across restarts.
A killed writer can leave a `.lock` directory; stop all writers before removing
that lock from the data folder.

Only the user edits identity and soul. The agent receives `memory__read_memory`
and `memory__update_memory` tools for `memory.md`. Saved memory enters as user
context, never system instructions. Ask it to remember or forget something;
successful writes are visible in the chat's tool activity and the memory editor.
There is no semantic search or automatic background extraction yet.

Conversation events and the current session cursor are cached in this browser's
local storage. Eve stores session history separately. `New chat` starts a new
conversation and leaves shared memory intact. Dev sessions from a prior server
invocation may require a new chat after restarting; the Markdown files persist.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The UI is served by an authenticated Eve channel; no extra frontend server or
browser API key is needed. File routes accept only the three named documents
and require local development auth. Editing requires the same origin.
Existing Vercel OIDC authentication remains on Eve's session routes.

Proactive messaging, cron tasks, computer use, and deeper retrieval are later
increments. Default agent tools remain disabled.

## Detailed notes

The Notes tab shows saved notes with a title, Markdown body, tags, timestamps,
and whether they came from a conversation. Try asking:

> Save a note titled “Companion project” about the decisions we made today.

Then start a new chat and ask it to find that note. The agent has
`memory__save_note`, `memory__search_notes`, `memory__read_note`,
`memory__update_note`, and `memory__delete_note`. Search uses case-insensitive
words across titles, tags, and bodies, returning at most 50 summaries; the
agent reads full notes only when needed. There are no embeddings or automatic
background extraction yet.

Notes are local records in `.companion/notes/<id>.json`. Each body is limited
to 16 KiB. They are separate from the always-loaded `memory.md` and survive
restarts. Deletion removes the title and content and leaves an ID-only
tombstone to prevent an old save request from bringing it back. Earlier
conversation transcripts are not erased by deleting a note.

The editor uses version checks to prevent overwriting a newer agent edit.
If a conflict occurs, reopen the note and reconcile your edits. Keep a copy
of unsaved text before reloading. All note APIs use the same local auth and
same-origin write checks as the file editor. This remains a single-user
local prototype; each customer will need a separate authenticated scope
before cloud or multi-user use.

## Basic conversation tools

The agent also has directly named `remember`, `forget`, `list_notes`, and
`get_current_time` tools. Try “Remember that I prefer short answers,” “Forget
that preference,” “List my saved notes,” or “What time is it in Toronto?”
Remember appends a short fact to core memory without replacing the document;
forget removes an exact saved line. Neither operation erases chat history.
The clock accepts an IANA time zone and defaults to America/Toronto.
Detailed note editing continues to use the existing memory-provider tools.
Web browsing and message delivery are not enabled by this toolkit.
