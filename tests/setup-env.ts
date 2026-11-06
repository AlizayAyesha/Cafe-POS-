/**
 * Must run before any module imports Prisma.
 * Generates the SQLite client and points every test at prisma/test.db.
 * The URL is relative to the Prisma schema directory. Never use dev.db or a hosted URL.
 */
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "..");
process.env.DATABASE_URL = "file:./test.db";

execSync("npx prisma generate --schema=prisma/schema.sqlite.prisma", {
  cwd: root,
  env: { ...process.env, DATABASE_URL: "file:./test.db" },
  stdio: "pipe",
});
