import { describe, expect, it } from "vitest";
import { corsAllowHeaders } from "../apps/mcp-server/src/cors";

describe("API key CORS", () => {
  it("allows the Authorization request header", () => {
    expect(corsAllowHeaders).toContain("Authorization");
  });
});
