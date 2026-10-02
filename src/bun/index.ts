import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { BrowserView, BrowserWindow, PATHS, Utils } from "electrobun/main";
import Electrobun from "electrobun/main";
import { createCommandDispatcher } from "../shared/ipc";
import type { AppRPC } from "../shared/electrobun-rpc";
import type { DesktopEventName } from "../shared/ipc";
import { Runtime } from "../main/runtime";
import { openSqliteStore, type SqliteStore } from "../main/persistence/sqlite-store";
import { ensureProjectWorkspaces, recoverRunStateRecords } from "../main/persistence/startup";
import { LocalSshMachineAccess } from "../main/machine-access";
import { TmuxTerminalRuntime } from "../main/terminal";
import { createMainCommandHandlers } from "../main/command-registry";
import { resolvePstackResourcePaths, verifyPstackResources } from "../main/pstack";

const execFileAsync = promisify(execFile);
const devRendererUrl = process.env.ELECTROBUN_RENDERER_URL;
let store: SqliteStore | undefined;
let mainWindow: BrowserWindow<typeof rpc> | undefined;

async function importLoginShellPath() {
  const shellPath = process.env.SHELL || "/bin/zsh";
  try {
    const { stdout } = await execFileAsync(shellPath, ["-lc", 'printf %s "$PATH"']);
    const loginPath = stdout.trim();
    if (loginPath) {
      const pathEntries = [
        ...loginPath.split(path.delimiter),
        ...(process.env.PATH ?? "").split(path.delimiter),
      ];
      process.env.PATH = [...new Set(pathEntries.filter(Boolean))].join(path.delimiter);
    }
  } catch {
    // Keep the process PATH when the configured login shell cannot be queried.
  }
}

function publishEvent(name: DesktopEventName, payload: unknown) {
  (
    rpc.send as unknown as {
      desktopEvent: (message: { name: DesktopEventName; payload: unknown }) => void;
    }
  ).desktopEvent({ name, payload });
}

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {
      invoke: ({ name, args }) => dispatchCommand(name, args ?? {}),
      openDirectoryDialog: async ({ defaultPath } = {}) => {
        const paths = await Utils.openFileDialog({
          startingFolder: defaultPath,
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        return paths[0] ?? null;
      },
      revealItemInDir: ({ filePath }) => {
        if (typeof filePath !== "string") throw new Error("caminho inválido");
        Utils.showItemInFolder(filePath);
      },
      openUrl: ({ url: rawUrl }) => {
        let url: URL;
        try {
          url = new URL(rawUrl);
        } catch {
          throw new Error("URL inválida");
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("somente URLs http e https podem ser abertas");
        }
        Utils.openExternal(url.toString());
      },
    },
    messages: {},
  },
});

let dispatchCommand = createCommandDispatcher();

function createWindow() {
  const window = new BrowserWindow({
    frame: { width: 920, height: 720 },
    title: "AI Mission Manager",
    url: devRendererUrl ?? "views://main/index.html",
    hidden: true,
    rpc,
  });
  mainWindow = window;
  window.webview.on("dom-ready", () => {
    window.show();
    if (process.env.AI_MISSION_MANAGER_OPEN_DEVTOOLS === "true" && devRendererUrl)
      window.webview.openDevTools();
  });
  window.webview.on("will-navigate", (event) => {
    const detail = (event as { data?: { detail?: string } }).data?.detail ?? "";
    const isAppNavigation = devRendererUrl
      ? detail.startsWith(devRendererUrl)
      : detail.startsWith("views://main/");
    if (!isAppNavigation) (event as { response?: { allow: boolean } }).response = { allow: false };
  });
  return window;
}

Electrobun.events.on("before-quit", () => {
  store?.close();
  store = undefined;
});

Electrobun.events.on("close", (event) => {
  const id = (event.data as { id?: number }).id;
  if (mainWindow?.id === id) mainWindow = undefined;
});

async function start() {
  console.info("[app] startup: login shell PATH");
  await importLoginShellPath();
  try {
    console.info("[app] startup: verify pstack resources");
    verifyPstackResources(resolvePstackResourcePaths(PATHS.RESOURCES_FOLDER));
    console.info("[app] startup: open SQLite store");
    store = openSqliteStore();
    console.info("[app] startup: load domain state");
    const state = store.loadState();
    const runtime = new Runtime(store, state);
    const machineAccess = new LocalSshMachineAccess();
    const terminalRuntime = new TmuxTerminalRuntime(
      machineAccess,
      store.setting("tmux_executable_path") ?? "tmux",
    );
    ensureProjectWorkspaces(runtime);
    console.info("[app] startup: recover run records");
    recoverRunStateRecords(runtime, store.path);
    const commandHandlers = createMainCommandHandlers({
      runtime,
      store,
      machineAccess,
      terminalRuntime,
      onRunStateChanged: (event) => publishEvent("run-state-changed", event),
      onTerminalEvent: (name, event) => publishEvent(name, event),
      onRunQuestionsChanged: (runId) => publishEvent("run-questions-changed", runId),
    });
    dispatchCommand = createCommandDispatcher(commandHandlers);
    console.info("[app] startup: create window");
    mainWindow = createWindow();
  } catch (error) {
    console.error("[app] startup failed", error);
    await Utils.showMessageBox({
      type: "error",
      title: "AI Mission Manager",
      message: error instanceof Error ? error.message : String(error),
      buttons: ["OK"],
    });
    store?.close();
    store = undefined;
    process.exit(1);
  }
}

void start();
