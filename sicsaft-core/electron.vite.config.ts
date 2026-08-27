import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// electron-vite compila los 3 procesos (main/preload/renderer) con Vite en un solo comando —
// evita mantener 3 pipelines de build a mano. `externalizeDepsPlugin` deja las dependencias de
// node_modules como require() externos en main/preload (no las bundlea) — necesario porque los
// binarios nativos que se van a sumar (drivers de Postgres, etc.) no se pueden empaquetar con
// esbuild/rollup de todos modos.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        // Bug real (2026-08-27): con "type": "module" en package.json, electron-vite compila
        // el preload como ESM (out/preload/index.mjs) por default -- pero Electron con
        // `sandbox: true` (ver src/main/index.ts) carga preload scripts con su propio loader
        // sandboxeado, que NO soporta `import`/`export` bajo ninguna extensión ("Cannot use
        // import statement outside a module", encontrado con DevTools real). Forzar CJS acá +
        // extensión .cjs (que Node/Electron siempre trata como CommonJS, sin importar
        // "type": "module") es la combinación real que lo resuelve -- src/main/index.ts
        // apunta a esta misma extensión.
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
