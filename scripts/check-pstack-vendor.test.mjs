import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkTree } from "./check-pstack-vendor.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-vendor-"));
  fs.mkdirSync(path.join(root, "skills/poteto-mode"), { recursive: true });
  fs.writeFileSync(path.join(root, "skills/poteto-mode/SKILL.md"), "# Mode\n");
  fs.writeFileSync(path.join(root, "skills/poteto-mode/playbook.md"), "[mode](./SKILL.md)\n");
  return root;
}

test("accepts a tree with safe references", () => {
  const root = fixture();
  try {
    expect(checkTree(root)).toEqual([]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects removed Cursor-only facilities", () => {
  const forbiddenReferences = [
    ["/goal", /removed goal command/],
    ["cursor-team-kit", /removed Cursor team kit/],
    ["Bugbot", /removed Bugbot integration/],
    ['environment: "cloud"', /removed cloud execution field/],
    ["cloud_base_branch", /removed cloud base branch field/],
    ["~/.cursor/rules/file", /removed Cursor home path/],
  ];
  for (const [reference, expected] of forbiddenReferences) {
    const root = fixture();
    try {
      fs.writeFileSync(path.join(root, "README.md"), `${reference}\n`);
      expect(checkTree(root).join("\n")).toMatch(expected);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("rejects paths missing from poteto-mode", () => {
  const root = fixture();
  try {
    fs.writeFileSync(
      path.join(root, "skills/poteto-mode/playbook.md"),
      "[missing](./missing.md)\n",
    );
    expect(checkTree(root).join("\n")).toMatch(/referenced path does not exist/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects missing paths written in poteto-mode instructions", () => {
  const root = fixture();
  try {
    fs.writeFileSync(
      path.join(root, "skills/poteto-mode/playbook.md"),
      "Read `skills/poteto-mode/missing.md`.\n",
    );
    expect(checkTree(root).join("\n")).toMatch(/referenced path does not exist/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checks command arguments and ignores bare runtime file names", () => {
  const root = fixture();
  try {
    fs.mkdirSync(path.join(root, "skills/poteto-mode/scripts"), { recursive: true });
    fs.writeFileSync(path.join(root, "skills/poteto-mode/scripts/orch.ts"), "");
    fs.writeFileSync(
      path.join(root, "skills/poteto-mode/playbook.md"),
      "Use `bun scripts/orch.ts`. Keep `status.md` and `frontier.json` in the store.\n",
    );
    expect(checkTree(root)).toEqual([]);

    fs.writeFileSync(
      path.join(root, "skills/poteto-mode/playbook.md"),
      "Use `bun scripts/missing.ts`.\n",
    );
    expect(checkTree(root).join("\n")).toMatch(
      /referenced path does not exist: scripts\/missing\.ts/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
