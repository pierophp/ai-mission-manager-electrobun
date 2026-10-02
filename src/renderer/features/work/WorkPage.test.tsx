// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeView, ItemView } from "../../runtime/types";
import { WorkPage } from "./WorkPage";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  command: vi.fn(),
  home: undefined as unknown,
  itemDetailModuleLoaded: false,
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  const React = await import("react");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn(async () => {}) }),
    useMutation: (options: { mutationFn: (value: unknown) => Promise<unknown>; onSuccess?: (data: unknown, value: unknown) => Promise<void> }) => ({
      isPending: false,
      mutateAsync: async (value: unknown) => {
        const data = await options.mutationFn(value);
        await options.onSuccess?.(data, value);
        return data;
      },
    }),
    useQuery: (options: { queryKey: readonly unknown[]; queryFn: () => unknown }) => {
      const [data, setData] = React.useState<unknown>();
      const key = JSON.stringify(options.queryKey);
      React.useEffect(() => {
        let active = true;
        Promise.resolve(options.queryFn()).then((value) => {
          if (active) setData(value);
        });
        return () => { active = false; };
      }, [key]);
      return { data, isPending: data === undefined, isFetching: false, error: null };
    },
  };
});
vi.mock("../../components/app-shell", () => ({
  useAppShell: () => ({ openTerminal: vi.fn() }),
}));
vi.mock("./item-detail/ItemDetailPanel", () => {
  mocks.itemDetailModuleLoaded = true;
  return {
    ItemDetailPanel: () => createElement("div", null, "Item detail loaded"),
  };
});
vi.mock("../../runtime/RuntimeEventsBridge", () => ({
  usePollExternalObjects: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../runtime/command", () => ({ command: mocks.command }));
vi.mock("../../runtime/query-invalidation", () => ({
  invalidateStructureQueries: vi.fn(async () => {}),
  invalidateWorkQueries: vi.fn(async () => {}),
}));

const emptyHome = {
  attention_entries: [],
  needs_attention: [],
  running: [],
  waiting: [],
  due: [],
  completed: [],
};

const itemView: ItemView = {
  item: {
    id: 42,
    human_identifier: "I-42",
    title: "Open detail on demand",
    project_id: 2,
    status: "Inbox",
    notes: "",
    reminders: [],
  },
  context_id: 1,
  context_name: "Product",
  project_name: "App",
  relationships: [],
  workspaces: [],
  worktrees: [],
  runs: [],
  run_projections: [],
  run_signals: { grillWaiting: false, runActive: false },
  implementation_queues: [],
  links: [],
};
const homeWithItem: HomeView = { ...emptyHome, needs_attention: [itemView] };

describe("WorkPage item creation", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mocks.search = {};
    mocks.home = homeWithItem;
    mocks.itemDetailModuleLoaded = false;
    mocks.navigate.mockReset();
    mocks.command.mockReset().mockImplementation(async (name: string) => {
      if (name === "getHome") return mocks.home ?? emptyHome;
      if (name === "searchItemsCommand") return [];
      if (name === "listRunSuggestions") return [];
      if (name === "listContexts") return [{ id: 1, name: "Product" }];
      if (name === "listProjects") return [{ id: 2, context_id: 1, name: "App" }];
      if (name === "listRepositories" || name === "listRepositoryLocations" || name === "listMachines" || name === "listCliConfigurationProfiles" || name === "listContextAttentionDefaults") return [];
      if (name === "listGrillModelCatalog") return { catalogs: [], codexStatus: "available", codexError: null };
      if (name === "createItem") {
        return {
          id: 42,
          human_identifier: "APP-42",
          title: "Investigate invoice import",
          project_id: 2,
          status: "Active",
          notes: "",
          reminders: [],
        };
      }
      return undefined;
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(createElement(WorkPage)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads Item detail code only when an Item is selected", async () => {
    expect(mocks.itemDetailModuleLoaded).toBe(false);
    expect(container.textContent).not.toContain("Item detail loaded");

    await act(async () => {
      mocks.search = { item: 42 };
      root.render(createElement(WorkPage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.itemDetailModuleLoaded).toBe(true);
    expect(container.textContent).toContain("Item detail loaded");
  });

  it("does not request Settings-only Structure queries on Work", () => {
    expect(mocks.command).not.toHaveBeenCalledWith("listContextAttentionDefaults");
    expect(mocks.command).not.toHaveBeenCalledWith("listRepositoryLocations");
  });

  it("opens the newly created Item", async () => {
    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Add Item"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const titleInput = Array.from(document.querySelectorAll("label"))
      .find((label) => label.textContent?.includes("Title"))
      ?.querySelector<HTMLInputElement>("input");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
      ?.set?.call(titleInput, "Investigate invoice import");
    act(() => titleInput?.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => {
      document
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mocks.command).toHaveBeenCalledWith(
      "createItem",
      "Investigate invoice import",
      1,
      2,
      "",
    );
    const selectedItemNavigation = mocks.navigate.mock.calls
      .map(([options]) => options as { search?: unknown })
      .find((options) =>
        typeof options.search === "function" &&
        (options.search as (current: Record<string, unknown>) => Record<string, unknown>)(
          {},
        ).item === 42,
      );
    expect(selectedItemNavigation).toBeDefined();
  });
});
