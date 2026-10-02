import { describe, expect, it } from "vitest";
import { router } from "./router";

describe("route loading", () => {
  it("does not preload screen routes on link intent", () => {
    expect(router.options.defaultPreload).toBe(false);
  });
});
