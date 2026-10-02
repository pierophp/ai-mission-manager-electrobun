import { createRequire } from "node:module";

// Vitest's module runner turns a static bun:sqlite import into an empty export.
// Resolve the same Bun built-in synchronously so persistence tests use Bun's DB.
const require = createRequire(import.meta.url);
const sqlite = require("bun:sqlite") as typeof import("bun:sqlite");

export const Database = sqlite.Database;
