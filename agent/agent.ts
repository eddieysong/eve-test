import { defineAgent } from "eve";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const contextWindow = Number(process.env.OPENROUTER_CONTEXT_WINDOW ?? 200_000);
if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) {
  throw new Error("OPENROUTER_CONTEXT_WINDOW must be a positive integer.");
}

export default defineAgent({
  model: openrouter.chat(
    process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5",
  ),
  modelContextWindowTokens: contextWindow,
  defaultTools: false,
  limits: {
    sessionUsage: ({ window }) => window.outputTokens >= 10_000,
  },
});
