# RTM API Skills

This guide provides practical patterns for AI agents using the RTM API.

## Base URL Rule

Use the same root domain/origin that the LLM is currently browsing.
Prefer origin-relative paths (for example, `/api/v1/invoke`) and do not hardcode a different domain.

## Authentication

All requests require an API key using either header:

```http
x-api-key: your-api-key-here
```

```http
Authorization: Bearer your-api-key-here
```

If both headers are present, `x-api-key` takes precedence.

## Invocation Pattern

```http
POST /api/v1/invoke
Content-Type: application/json
```

```json
{
  "tool": "tool_name",
  "input": {}
}
```

## Core Workflow

1. Call `get_lists` to discover list IDs.
2. Call `get_tasks` with filters (`due:today`, `status:incomplete`, etc.).
3. Create tasks with `add_task` using Smart Add syntax.
4. Modify tasks with list/taskseries/task IDs from task payloads.

## Smart Add Hints

- `^tomorrow` due date
- `!1` high priority
- `#work` tag
- `@Office` location
- `=30min` estimate

Example:

```json
{
  "tool": "add_task",
  "input": {
    "name": "Review quarterly report ^friday !1 #work"
  }
}
```

## Common Errors

- `401 Unauthorized`: missing or invalid API key
- `401 RTM token invalid`: reconnect RTM account
- `400 Invalid input`: request payload doesn’t match tool schema
- `400 Unknown tool`: invalid tool name

## Rate Limiting

Requests are rate-limited per user (~1 request / 1.1 seconds) to comply with RTM API guidelines.
