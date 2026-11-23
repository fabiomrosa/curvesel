import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run on the source: `core/dist` does not exist in a clean clone before the build.
export default defineConfig({
  resolve: {
    alias: {
      "@curvesel/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
});
