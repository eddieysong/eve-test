import identity from "./templates/identity.md?raw";
import soul from "./templates/soul.md?raw";
import { readDocument, type DocumentName } from "./local-store.ts";

const defaults = { "identity.md": identity, "soul.md": soul, "memory.md": "# Memory\n\n" };
export function readCompanionDocument(name: DocumentName) {
  return readDocument(name, defaults[name]);
}
