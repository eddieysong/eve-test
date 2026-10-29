# Companion prototype

An Eve companion using **OpenRouter directly**. Identity and soul start as
placeholders; no character or personal memories are invented for you.

## This first slice

- Browser chat with streaming replies, stop, and new conversation.
- Resume the current conversation after a page reload in the same browser.
- Edit `identity.md`, `soul.md`, and `memory.md` beside the conversation.
- Memory tools let the agent read, save, correct, and forget notes.
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
npm test
npm run build
```

The UI is served by an authenticated Eve channel; no extra frontend server or
browser API key is needed. File routes accept only the three named documents
and require local development auth. Editing requires the same origin.
Existing Vercel OIDC authentication remains on Eve's session routes.

Proactive messaging, cron tasks, computer use, and deeper retrieval are later
increments. Default agent tools remain disabled.
