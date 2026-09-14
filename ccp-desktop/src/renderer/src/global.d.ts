import type { CcpDesktopApi } from "@shared/ipc-contract";

declare global {
  interface Window {
    ccpDesktop: CcpDesktopApi;
  }
}
export {};
