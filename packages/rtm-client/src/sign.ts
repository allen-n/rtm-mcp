import crypto from "node:crypto";

/**
 * Generate RTM API signature
 * Params must be sorted alphabetically by key
 */
export function apiSig(
  params: Record<string, string>,
  sharedSecret: string
): string {
  if (!sharedSecret) {
    throw new Error("RTM shared secret is required to sign requests");
  }

  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto
    .createHash("md5")
    .update(sharedSecret + sorted)
    .digest("hex");
}
