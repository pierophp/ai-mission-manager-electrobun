import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decide } from "./state-transition";
import type { DomainState } from "./model";

function fixture(): DomainState {
  return JSON.parse(
    readFileSync("src/main/persistence/fixtures/domain-state.json", "utf8"),
  ) as DomainState;
}

describe("structurally shared domain transitions", () => {
  it("preserves the input and event while sharing unchanged state branches", () => {
    const state = fixture();
    const before = structuredClone(state);
    const event = {
      type: "set_link_attention_policy" as const,
      linkId: state.links[0]!.id,
      policy: { title: false, state: true, metadata: false },
    };

    const decision = decide(state, event);

    expect(state).toEqual(before);
    expect(Object.isFrozen(state)).toBe(false);
    expect(Object.isFrozen(event.policy)).toBe(false);
    expect(decision.state.contexts).toBe(state.contexts);
    expect(decision.state.links).not.toBe(state.links);
    expect(decision.state.links[0]!.attention_policy).toEqual(event.policy);
    event.policy.title = true;
    expect(decision.state.links[0]!.attention_policy?.title).toBe(false);
  });

  it("returns detached, cloneable persistence effects", () => {
    const state = fixture();
    const decision = decide(state, { type: "create_context", name: "Structural sharing probe" });
    const clonedEffects = structuredClone(decision.effects);
    const contextEffect = clonedEffects.find((effect) => effect.type === "persist_context");

    expect(contextEffect).toBeDefined();
    expect(contextEffect?.type === "persist_context" && contextEffect.context).not.toBe(
      decision.state.contexts.at(-1),
    );
    expect(decision.state.contexts.at(-1)?.name).toBe("Structural sharing probe");
  });
});
