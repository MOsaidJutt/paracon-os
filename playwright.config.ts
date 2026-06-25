import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // The dev DB is a single SQLite file (temporary — see schema.prisma) shared
  // by every test via one dev server, so concurrent writers can starve each
  // other under load. Serial workers trade speed for reliability until the
  // suite moves to a real Postgres/Neon instance per the standing tech stack.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run dev:storage",
      url: "http://localhost:9000",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
