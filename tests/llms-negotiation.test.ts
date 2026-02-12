import { describe, expect, it } from "vitest";
import { wantsMarkdownHome } from "../apps/web/lib/llms-negotiation";

describe("wantsMarkdownHome", () => {
  it("returns true for text/markdown", () => {
    expect(wantsMarkdownHome("text/markdown")).toBe(true);
  });

  it("returns true for text/md", () => {
    expect(wantsMarkdownHome("text/md")).toBe(true);
  });

  it("returns false for normal browser html accept", () => {
    expect(wantsMarkdownHome("text/html,application/xhtml+xml")).toBe(false);
  });

  it("returns false when header is missing", () => {
    expect(wantsMarkdownHome(null)).toBe(false);
  });
});
