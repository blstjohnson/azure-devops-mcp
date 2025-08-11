# Configuration Examples

This directory contains example MCP configuration files for different Azure DevOps deployment scenarios.

## Files

### [`mcp-private-server.json`](./mcp-private-server.json)
Basic configuration for private/on-premises Azure DevOps Server deployments.
- Use for Team Foundation Server or Azure DevOps Server
- Requires Personal Access Token (PAT) setup
- Automatically uses Basic authentication

### [`mcp-private-multitenant.json`](./mcp-private-multitenant.json)
Configuration for private servers in multi-tenant Azure environments.
- Includes tenant ID specification for complex authentication scenarios
- Use when experiencing authentication issues in multi-tenant setups
- Helps resolve guest user access problems

### [`cursor-private-server.json`](./cursor-private-server.json)
Cursor IDE configuration for private Azure DevOps Server.
- Place in `.cursor/mcp.json` in your project
- Replace "DefaultCollection" with your actual collection name
- Follows Cursor's MCP server configuration format

## Usage

1. **Copy the appropriate example** to your project directory
2. **Rename to the correct filename**:
   - VS Code: `.vscode/mcp.json`
   - Visual Studio 2022: `.mcp.json` (in solution root)
   - Cursor: `.cursor/mcp.json`
3. **Update organization/collection names** in the configuration
4. **Ensure you have a valid PAT** for private servers
5. **Run `az login`** to authenticate

## Transport Options

### Standard MCP Transport (Default)
All the above examples use the standard stdio transport for direct integration with MCP clients.

### HTTP Streaming Transport
For web applications or scenarios requiring HTTP-based communication:

**Command Line Usage:**
```bash
mcp-server-azuredevops myorg --server-url https://tfs.company.com/DefaultCollection --transport http-streaming --http-port 3000
```

**HTTP Configuration Example:**
```json
{
  "servers": {
    "ado-http": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-pat-token-here"
      }
    }
  }
}
```

**Features:**
- REST API endpoints for MCP communication
- Custom authentication via HTTP headers
- Configurable port (default: 3000)
- Supports Bearer token authentication in request headers
- Automatic conversion to Basic auth for private servers

## Authentication Notes

- **Private servers** are automatically detected (any URL not containing `dev.azure.com`)
- **Authentication method** switches to Basic auth with PAT for private servers
- **Azure CLI login** is still required even for private servers
- **PAT permissions** should include all scopes you plan to use

For detailed setup instructions, see the [Getting Started guide](../GETTINGSTARTED.md#private-server-configuration).