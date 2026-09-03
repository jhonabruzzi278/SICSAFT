// @ts-check
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Mismo patrón que ccp/eslint.config.mjs (flat config, ESLint 9 + typescript-eslint +
// prettier) — separado en dos bloques porque acá conviven dos runtimes en un mismo proyecto:
// src/main//src/preload/ (Node, proceso de Electron) y src/renderer/ (browser, React).
export default tseslint.config(
  {
    ignores: ["out/**", "dist/**", "release/**", "coverage/**", "resources/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: [
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "src/shared/**/*.ts",
      "electron.vite.config.ts",
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      // Igual que la convención ya usada en cis/core (handlers de IPC con parámetros que no
      // siempre se usan, ej. el "_event" de ipcRenderer.on) — sin esto, cada handler que no
      // necesita todos sus parámetros fuerza a nombrarlos igual pero raros, o a un
      // eslint-disable puntual.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Hook de electron-builder (afterPack) -- .cjs a propósito (ver el comentario real en el
    // propio archivo: "type": "module" en package.json rompe require() si no fuera .cjs), corre
    // como script Node plano fuera del pipeline de TypeScript de la app, no como parte de
    // src/main/.
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
