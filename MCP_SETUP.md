# MCP Server Setup Guide

This guide will help you set up the Remember The Milk MCP server with Claude Desktop.

## Prerequisites

- Node.js 18+ installed
- Claude Desktop installed
- A Remember The Milk account
- An account on your RTM MCP server web app

## Step 1: Sign Up and Connect RTM

1. Visit your MCP server web app (e.g., `http://localhost:3000`)
2. Sign up for an account or log in
3. Click "Connect Remember The Milk" on the dashboard
4. Authorize the application on the Remember The Milk website
5. You'll be redirected back to the dashboard

## Step 2: Generate an API Key

1. On the dashboard, scroll to the "MCP API Keys" section
2. Click "Create API Key"
3. Enter a descriptive name (e.g., "Claude Desktop")
4. Click "Create"
5. **Important:** Copy the API key immediately - you won't be able to see it again!
6. Store the key somewhere safe (like a password manager)

## Step 3: Install mcp-remote

The MCP server runs over HTTP, so you'll need `mcp-remote` to connect Claude Desktop to it.

```bash
npm install -g mcp-remote
```

## Step 4: Configure Claude Desktop

### macOS

1. Find your current Node.js path (should be v22 or higher):
   ```bash
   which node
   # Example output: /Users/yourname/.nvm/versions/node/v22.21.0/bin/node
   ```

2. Get the npx path from the same directory:
   ```bash
   # If your node is at /Users/yourname/.nvm/versions/node/v22.21.0/bin/node
   # Then npx is at /Users/yourname/.nvm/versions/node/v22.21.0/bin/npx
   ```

3. Open the Claude Desktop configuration file:
   ```bash
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

4. Add the RTM MCP server configuration with the **full path to npx**:
   ```json
   {
     "mcpServers": {
       "rtm": {
         "command": "/Users/yourname/.nvm/versions/node/v22.21.0/bin/npx",
         "args": [
           "mcp-remote",
           "http://localhost:8787/mcp",
           "--header",
           "x-api-key: YOUR_API_KEY_HERE"
         ]
       }
     }
   }
   ```

5. **Important:** Replace:
   - The `command` path with your actual npx path from step 2
   - `YOUR_API_KEY_HERE` with the API key you generated in Step 2
   - The URL if your server is running on a different host/port

**Why use the full path?** Claude Desktop doesn't inherit your shell's PATH or nvm configuration, so it may find an older Node.js version. Using the full path ensures it uses the correct Node.js version (v18+).

### Windows

1. Open the Claude Desktop configuration file:
   ```powershell
   notepad %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Follow the same configuration as macOS above

### Linux

1. Open the Claude Desktop configuration file:
   ```bash
   nano ~/.config/Claude/claude_desktop_config.json
   ```

2. Follow the same configuration as macOS above

## Step 5: Restart Claude Desktop

1. Completely quit Claude Desktop
2. Restart Claude Desktop
3. The RTM MCP server should now be available

## Step 6: Verify the Connection

In Claude Desktop, try asking:

```
Can you list my Remember The Milk tasks?
```

Claude should be able to access your RTM tasks through the MCP server.

## Using Environment Variables (Recommended)

For better security, you can store your API key in an environment variable:

### macOS/Linux

1. Add to your `~/.zshrc` or `~/.bashrc`:
   ```bash
   export RTM_MCP_API_KEY="your_api_key_here"
   ```

2. Update the Claude Desktop configuration:
   ```json
   {
     "mcpServers": {
       "rtm": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "http://localhost:8787/mcp",
           "--header",
           "x-api-key: ${RTM_MCP_API_KEY}"
         ]
       }
     }
   }
   ```

3. Restart your terminal and Claude Desktop

### Windows

1. Set the environment variable:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('RTM_MCP_API_KEY', 'your_api_key_here', 'User')
   ```

2. Update the Claude Desktop configuration:
   ```json
   {
     "mcpServers": {
       "rtm": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "http://localhost:8787/mcp",
           "--header",
           "x-api-key: %RTM_MCP_API_KEY%"
         ]
       }
     }
   }
   ```

3. Restart Claude Desktop

## Troubleshooting

### Server Crashes with "SyntaxError" or Node.js Version Errors

**Problem:** You see errors like:
```
SyntaxError: The requested module 'node:fs/promises' does not provide an export named 'constants'
```

**Solution:** Claude Desktop is using an outdated Node.js version. You **must** use the full path to npx with Node.js v18 or higher:

1. Find your Node.js path:
   ```bash
   which node
   # Should show v18+ like: /Users/yourname/.nvm/versions/node/v22.21.0/bin/node
   ```

2. Update your Claude Desktop config to use the full path:
   ```json
   {
     "mcpServers": {
       "rtm": {
         "command": "/Users/yourname/.nvm/versions/node/v22.21.0/bin/npx",
         "args": [
           "mcp-remote",
           "http://localhost:8787/mcp",
           "--header",
           "x-api-key: YOUR_API_KEY_HERE"
         ]
       }
     }
   }
   ```

3. Replace the path with your actual npx path
4. Completely quit and restart Claude Desktop

### "Unauthorized" Error

- Verify your API key is correct
- Check that the API key hasn't been deleted from the dashboard
- Ensure the header format is correct: `x-api-key: YOUR_KEY`

### "Connection Refused" Error

- Verify the MCP server is running (check `http://localhost:8787/health`)
- Check that the URL in your configuration matches where the server is running
- Ensure there are no firewall rules blocking the connection

### API Key Not Working

- Make sure you copied the entire key when it was first displayed
- Try creating a new API key
- Check the server logs for authentication errors

### MCP Server Not Showing in Claude Desktop

- Verify the configuration file syntax is valid JSON
- Check Claude Desktop logs for errors
- Make sure `mcp-remote` is installed: `npm list -g mcp-remote`
- Ensure you're using Node.js v18 or higher (use full path to npx)

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables** instead of hardcoding keys
3. **Rotate keys regularly** - delete old keys and create new ones
4. **Use descriptive names** for keys so you know where they're used
5. **Delete unused keys** immediately from the dashboard
6. **Monitor key usage** - check the "Last used" date on the dashboard

## Managing API Keys

### Viewing Your Keys

- Log in to the dashboard
- Scroll to the "MCP API Keys" section
- You'll see all your active keys with creation and last used dates

### Deleting a Key

- Click the "Delete" button next to the key you want to remove
- The key will be immediately revoked and won't work anymore
- Update your Claude Desktop configuration if you were using that key

### Key Expiration

- Currently, keys don't expire by default
- You can manually delete and recreate keys to rotate them

## Rate Limiting

The API key plugin includes rate limiting:

- **Limit:** 1000 requests per hour per API key
- If you exceed this limit, you'll receive a 429 (Too Many Requests) error
- The limit resets every hour

## Support

If you encounter issues:

1. Check the MCP server logs
2. Verify your Remember The Milk connection status on the dashboard
3. Try creating a new API key
4. Ensure your RTM account is properly connected

## Production Deployment

When deploying to production:

1. Update the URL in the Claude Desktop configuration to your production server
2. Ensure your server is running over HTTPS
3. Set up proper CORS configuration for your domain
4. Use environment variables for the API key
5. Monitor API key usage and set up alerts for unusual activity

## Example Configuration (Production)

```json
{
  "mcpServers": {
    "rtm": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-server.com/mcp",
        "--header",
        "x-api-key: ${RTM_MCP_API_KEY}"
      ]
    }
  }
}
```

Replace `https://your-server.com` with your actual production server URL.
