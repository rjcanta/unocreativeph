import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Fresh throwaway SQLite file for each test run (never the dev database). */
export default function setup() {
  const cwd = path.resolve(__dirname, "..");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) fs.rmSync(path.join(cwd, `test.db${suffix}`), { force: true });
  execSync("npx prisma db push", {
    cwd,
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
}
