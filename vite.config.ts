import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Pages (the demo, the browser tests' page) run on `core`'s source, never a stale `dist`.
export default defineConfig({
  resolve: {
    alias: {
      "@curvesel/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
});
