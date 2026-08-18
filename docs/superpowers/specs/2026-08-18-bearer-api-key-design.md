# Bearer API Key Authentication Design

## Goal

Allow MCP and REST API clients to submit their Milkbridge API key through either `x-api-key` or `Authorization: Bearer <key>`.

## Behavior

- `x-api-key` remains the preferred credential and wins when both headers are present.
- When `x-api-key` is absent, a case-insensitive `Bearer` authorization scheme supplies the API key.
- Empty, malformed, and non-Bearer authorization values do not supply an API key.
- Existing API-key verification, session fallback, logging, and unauthorized responses remain unchanged.

## Implementation

Add one shared, pure header-parsing helper and use it in both MCP request authentication and `/api/v1` authentication. This avoids duplicating parsing behavior while keeping the change narrowly scoped.

## Testing

Add focused unit tests covering:

- `x-api-key` authentication input
- Bearer authentication input
- Case-insensitive Bearer scheme
- malformed and empty authorization values
- `x-api-key` precedence when both headers are present
