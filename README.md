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

Requires Node.js 24 or newer.

```sh
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

## Deploy to Vercel

Import `eddieysong/eve-test`, select Node.js 24, and keep the repository's build
settings. Alternatively, after linking:

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

Source files and CLI syntax were checked locally. Dependency installation and an
Eve build were blocked by local npm DNS/network access. No successful live model
call or Vercel deployment has been verified yet. Vercel workspace authorization
is still required before deployment.

Eve is pinned to 0.88.0, matching the inspected source version. After installation,
commit the generated lockfile. Read the installed `node_modules/eve/docs` when
making API changes.

Docs: https://eve.dev/docs/instructions and
https://eve.dev/docs/guides/deployment/vercel
