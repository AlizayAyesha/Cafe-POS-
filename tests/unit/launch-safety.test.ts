import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoSeedAllowed } from "../../prisma/seed";
import { localProductUploadAllowed } from "@/lib/product-uploads";

const root = path.resolve(__dirname, "../..");

const PUBLIC_FILES = [
  "src/app/login/page.tsx",
  "src/components/login-form.tsx",
  "src/app/api/setup/route.ts",
  "prisma/seed.ts",
  "README.md",
  "docs/DEPLOYMENT.md",
  "docs/TRAINING.md",
  ".env.example",
  "scripts/smoke.ts",
];

describe("launch safety guards", () => {
  it("does not publish the old demo password on login, seed, or setup docs", () => {
    for (const file of PUBLIC_FILES) {
      const text = readFileSync(path.join(root, file), "utf8");
      expect(text, file).not.toContain("password123");
    }
  });

  it("refuses the demo seed in production unless explicitly allowed", () => {
    expect(demoSeedAllowed({ NODE_ENV: "production" }).ok).toBe(false);
    expect(demoSeedAllowed({ NODE_ENV: "production", ALLOW_DEMO_SEED: "true" }).ok).toBe(true);
    expect(demoSeedAllowed({ NODE_ENV: "development" }).ok).toBe(true);
  });

  it("allows product file uploads only outside hosted production", () => {
    expect(localProductUploadAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(localProductUploadAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(localProductUploadAllowed({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
  });

  it("does not run the seed when the module is imported", () => {
    const output = execSync(
      `npx tsx -e "import './prisma/seed.ts'; console.log('IMPORTED_NO_SEED')"`,
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: "file:./test.db", NODE_ENV: "test" },
        encoding: "utf8",
      }
    );
    expect(output).toContain("IMPORTED_NO_SEED");
    expect(output).not.toContain("Demo seed finished");
  });
});
