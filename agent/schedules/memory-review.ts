import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 * * * *",
  content: "Run the memory-review skill once. Inspect with review_memory, skip an already-reviewed snapshot, otherwise save a concise evidence-linked report in Notes. Do not modify core memory or use any other tools except loading the skill and review_memory. Do not send messages outside this run.",
});
