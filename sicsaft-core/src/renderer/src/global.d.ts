import type { SicsaftCoreApi } from "@shared/ipc-contract";

declare global {
  interface Window {
    sicsaftCore: SicsaftCoreApi;
  }
}
