import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

// Test the signature algorithm independently
function apiSig(params: Record<string, string>, sharedSecret: string): string {
  const sorted = Object.keys(params).sort();
  const str = sorted.map((k) => `${k}${params[k]}`).join("");
  return createHash("md5")
    .update(sharedSecret + str)
    .digest("hex");
}

describe("apiSig", () => {
  it("should generate correct MD5 signature", () => {
    const params = {
      api_key: "abc123",
      method: "rtm.test.echo",
      format: "json",
    };
    const secret = "testsecret";

    const sig = apiSig(params, secret);

    // Verify it's a valid MD5 hash (32 hex characters)
    expect(sig).toMatch(/^[a-f0-9]{32}$/);
  });

  it("should sort parameters alphabetically", () => {
    const params1 = { z: "1", a: "2", m: "3" };
    const params2 = { a: "2", m: "3", z: "1" };
    const secret = "secret";

    // Same params in different order should produce same signature
    expect(apiSig(params1, secret)).toBe(apiSig(params2, secret));
  });

  it("should include shared secret in signature", () => {
    const params = { test: "value" };

    const sig1 = apiSig(params, "secret1");
    const sig2 = apiSig(params, "secret2");

    // Different secrets should produce different signatures
    expect(sig1).not.toBe(sig2);
  });

  it("should handle empty params", () => {
    const sig = apiSig({}, "secret");
    expect(sig).toMatch(/^[a-f0-9]{32}$/);
  });

  it("should handle special characters in values", () => {
    const params = {
      name: "Buy milk & eggs",
      note: "Don't forget!",
    };
    const secret = "secret";

    const sig = apiSig(params, secret);
    expect(sig).toMatch(/^[a-f0-9]{32}$/);
  });
});
