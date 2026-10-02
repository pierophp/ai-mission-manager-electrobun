import type { RPCSchema } from "electrobun/view";
import type { CommandEnvelope, DesktopEventName } from "./ipc";

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      invoke: {
        params: { name: string; args?: Record<string, unknown> };
        response: CommandEnvelope;
      };
      openDirectoryDialog: {
        params: { title?: string; defaultPath?: string };
        response: string | null;
      };
      revealItemInDir: { params: { filePath: string }; response: void };
      openUrl: { params: { url: string }; response: void };
    };
    messages: {
      desktopEvent: { name: DesktopEventName; payload: unknown };
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      desktopEvent: { name: DesktopEventName; payload: unknown };
    };
  }>;
};
