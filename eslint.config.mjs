// ESLint flat config.
//
// `eslint-config-next`'s own entry point loads typescript-eslint, which cannot run on TypeScript 7
// (https://github.com/typescript-eslint/typescript-eslint/issues/10940). Type checking is already done by
// `tsc` (npm run typecheck), so linting parses TS/TSX with Babel and keeps the same Next.js, React Hooks and
// jsx-a11y rule sets that eslint-config-next would apply.
import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";

const parserFor = (isTSX) => ({
  parser: babelParser,
  sourceType: "module",
  ecmaVersion: "latest",
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: [
        ["@babel/preset-typescript", { allExtensions: true, isTSX }],
        ["@babel/preset-react", { runtime: "automatic" }],
      ],
    },
  },
});

export default defineConfig([
  globalIgnores([
    ".next/**", "node_modules/**", "next-env.d.ts", ".agents/**", ".aider-desk/**", ".claude/**",
    ".playwright-mcp/**", "docs/**", "supabase/**", "public/**", "scripts/**",
  ]),
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Identifiers are resolved by `tsc`; the Babel parser does not model type-only bindings.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
    },
  },
  { files: ["tests/**"], rules: { "no-control-regex": "off" } },
  { files: ["**/*.ts", "**/*.mjs"], languageOptions: parserFor(false) },
  { files: ["**/*.tsx"], languageOptions: parserFor(true) },
]);
