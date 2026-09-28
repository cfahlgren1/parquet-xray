import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

export default ts.config(
  { ignores: ["dist", "playwright-report", "test-results"] },
  js.configs.recommended,
  ts.configs.strict,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: { projectService: true, extraFileExtensions: [".svelte"], parser: ts.parser, svelteConfig },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "svelte/no-at-html-tags": "error",
    },
  },
);
