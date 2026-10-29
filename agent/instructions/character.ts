import { defineDynamic } from "eve";
import { defineInstructions } from "eve/instructions";
import { readCompanionDocument } from "../lib/documents.ts";

export default defineDynamic(async () => {
  const [identity, soul] = await Promise.all([
    readCompanionDocument("identity.md"), readCompanionDocument("soul.md"),
  ]);
  return defineInstructions({ content: `${identity.content}\n\n${soul.content}` });
});
