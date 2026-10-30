import { build } from "esbuild";

await build({ entryPoints: ["web/client.js"], outfile: "agent/lib/web/client.bundle.js", bundle: true, format: "esm", platform: "browser", target: "es2022" });
