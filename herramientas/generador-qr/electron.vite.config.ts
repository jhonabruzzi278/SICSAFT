import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Mismo criterio de CSP por modo que sicsaft-core/electron.vite.config.ts: en dev el HMR de Vite
// necesita 'unsafe-eval'/'unsafe-inline'; en producción el build no los necesita. `img-src 'self'
// data:` es obligatorio acá: el QR se genera como data URL (misma razón que sicsaft-core).
const CSP_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws:";
const CSP_PROD =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'";

function cspPorModo(): Plugin {
  return {
    name: "generador-qr-csp-por-modo",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const csp = ctx.server ? CSP_DEV : CSP_PROD;
        return html.replace(
          "<!--CSP-->",
          `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        );
      },
    },
  };
}

const aliasShared = { "@shared": resolve(__dirname, "src/shared") };
// "@" apunta a src/renderer/src -- mismo alias que ccp/core-frontend usan para sus componentes
// portados (EtiquetaActivo.tsx, etiquetas.ts, code128.ts), así los imports `@/lib/...` /
// `@/components/...` de esos archivos funcionan sin reescribirlos.
const aliasRenderer = { "@": resolve(__dirname, "src/renderer/src") };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliasShared },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliasShared },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        // Mismo bug real ya documentado en sicsaft-core/electron.vite.config.ts: con
        // "type": "module" en package.json, electron-vite compila el preload como ESM por
        // default, pero Electron con `sandbox: true` no soporta import/export en el loader
        // sandboxeado del preload -- forzar CJS + extensión .cjs es la combinación que funciona.
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: { alias: { ...aliasShared, ...aliasRenderer } },
    plugins: [react(), tailwindcss(), cspPorModo()],
  },
});
