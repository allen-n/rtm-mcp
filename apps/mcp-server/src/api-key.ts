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
