# Bearer API Key Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept Milkbridge API keys from `Authorization: Bearer <key>` in addition to `x-api-key` across MCP and REST authentication.

**Architecture:** A pure shared helper will select and parse an API key from the two supported headers. Both existing authentication paths will call the helper and retain their current verification and session-fallback logic.

**Tech Stack:** TypeScript, Hono, BetterAuth, Vitest, pnpm

---

### Task 1: Shared API-key header parsing

**Files:**
- Create: `apps/mcp-server/src/api-key.ts`
- Create: `tests/api-key.test.ts`
- Modify: `apps/mcp-server/src/http.ts:112`
- Modify: `apps/mcp-server/src/routes/api.ts:498`

- [ ] **Step 1: Write the failing tests**

Create tests that import `getApiKeyFromHeaders` and assert that it returns an `x-api-key`, falls back to a case-insensitive Bearer value, rejects missing/empty/malformed/non-Bearer authorization values, and gives `x-api-key` precedence when both are supplied.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test tests/api-key.test.ts`

Expected: FAIL because `apps/mcp-server/src/api-key.ts` does not exist.

- [ ] **Step 3: Implement the minimal parser**

Create `getApiKeyFromHeaders(xApiKey, authorization)` as a pure function. Return a truthy `xApiKey` first. Otherwise match `authorization` against a case-insensitive Bearer scheme with at least one whitespace character and a non-empty token, trim surrounding token whitespace, and return `undefined` for malformed values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm test tests/api-key.test.ts`

Expected: all API-key parser tests PASS.

- [ ] **Step 5: Use the helper in both authentication paths**

Import `getApiKeyFromHeaders` with ESM `.js` extensions in `apps/mcp-server/src/http.ts` and `apps/mcp-server/src/routes/api.ts`. Replace each direct `x-api-key` lookup with:

```ts
const apiKeyHeader = getApiKeyFromHeaders(
  c.req.header("x-api-key"),
  c.req.header("authorization")
);
```

Keep verification, logging, session fallback, and response behavior unchanged.

- [ ] **Step 6: Verify the complete change**

Run:

```bash
pnpm test tests/api-key.test.ts
pnpm --filter @apps/mcp-server typecheck
pnpm test
```

Expected: all commands exit successfully with no new warnings or errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mcp-server/src/api-key.ts apps/mcp-server/src/http.ts apps/mcp-server/src/routes/api.ts tests/api-key.test.ts docs/superpowers/plans/2026-08-18-bearer-api-key.md
git commit -m "feat: accept API keys through bearer auth"
```
