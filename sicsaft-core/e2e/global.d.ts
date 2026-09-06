// `window.sicsaftCore` para que `page.evaluate(() => window.sicsaftCore.*)` tipe en las specs
// (misma API que el renderer real -- ver src/renderer/src/global.d.ts).
import type { SicsaftCoreApi } from "../src/shared/ipc-contract";

declare global {
  interface Window {
    sicsaftCore: SicsaftCoreApi;
  }
}
