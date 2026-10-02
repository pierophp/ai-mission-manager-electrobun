import type { DesktopApi } from "./runtime/desktop-api";

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export {};
