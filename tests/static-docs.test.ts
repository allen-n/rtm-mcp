import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStaticDocReader } from "../apps/mcp-server/src/static-docs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("createStaticDocReader", () => {
  it("reads static docs from a docs directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mcp-docs-"));
    tempDirs.push(dir);

    await writeFile(path.join(dir, "llms.txt"), "hello docs", "utf8");

    const readDoc = createStaticDocReader(dir);
    await expect(readDoc("llms.txt")).resolves.toBe("hello docs");
  });

  it("caches responses by filename", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mcp-docs-"));
    tempDirs.push(dir);

    const file = path.join(dir, "skills.md");
    await writeFile(file, "first", "utf8");

    const readDoc = createStaticDocReader(dir);
    await expect(readDoc("skills.md")).resolves.toBe("first");

    await writeFile(file, "second", "utf8");
    await expect(readDoc("skills.md")).resolves.toBe("first");
  });

  it("rejects path traversal attempts", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mcp-docs-"));
    tempDirs.push(dir);

    const readDoc = createStaticDocReader(dir);
    await expect(readDoc("../secret.txt")).rejects.toThrow(
      "Invalid static doc name"
    );
  });
});
