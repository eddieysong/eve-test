import { Client } from "eve/client";

const message = process.argv.slice(2).join(" ").trim();
if (!message) {
  console.error('Usage: npm run chat -- "Hello"');
  process.exit(1);
}

try {
  const client = new Client({
    baseUrl: process.env.EVE_URL ?? "http://127.0.0.1:2000",
    ...(process.env.VERCEL_OIDC_TOKEN
      ? { auth: { vercelOidc: { token: () => process.env.VERCEL_OIDC_TOKEN } } }
      : {}),
    ...(process.env.EVE_BEARER_TOKEN
      ? { headers: { Authorization: `Bearer ${process.env.EVE_BEARER_TOKEN}` } }
      : {}),
  });
  const delivery = process.env.EVE_SESSION_ID
    ? await client.sessions.attach(process.env.EVE_SESSION_ID).send(message)
    : (await client.sessions.create({ message })).delivery;

  console.error(`Session: ${delivery.sessionId}`);
  const result = await delivery.result();
  if (result.status === "completed") {
    console.log(result.reply);
  } else if (result.status === "awaiting-input") {
    console.error("Input required:", JSON.stringify(result.interactions, null, 2));
    process.exitCode = 2;
  } else {
    console.error(`Turn ${result.status}`, result.error?.code ?? "");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Agent request failed");
  process.exitCode = 1;
}
