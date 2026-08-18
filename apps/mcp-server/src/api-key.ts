export const apiKeyAuthErrorMessage =
  "Unauthorized. Provide x-api-key or Authorization: Bearer <api-key>, or use a valid session.";

/** Selects an API key from the supported request headers. */
export function getApiKeyFromHeaders(
  xApiKey: string | undefined,
  authorization: string | undefined
): string | undefined {
  if (xApiKey) {
    return xApiKey;
  }

  const bearerMatch = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  return bearerMatch?.[1];
}
