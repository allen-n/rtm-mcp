# MCP Client Configuration Guide

This guide provides configuration examples for connecting to the RTM MCP server using different transport types and client applications.

## Transport Types

The server supports two transport modes:
- **HTTP** (default): For remote deployment and web-based clients
- **STDIO**: For local development and command-line clients

Set the transport type using the `MCP_TRANSPORT` environment variable:
```bash
export MCP_TRANSPORT=http  # or stdio
```

## HTTP Transport Configuration

### For Claude Desktop (Remote HTTP)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rtm-mcp": {
      "url": "https://your-server.com/mcp",
      "headers": {
        "x-api-key": "your-api-key-here"
      }
    }
  }
}
```

### For Development (Local HTTP)

```json
{
  "mcpServers": {
    "rtm-mcp": {
      "url": "http://localhost:8787/mcp",
      "headers": {
        "x-api-key": "dev-api-key"
      }
    }
  }
}
```

### For Web Applications

```javascript
const mcpClient = new McpClient({
  transport: {
    type: 'http',
    url: 'https://your-server.com/mcp',
    headers: {
      'x-api-key': 'your-api-key'
    }
  }
});
```

## STDIO Transport Configuration

### For Claude Desktop (Local STDIO)

```json
{
  "mcpServers": {
    "rtm-mcp": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/stdio.js"]
    }
  }
}
```

### For Development with npm

```json
{
  "mcpServers": {
    "rtm-mcp": {
      "command": "npm",
      "args": ["run", "start:stdio"],
      "cwd": "/path/to/mcp-server"
    }
  }
}
```

### For pnpm workspaces

```json
{
  "mcpServers": {
    "rtm-mcp": {
      "command": "pnpm",
      "args": ["--filter", "@apps/mcp-server", "run", "start:stdio"]
    }
  }
}
```

## Authentication Methods

### API Key Authentication

Include your API key in the request headers:
```json
{
  "headers": {
    "x-api-key": "your-api-key-here"
  }
}
```

### Session Authentication (HTTP only)

For browser-based clients, you can use session cookies. Make sure to include credentials:
```javascript
const mcpClient = new McpClient({
  transport: {
    type: 'http',
    url: 'http://localhost:8787/mcp',
    credentials: 'include'  // Include cookies
  }
});
```

## Environment Variables

### Server Configuration
```bash
# Transport type (http or stdio)
export MCP_TRANSPORT=http

# Server identification
export MCP_SERVER_NAME=rtm-mcp-server
export MCP_SERVER_VERSION=1.0.0

# HTTP server settings
export PORT=8787
export NODE_ENV=production

# CORS settings
export WEB_APP_URL=https://your-web-app.com
```

### Development Settings
```bash
# Enable debug logging
export DEBUG=mcp:*

# Disable DNS rebinding protection for local development
export NODE_ENV=development

# Use local database
export DATABASE_URL=postgresql://localhost/rtm_mcp_dev
```

## Testing Your Configuration

### 1. Health Check
```bash
curl http://localhost:8787/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "transport": {
    "type": "http",
    "status": "healthy",
    "uptime": 12345,
    "requestCount": 0,
    "errorCount": 0
  }
}
```

### 2. Test with Claude Desktop
1. Update your `claude_desktop_config.json`
2. Restart Claude Desktop
3. Look for the MCP tools icon (🔧) in the interface
4. Try a command like "List my RTM tasks"

### 3. Test STDIO Transport
```bash
# Terminal 1: Start the server
npm run dev:stdio

# Terminal 2: Test with a simple client
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | nc localhost 8787
```

## Troubleshooting

### Common Issues

1. **Transport not connecting**
   - Check the server logs: `npm run dev` (HTTP) or `npm run dev:stdio` (STDIO)
   - Verify the transport type: `echo $MCP_TRANSPORT`
   - Test health endpoint: `curl http://localhost:8787/health`

2. **Authentication failures**
   - Verify API key in headers
   - Check session cookies for browser clients
   - Ensure user has valid RTM token in database

3. **CORS issues**
   - Add your client domain to `WEB_APP_URL`
   - Check browser console for CORS errors
   - Use `credentials: 'include'` for session auth

4. **STDIO transport issues**
   - Never use `console.log()` in STDIO mode (use `console.error()`)
   - Check file paths are absolute in configuration
   - Verify Node.js version compatibility

### Debug Logging

Enable detailed logging:
```bash
export DEBUG=mcp:*,transport:*
export MCP_TRANSPORT=http  # or stdio
npm run dev
```

### Getting Help

1. Check server logs in the terminal
2. Use the `/health` endpoint to verify transport status
3. Test with both HTTP and STDIO transports
4. Review the MCP specification: https://modelcontextprotocol.io

## Security Notes

- Always use HTTPS in production
- Enable DNS rebinding protection: `NODE_ENV=production`
- Use strong API keys
- Validate CORS origins
- Keep server and dependencies updated