# eve-test

A minimal Eve skeleton for a personal AI companion experiment.

The character is deliberately unfinished. Start by editing
[identity.md](agent/instructions/identity.md) and
[soul.md](agent/instructions/soul.md).

## What is wired up

| File | Purpose |
| --- | --- |
| `agent/instructions.md` | Basic conversation behavior |
| `agent/instructions/identity.md` | Who the character is |
| `agent/instructions/soul.md` | Self-concept, values, voice, and relationship style |
| `agent/agent.ts` | Model and usage configuration |
| `agent/channels/eve.ts` | Authenticated HTTP session transport |
| `scripts/chat.mjs` | Minimal client for trying a conversation |
| `vercel.json` | Vercel build configuration |

Eve automatically composes the root instructions with the Markdown files in
`agent/instructions/`. Directory entries load alphabetically as system instructions
on every model call. These filenames are an authoring convention; no custom loader
or instruction telling the model to read files is needed.

## Local setup

Requires Node.js 24.

```sh
git clone https://github.com/eddieysong/eve-test.git
cd eve-test
npm install
npx eve link
npm run dev
```

Choose the personal Vercel workspace and the `eve-test` project when linking.
The link command pulls local model credentials into `.env.local`.
Alternatively, Eve's terminal `/login` flow can configure a supported model provider.
Never commit credentials.

The terminal supports conversation directly. From a second terminal in this folder:

```sh
npm run chat -- "Hello. Let's talk about who you are."
```

To continue the same conversation, use the session ID printed by the client:

```sh
EVE_SESSION_ID='the-printed-session-id' npm run chat -- "What would you like your name to be?"
```

The CLI itself reads environment variables from its process; it doesn't load
`.env.local`. The Eve server loads its own credentials.

## Test on Vercel

Production: https://eve-test-eddieysongs-projects.vercel.app

For testing with the development credentials from `npx eve link`, use the preview
deployment below. Run this from the linked repository folder:

```sh
EVE_URL=https://eve-test-o8dwqkq2g-eddieysongs-projects.vercel.app \
  node --env-file=.env.local scripts/chat.mjs "Hello. Who are you?"
```

This runs the agent on Vercel; only the client runs locally. The client uses
`VERCEL_OIDC_TOKEN` from `.env.local` for agent authentication and Vercel's trusted
OIDC header. Refresh expired credentials by running `npx eve link` again.
Development credentials target the same project's preview deployment by default;
production can require an explicit Trusted Sources policy.

## Deploy to Vercel

The initial deployment was uploaded directly. Git-based automatic deployments
are not connected yet: Vercel requires the account's GitHub Login Connection.
After connecting it, import `eddieysong/eve-test`, select Node.js 24, and keep the
repository's build settings. Alternatively, after linking:

```sh
npm run build
npx eve deploy
```

On Vercel, Eve writes its deployment bundle to `.vercel/output`. Model calls use
AI Gateway with project OIDC; the account needs available model access/credits.

Health endpoint: `/eve/v1/health`.
The deployment is an agent service, not a browser chat website.

The authored HTTP channel accepts Vercel OIDC and local development authentication.
It is not an anonymous public chat endpoint. A browser UI and personal login are
future additions. Deployment Protection and the agent's route authentication are
separate checks; passing one does not imply passing the other.

## Memory and scope

Eve manages ongoing conversation sessions. This skeleton does not configure a
separate persistent memory store across sessions or let the character edit its own
identity files. Those are explicit future design decisions.

No tools, publishing integrations, schedules, or custom subagents are enabled.
Do not put private conversation logs or personal memories in this public repository.

## Verification status

Source files and CLI syntax were checked locally. Dependency installation was
blocked by local npm DNS/network access, but Vercel successfully installed and
built the app. Production and preview deployments of commit
`4a5c61e52f847ba75da0e7e4d4100cdef475e0ce` reached READY on October 29, 2026.
A live model conversation has not yet been verified.

Eve is pinned to 0.88.0, matching the inspected source version. After installation,
commit the generated lockfile. Read the installed `node_modules/eve/docs` when
making API changes.

Docs: https://eve.dev/docs/instructions and
https://eve.dev/docs/guides/deployment/vercel
