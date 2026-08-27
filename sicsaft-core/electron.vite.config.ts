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
