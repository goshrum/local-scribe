/// <reference types="vitest" />
import { defineConfig } from "vite";

// Relative base so the production build works on GitHub Pages under any subpath.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    // Keep the worker as a real ES-module worker so transformers.js can be
    // dynamically imported inside it.
    rollupOptions: {},
  },
  worker: {
    format: "es",
  },
  // transformers.js ships a couple of node-only deps it never actually uses in
  // the browser; exclude them from optimization so Vite does not try to bundle
  // them eagerly.
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
});
