import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-6-luna-fast",
  reasoning: "low",
  defaultTools: false,
  limits: {
    sessionUsage: ({ window }) => window.outputTokens >= 10_000,
  },
});
