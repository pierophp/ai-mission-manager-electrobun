import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usage: { data: undefined as unknown, error: null as unknown },
  mutate: vi.fn(),
}));

vi.mock("./plan-usage-queries", () => ({
  usePlanUsageQuery: () => mocks.usage,
  useRefreshPlanUsageMutation: () => ({ isPending: false, mutate: mocks.mutate }),
}));

import type { PlanUsageSnapshot } from "../../runtime/types";
import { PlanUsageButton } from "./PlanUsageButton";

function renderButton(
  snapshot: PlanUsageSnapshot,
  profileAssignments: {
    profileId: number;
    provider: "claude" | "codex";
    profileName?: string;
  }[],
  contextName = "All contexts",
) {
  mocks.usage = { data: snapshot, error: null };
  return renderToStaticMarkup(createElement(PlanUsageButton, { contextName, profileAssignments }));
}

const usage = (profiles: PlanUsageSnapshot["profiles"]): PlanUsageSnapshot => ({
  profiles,
  fetchedAt: 1_790_731_000,
  status: "ready",
});

const profile = (
  profileId: number,
  provider: "claude" | "codex",
  profileName: string,
  usedPercent: number,
) => ({
  profileId,
  provider,
  profileName,
  machineId: 1,
  machineName: "This Mac",
  state: "ready" as const,
  detail: null,
  plan: null,
  observedAt: null,
  windows: [{ id: "rolling", label: "5h", usedPercent, resetsAt: null }],
});

describe("PlanUsageButton", () => {
  beforeEach(() => {
    mocks.usage = { data: undefined, error: null };
    mocks.mutate.mockClear();
  });

  it("shows each current-context provider percentage in the trigger", () => {
    const html = renderButton(
      usage([
        profile(1, "claude", "Personal Claude", 35),
        profile(2, "codex", "Work Codex", 72),
        profile(3, "claude", "Other context", 99),
      ]),
      [
        { profileId: 1, provider: "claude" },
        { profileId: 2, provider: "codex" },
      ],
      "Personal",
    );

    expect(html).toContain("Claude");
    expect(html).toContain("35%");
    expect(html).toContain("Codex");
    expect(html).toContain("72%");
    expect(html).not.toContain("99%");
    expect(html).toContain("Plan usage for Personal: Claude 35 percent, Codex 72 percent");
  });

  it("disambiguates repeated provider profiles across all contexts", () => {
    const html = renderButton(
      usage([profile(1, "claude", "Personal", 35), profile(2, "claude", "Client", 72)]),
      [
        { profileId: 1, provider: "claude", profileName: "Personal" },
        { profileId: 2, provider: "claude", profileName: "Client" },
      ],
    );

    expect(html).toContain("Claude (Personal)");
    expect(html).toContain("Claude (Client)");
  });
});
