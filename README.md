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
npm ci
# Create .env.local only if it does not already exist.
[ -f .env.local ] || cp .env.example .env.local
# Set OPENROUTER_API_KEY in .env.local, then:
npm run dev
```

Model calls go directly to OpenRouter using `OPENROUTER_API_KEY`. Vercel AI
Gateway is not used for inference; no Vercel model billing setup is required.
The default model is `anthropic/claude-sonnet-5`. Change `OPENROUTER_MODEL` in
`.env.local` to try another OpenRouter model. The context budget defaults to
200,000 tokens; set `OPENROUTER_CONTEXT_WINDOW` at or below the selected model's
supported context length. Restart the dev server after changing environment variables.

If you already have `.env.local`, add these values without overwriting its other
entries. Keep the key server-side and never commit it. `eve link` is optional for
local conversations; it is used when accessing or deploying the Vercel service.

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

## Deploy and test on Vercel

Project: https://vercel.com/eddieysongs-projects/eve-test

Before deploying this version, add `OPENROUTER_API_KEY` to the project's
Production and Preview environment variables. Optionally add `OPENROUTER_MODEL`
and `OPENROUTER_CONTEXT_WINDOW` to override the defaults. Redeploy after changing
environment variables. Local `.env.local` credentials are not uploaded.

The initial deployment was uploaded directly. Git-based automatic deployments
are not connected yet. To deploy from your checkout, link the existing `eve-test`
project in the personal workspace, then deploy:

```sh
npx eve link
npx eve deploy
```

If linking refreshes `.env.local`, ensure your OpenRouter settings remain present
before running locally again. On Vercel, Eve writes its deployment bundle to
`.vercel/output`. Vercel hosts the agent; OpenRouter handles model inference.

Production URL: https://eve-test-eddieysongs-projects.vercel.app

The existing production and preview deployments still contain the earlier
Gateway configuration until this change is deployed. Do not use the earlier
preview URL to test OpenRouter.

The service exposes `/eve/v1/health` and authenticated session routes, without a
browser chat UI. The HTTP channel accepts Vercel OIDC and local development auth.
Vercel OIDC authenticates callers to the agent; it is independent of OpenRouter's
API key. Deployment Protection and agent route authentication are separate checks.

After creating a new preview deployment, use its URL with the script:

```sh
EVE_URL=https://YOUR-NEW-PREVIEW.vercel.app \
  node --env-file=.env.local scripts/chat.mjs "Hello. Who are you?"
```

The script uses `VERCEL_OIDC_TOKEN` from the linked project's development
credentials for agent authentication and Vercel's trusted OIDC header. Development
credentials normally target that project's previews; production may require an
explicit Trusted Sources policy. Only the client runs locally in this example.

## Memory and scope

Eve manages ongoing conversation sessions. This skeleton does not configure a
separate persistent memory store across sessions or let the character edit its own
identity files. Those are explicit future design decisions.

No tools, publishing integrations, schedules, or custom subagents are enabled.
Do not put private conversation logs or personal memories in this public repository.

## Verification status

The OpenRouter version installs and builds successfully with Eve 0.88.0. A mocked
model call verified that the configured agent sends requests directly to
`https://openrouter.ai/api/v1/chat/completions` with `OPENROUTER_API_KEY` and parses
the response. A live OpenRouter reply has not been tested because no key was
provided. The production and preview deployments of the earlier Gateway version
reached READY on October 29, 2026; this provider change still needs deployment
with the OpenRouter key configured.

The local build warns that no production sandbox provider is available without
Docker or Vercel. This companion has default tools disabled and uses no sandbox
tools. Build for the target environment when deploying.

Dependencies are locked in `package-lock.json`. Read the installed
`node_modules/eve/docs` when making API changes.

Docs: https://eve.dev/docs/agent-config and
https://eve.dev/docs/guides/deployment/vercel
