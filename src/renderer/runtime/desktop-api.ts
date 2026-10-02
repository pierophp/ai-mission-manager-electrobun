import { Electroview } from "electrobun/view";
import { eventNames, type CommandEnvelope, type DesktopEventName } from "../../shared/ipc";
import type { AppRPC } from "../../shared/electrobun-rpc";

const listeners = new Map<DesktopEventName, Set<(event: { payload: unknown }) => void>>();
const rpc = Electroview.defineRPC<AppRPC>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {},
    messages: {
      desktopEvent: ({ name, payload }) => {
        for (const listener of listeners.get(name) ?? []) listener({ payload });
      },
    },
  },
});

const requests = rpc.request as unknown as {
  invoke: (params: { name: string; args?: Record<string, unknown> }) => Promise<CommandEnvelope>;
  openDirectoryDialog: (params: { title?: string; defaultPath?: string }) => Promise<string | null>;
  revealItemInDir: (params: { filePath: string }) => Promise<void>;
  openUrl: (params: { url: string }) => Promise<void>;
};

new Electroview({ rpc });

const desktop = {
  invoke: <T>(name: string, args?: Record<string, unknown>) =>
    requests.invoke({ name, args }) as Promise<CommandEnvelope<T>>,
  listen: <T>(name: DesktopEventName, handler: (event: { payload: T }) => void) => {
    if (!eventNames.includes(name)) throw new Error(`evento não permitido: ${name}`);
    const wrapped = handler as (event: { payload: unknown }) => void;
    const handlers = listeners.get(name) ?? new Set();
    handlers.add(wrapped);
    listeners.set(name, handlers);
    return () => {
      handlers.delete(wrapped);
      if (handlers.size === 0) listeners.delete(name);
    };
  },
  openDirectoryDialog: (options?: { title?: string; defaultPath?: string }) =>
    requests.openDirectoryDialog(options ?? {}),
  revealItemInDir: (filePath: string) => requests.revealItemInDir({ filePath }),
  openUrl: (url: string) => requests.openUrl({ url }),
};

export type DesktopApi = typeof desktop;

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

window.desktop = desktop;
