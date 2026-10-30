import { defineTool } from "eve/tools";
import { isScheduleAuth } from "eve/schedules";
import { z } from "zod";
import { readReviewSnapshot, reviewReportSchema, saveReviewReport } from "../lib/memory-review.ts";

export default defineTool({
  description: "Inspect recent locally captured user messages, core memory, and saved notes, then save an evidence-linked review in Notes. Use the memory-review skill. Never applies suggestions to memory.md. Already-reviewed snapshots do not need another report.",
  inputSchema: z.object({
    action: z.enum(["inspect", "save"]),
    version: z.string().length(64).optional().describe("For save: the version returned by inspect."),
    summary: reviewReportSchema.shape.summary.optional().describe("For save: a concise review summary."),
    suggestions: reviewReportSchema.shape.suggestions.optional().describe("For save: evidence-linked suggestions, or an empty array."),
  }),
  execute(input, ctx) {
    const auth = ctx.session.auth.current;
    if (auth?.authenticator !== "local-dev" && !isScheduleAuth(auth)) throw new Error("Memory review is available only to the local owner and scheduled checks.");
    if (input.action === "inspect") return readReviewSnapshot();
    if (!input.version) throw new Error("Inspect first and pass its version when saving.");
    const report = reviewReportSchema.parse({ summary: input.summary, suggestions: input.suggestions });
    return saveReviewReport(input.version, report, ctx.session.id);
  },
});
