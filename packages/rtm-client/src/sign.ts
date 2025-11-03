import crypto from "node:crypto";

/**
 * Generate RTM API signature
 * Params must be sorted alphabetically by key
 */
export function apiSig(
  params: Record<string, string>,
  sharedSecret: string
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto
    .createHash("md5")
    .update(sharedSecret + sorted)
    .digest("hex");
}
