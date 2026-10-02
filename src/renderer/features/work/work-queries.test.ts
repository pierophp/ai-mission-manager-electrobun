import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activityQueryOptions,
  externalCommentsQueryOptions,
  externalDocumentQueryOptions,
  homeQueryOptions,
  issueDocumentQueryOptions,
  searchQueryOptions,
} from "./work-queries";

vi.mock("./work-commands", () => ({
  workCommands: {
    searchItems: vi.fn(async () => []),
  },
}));

const largeInactiveQueryGcTime = 30_000;
const defaultQueryGcTime = 5 * 60 * 1000;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: defaultQueryGcTime } },
  });
}

describe("large work query retention", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the retention window short for large query results", () => {
    expect(homeQueryOptions(undefined).gcTime).toBe(largeInactiveQueryGcTime);
    expect(searchQueryOptions("task", undefined).gcTime).toBe(
      largeInactiveQueryGcTime,
    );
    expect(issueDocumentQueryOptions(1).gcTime).toBe(largeInactiveQueryGcTime);
    expect(externalDocumentQueryOptions(1).gcTime).toBe(
      largeInactiveQueryGcTime,
    );
    expect(externalCommentsQueryOptions(1).gcTime).toBe(
      largeInactiveQueryGcTime,
    );
    expect(activityQueryOptions().gcTime).toBe(largeInactiveQueryGcTime);
  });

  it("collects inactive searches after 30 seconds", async () => {
    vi.useFakeTimers();
    const client = createQueryClient();
    const options = searchQueryOptions("older search", undefined);

    await client.prefetchQuery(options);
    expect(client.getQueryCache().find({ queryKey: options.queryKey })).toBeDefined();

    await vi.advanceTimersByTimeAsync(largeInactiveQueryGcTime);

    expect(client.getQueryCache().find({ queryKey: options.queryKey })).toBeUndefined();
    client.clear();
  });

  it("retains an active search and collects it after it becomes inactive", async () => {
    vi.useFakeTimers();
    const client = createQueryClient();
    const options = searchQueryOptions("current search", undefined);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.refetch();

    await vi.advanceTimersByTimeAsync(largeInactiveQueryGcTime);
    expect(client.getQueryCache().find({ queryKey: options.queryKey })).toBeDefined();

    unsubscribe();
    await vi.advanceTimersByTimeAsync(largeInactiveQueryGcTime);
    expect(client.getQueryCache().find({ queryKey: options.queryKey })).toBeUndefined();
    client.clear();
  });
});
