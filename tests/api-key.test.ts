import { describe, expect, it } from "vitest";
import {
  apiKeyAuthErrorMessage,
  getApiKeyFromHeaders,
} from "../apps/mcp-server/src/api-key";

describe("API key authentication", () => {
  it("describes both API key headers and session fallback", () => {
    expect(apiKeyAuthErrorMessage).toBe(
      "Unauthorized. Provide x-api-key or Authorization: Bearer <api-key>, or use a valid session."
    );
  });

  it("returns the x-api-key header", () => {
    expect(getApiKeyFromHeaders("x-key", undefined)).toBe("x-key");
  });

  it("returns a Bearer API key when x-api-key is absent", () => {
    expect(getApiKeyFromHeaders(undefined, "Bearer bearer-key")).toBe(
      "bearer-key"
    );
  });

  it("accepts a case-insensitive Bearer scheme", () => {
    expect(getApiKeyFromHeaders(undefined, "bEaReR bearer-key")).toBe(
      "bearer-key"
    );
  });

  it.each([
    undefined,
    "",
    "Bearer",
    "Bearer   ",
    "Basic bearer-key",
  ])("rejects a missing or malformed authorization value: %s", (authorization) => {
    expect(getApiKeyFromHeaders(undefined, authorization)).toBeUndefined();
  });

  it("gives x-api-key precedence when both headers are present", () => {
    expect(getApiKeyFromHeaders("x-key", "Bearer bearer-key")).toBe("x-key");
  });
});
