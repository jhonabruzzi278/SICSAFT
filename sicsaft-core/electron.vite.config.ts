import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CSP por modo: en dev el runtime de HMR de Vite necesita eval()/new Function() para el module
// transform y sirve el CSS inline (bug real 2026-08-27: sin 'unsafe-eval' la ventana quedaba en
// blanco). En el build de producción Vite bundlea sin eval y `@tailwindcss/vite` emite el CSS a
// un archivo con <link> (nada inline), así que el CSP puede ser estricto -- sin 'unsafe-eval' ni
// 'unsafe-inline', que es lo que SonarCloud (Web:S7039) marca. El renderer del wizard solo habla
// con el proceso principal por IPC (contextBridge), nunca hace fetch, de ahí `connect-src 'self'`.
const CSP_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:";
const CSP_PROD =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'";

function cspPorModo(): Plugin {
  return {
    name: "sicsaft-csp-por-modo",
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

// electron-vite compila los 3 procesos (main/preload/renderer) con Vite en un solo comando —
// evita mantener 3 pipelines de build a mano. `externalizeDepsPlugin` deja las dependencias de
// node_modules como require() externos en main/preload (no las bundlea) — necesario porque los
// binarios nativos que se van a sumar (drivers de Postgres, etc.) no se pueden empaquetar con
// esbuild/rollup de todos modos.
// `@shared` (src/shared/) lo importan los 3 procesos: ipc-contract.ts (tipos, en los 3),
// slugificar.ts (runtime, en main desde core-provisioning.ts). El alias hay que declararlo en
// cada bloque -- electron-vite compila main/preload/renderer con configs de Vite separadas.
const aliasShared = { "@shared": resolve(__dirname, "src/shared") };

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
    resolve: { alias: aliasShared },
    plugins: [react(), tailwindcss(), cspPorModo()],
  },
});
