import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"] },
});
