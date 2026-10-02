import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Machine } from "../domain/types";
import {
  buildPstackTreeHash,
  provisionPstackTree,
  PSTACK_TREE,
  PSTACK_TREE_HASH,
  pstackSkillSnapshot,
  pstackTreeDirectory,
  resolvePstackResourcePaths,
  verifyPstackResources,
} from "./pstack";

const localMachine = {
  id: 1,
  context_id: 1,
  name: "local",
  socket_name: "test",
  transport: { kind: "local" },
  last_observed: "unknown",
  last_observed_at: null,
} as Machine;
const sshMachine = {
  ...localMachine,
  id: 2,
  name: "remote",
  transport: {
    kind: "ssh",
    host: "example.test",
    user: null,
    port: null,
    identityFile: null,
    knownHostsFile: null,
    strictHostKeyChecking: null,
  },
} as Machine;

describe("vendored pstack resources", () => {
  it("matches Rust's ordered path, length, bytes, and executable-bit hash", () => {
    expect(buildPstackTreeHash(PSTACK_TREE)).toBe(PSTACK_TREE_HASH);
    expect(PSTACK_TREE_HASH).toBe(
      "e703a1d0f440c3a796e40973f2c284220b1aa45604ddd75fb9bb199540dde018",
    );
    expect(pstackSkillSnapshot()).toContain("pstack version 0.15.5");
  });

  it("resolves app resources consistently and verifies the manifest", () => {
    const resources = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-app-resources-"));
    try {
      const appResources = path.join(resources, "app");
      fs.mkdirSync(appResources);
      fs.cpSync(path.join(process.cwd(), "agents/pstack"), path.join(appResources, "pstack"), {
        recursive: true,
      });
      fs.copyFileSync(
        path.join(process.cwd(), "src/main/pstack-manifest.json"),
        path.join(appResources, "pstack-manifest.json"),
      );
      const paths = resolvePstackResourcePaths(resources);
      expect(paths).toEqual({
        treeDirectory: path.join(appResources, "pstack"),
        manifestFile: path.join(appResources, "pstack-manifest.json"),
      });
      expect(() => verifyPstackResources(paths)).not.toThrow();
      fs.appendFileSync(path.join(paths.treeDirectory, "README.md"), " modified");
      expect(() => verifyPstackResources(paths)).toThrow(
        "pstack packaged resources do not match the embedded pstack manifest",
      );
    } finally {
      fs.rmSync(resources, { recursive: true, force: true });
    }
  });

  it("provisions into a temporary tree and reuses the content-addressed directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-local-"));
    try {
      const target = pstackTreeDirectory(root);
      expect(await provisionPstackTree(localMachine, {} as never, root)).toBe(target);
      const file = PSTACK_TREE.find((entry) => entry.path.endsWith("SKILL.md"))!;
      const actual = path.join(target, file.path);
      expect(fs.readFileSync(actual).toString("base64")).toBe(file.base64);
      expect(fs.statSync(actual).mode & 0o111 ? true : false).toBe(file.executable);
      const inode = fs.statSync(actual).ino;
      await provisionPstackTree(localMachine, {} as never, root);
      expect(fs.statSync(actual).ino).toBe(inode);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("streams the full remote manifest as stdin with the Rust-compatible command", async () => {
    const root = "/home/agent";
    const runShell = vi.fn(async (_machine: Machine, _command: string, input?: Uint8Array) => {
      expect(Buffer.from(input ?? []).toString()).toContain("skills/poteto-mode/SKILL.md\n");
      return "";
    });
    const target = await provisionPstackTree(sshMachine, { runShell } as never, root);
    expect(target).toBe(pstackTreeDirectory(root));
    expect(runShell).toHaveBeenCalledOnce();
    expect(runShell.mock.calls[0]![1]).toContain("base64 -d");
    expect(runShell.mock.calls[0]![1]).toContain('mv "$temporary" "$target"');
  });
});
