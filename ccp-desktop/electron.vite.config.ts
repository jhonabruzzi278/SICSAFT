import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const aliasShared = { "@shared": resolve(__dirname, "src/shared") };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliasShared },
    build: {
      rollupOptions: {
        external: ["electron"],
        input: { index: resolve(__dirname, "src/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliasShared },
    build: {
      rollupOptions: {
        external: ["electron"],
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: { root: "src/renderer", resolve: { alias: aliasShared } },
});
