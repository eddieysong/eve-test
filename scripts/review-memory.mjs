import { Client } from "eve/client";

const baseUrl = process.env.EVE_URL || "http://127.0.0.1:2002";
try {
  const response = await fetch(`${baseUrl}/eve/v1/dev/schedules/memory-review`, { method: "POST" });
  if (!response.ok) throw new Error(`Could not trigger the dev schedule (HTTP ${response.status}). Start npm run dev -- --no-ui --port 2002 first.`);
  const { sessionIds } = await response.json();
  if (!Array.isArray(sessionIds) || !sessionIds.length) throw new Error("The schedule returned no session.");
  const client = new Client({ baseUrl });
  for (const id of sessionIds) {
    console.log(`Memory review session: ${id}`);
    let completed = false;
    for await (const event of client.sessions.attach(id).stream()) {
      if (event.type === "content.completed" && event.data.phase === "reply") console.log(event.data.value);
      if (event.type === "turn.settled") {
        if (event.data.outcome !== "completed") throw new Error(`Review ${event.data.outcome}.`);
        completed = true;
        break;
      }
      if (event.type === "session.ended") throw new Error("Review session ended before completing.");
    }
    if (!completed) throw new Error("Review stream ended before completing.");
  }
  console.log("Done. Open Workspace → Notes to see the review (already-reviewed inputs are skipped).");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
