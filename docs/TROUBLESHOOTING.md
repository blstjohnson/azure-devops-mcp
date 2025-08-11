# Troubleshooting

## Common MCP Issues

1. **Clearing VS Code Cache**
   If you encounter issues with stale configurations, reload the VS Code window:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
   - Select `Developer: Reload Window`.

   If the issue persists, you can take a more aggressive approach by clearing the following folders:
   - `%APPDATA%\Code\Cache`
   - `%APPDATA%\Code\CachedData`
   - `%APPDATA%\Code\User\workspaceStorage`
   - `%APPDATA%\Code\logs`

   Clear Node Modules Cache
   - `npm cache clean --force`

2. **Server Not Showing Up in Agent Mode**
   Ensure that the `mcp.json` file is correctly configured and includes the appropriate server definitions. Restart your MCP server and reload the VS Code window.

3. **Tools Not Loading in Agent Mode**
   If tools do not appear, click "Add Context" in Agent Mode and ensure all tools starting with `ado_` are selected.

4. **Too Many Tools Selected (Over 128 Limit)**
   VS Code supports a maximum of 128 tools. If you exceed this limit, ensure you do not have multiple MCP Servers running. Check both your project's `mcp.json` and your VS Code `settings.json` to confirm that the MCP Server is configured in only one location—not both.

## Project-Specific Issues

1. **npm Authentication Issues for Remote Access**
   If you encounter authentication errors:
   - Ensure you are logged in to Azure DevOps using the `az` CLI:
     ```pwsh
     az login
     ```
   - Verify your npm configuration:
     ```pwsh
     npm config get registry
     ```
     It should point to: `https://registry.npmjs.org/`

2. **Dependency Installation Errors**
   If `npm install` fails, verify that you are using Node.js version 20 or higher. You can check your Node.js version with:
   ```pwsh
   node -v
   ```

## Authentication Issues

### Private Server Authentication Issues

If you're using a private/on-premises Azure DevOps Server and encountering authentication problems, these steps can help resolve common issues.

#### Symptoms

- Connection timeouts or "server not found" errors
- `401 Unauthorized` responses from your private server
- Tools fail to load data from your Azure DevOps Server
- Error messages mentioning authentication failures

#### Common Causes and Solutions

**1. Personal Access Token (PAT) Issues**

Ensure your PAT is properly configured:
- **Generate PAT**: Create a new PAT from your Azure DevOps Server user settings
- **Correct Scopes**: Ensure the PAT has sufficient permissions (recommend "Full access" for all tools)
- **PAT Expiration**: Check if your PAT has expired and regenerate if necessary
- **User Permissions**: Verify your user account has access to the projects and resources you're trying to access

**2. Server URL Configuration**

Verify your server URL format:
- **Correct Format**: Use full URL including collection (e.g., `https://tfs.company.com/DefaultCollection`)
- **HTTPS vs HTTP**: Ensure you're using the correct protocol (most servers require HTTPS)
- **Port Numbers**: Include port if your server uses non-standard ports (e.g., `:8080`)
- **Collection Name**: Use the correct collection name (often "DefaultCollection" but may be custom)

**3. Network and Connectivity Issues**

Check network connectivity:
- **Firewall Rules**: Ensure your firewall allows connections to the Azure DevOps Server
- **VPN Connection**: Verify VPN is active if required for internal server access
- **DNS Resolution**: Confirm the server hostname resolves correctly
- **Certificate Issues**: For self-signed certificates, ensure they're trusted by your system

**4. Azure CLI Configuration**

Verify Azure CLI setup:
```pwsh
# Check current login status
az account show

# Re-authenticate if needed
az login

# Test connectivity to your server
az devops project list --organization https://your-server/collection
```

**5. Authentication Method Detection**

The server automatically detects authentication methods based on URL patterns:
- **Cloud servers** (`*.dev.azure.com`): Uses Bearer authentication
- **Private servers** (all other URLs): Uses Basic authentication with PAT

If detection fails, verify your server URL doesn't contain `dev.azure.com` unless it's actually Azure DevOps Services.

#### Debugging Steps

1. **Test Basic Connectivity**:
   ```pwsh
   # Test if you can reach the server
   curl https://your-server/collection/_apis/projects
   ```

2. **Verify Azure CLI Integration**:
   ```pwsh
   # List projects via Azure CLI
   az devops project list --organization https://your-server/collection
   ```

3. **Check MCP Server Logs**:
   - Enable verbose logging in VS Code
   - Look for authentication-related error messages
   - Check for network timeout errors

4. **Test with Minimal Configuration**:
   Start with a basic configuration and gradually add complexity.

### Multi-Tenant Authentication Problems

If you encounter authentication errors like `TF400813: The user 'xxx' is not authorized to access this resource`, you may be experiencing multi-tenant authentication issues.

#### Symptoms

- Azure CLI (`az devops project list`) works fine
- MCP server fails with authorization errors
- You have access to multiple Azure tenants

#### Root Cause

The MCP server may be authenticating with a different tenant than your Azure DevOps organization, especially when you have access to multiple Azure tenants. The MCP server may also be using the Azure Devops Org tenant when the user belongs to a different tenant and is added as a guest user in the Azure DevOps organization.

#### Solution

1. **Identify the correct tenant ID** for your Azure DevOps organization:

   ```pwsh
   az account list
   ```

   Look for the `tenantId` field in the output for the desired tenant (for guest accounts this will be the tenant of your organization and may be different than the Azure Devops Organization tenant).

2. **Configure the MCP server with the tenant ID** by updating your `.vscode/mcp.json`:

   ```json
   {
     "inputs": [
       {
         "id": "ado_org",
         "type": "promptString",
         "description": "Azure DevOps organization name (e.g. 'contoso')"
       },
       {
         "id": "ado_tenant",
         "type": "promptString",
         "description": "Azure tenant ID (required for multi-tenant scenarios)"
       }
     ],
     "servers": {
       "ado": {
         "type": "stdio",
         "command": "mcp-server-azuredevops",
         "args": ["${input:ado_org}", "--tenant", "${input:ado_tenant}"]
       }
     }
   }
   ```

3. **Restart VS Code** completely to ensure the MCP server picks up the new configuration.

4. **When prompted**, enter:
   - Your Azure DevOps organization name
   - The tenant ID from step 1

### Private Server with Multi-Tenant Issues

If you're using a private Azure DevOps Server in a multi-tenant environment:

1. **Configure both organization and tenant**:
   ```json
   {
     "inputs": [
       {
         "id": "ado_org",
         "type": "promptString",
         "description": "Azure DevOps collection name (e.g. 'DefaultCollection')"
       },
       {
         "id": "ado_tenant",
         "type": "promptString",
         "description": "Azure tenant ID"
       }
     ],
     "servers": {
       "ado": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "--tenant", "${input:ado_tenant}"]
       }
     }
   }
   ```

2. **Identify correct tenant for private server**:
   ```pwsh
   # Check which tenant your private server authentication uses
   az account list --query "[].{Name:name, TenantId:tenantId, IsDefault:isDefault}"
   ```

3. **Test authentication with specific tenant**:
   ```pwsh
   az login --tenant YOUR_TENANT_ID
   az devops project list --organization https://your-private-server/collection
   ```

## Logging and Diagnostics

To enable detailed logging for troubleshooting:

1. **VS Code Developer Tools**:
   - Press `F12` to open Developer Tools
   - Check Console tab for error messages
   - Look for network requests that are failing

2. **Azure CLI Verbose Logging**:
   ```pwsh
   az devops project list --organization https://your-server/collection --debug
   ```

3. **Network Tracing**:
   Use tools like Fiddler or browser developer tools to trace HTTP requests and identify authentication issues.
