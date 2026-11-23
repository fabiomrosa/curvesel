import { defineConfig } from "@playwright/test";

// Real gestures in the installed Chrome (GitHub's Ubuntu runner has it too): nothing to download.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  // A committed `test.only` would silently skip the rest of the suite.
  forbidOnly: true,
  use: { channel: "chrome", baseURL: "http://localhost:5180" },
  // The repository root: the playground at /playground/, the engine's page at /e2e/engine.html.
  webServer: {
    command: "npx vite --port 5180 --strictPort",
    url: "http://localhost:5180/e2e/engine.html",
    reuseExistingServer: false,
  },
});
