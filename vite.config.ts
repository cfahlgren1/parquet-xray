import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  // MapLibre is one ~1 MB chunk, loaded only for files with geometry columns.
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  test: { include: ["tests/**/*.test.ts"] },
});
