Before you get started, ensure you follow the steps in the `README.md` file. This will help you get up and running and connected to your Azure DevOps organization.

### Does the MCP Server support both Azure DevOps Services and on-premises deployments?

**Yes**, the MCP Server supports both Azure DevOps Services (cloud) and private/on-premises Azure DevOps Server deployments. The server automatically detects the server type and uses the appropriate authentication method:

- **Azure DevOps Services** (dev.azure.com): Uses Bearer token authentication with Azure CLI credentials
- **Private/On-premises servers**: Uses Basic authentication with Personal Access Token (PAT)

For private servers, you'll need to:
1. Generate a Personal Access Token (PAT) from your Azure DevOps Server
2. Configure the server URL in your MCP configuration
3. Ensure you're logged in with the Azure CLI using the appropriate tenant

See the [Getting Started guide](./GETTINGSTARTED.md#private-server-configuration) for detailed configuration examples.

### What's the difference between cloud and private server authentication?

The MCP Server automatically detects your server type and handles authentication appropriately:

**Azure DevOps Services (Cloud)**:
- Server URLs: `*.dev.azure.com` or `*.vsrm.dev.azure.com`
- Authentication: Bearer token (uses Azure CLI credentials)
- Setup: Run `az login` to authenticate
- Configuration: Only requires organization name

**Private/On-premises Azure DevOps Server**:
- Server URLs: Any custom domain (e.g., `tfs.company.com`, `azuredevops.mycompany.com`)
- Authentication: Basic authentication with Personal Access Token (PAT)
- Setup: Generate PAT from your Azure DevOps Server, then run `az login`
- Configuration: Requires server URL and may need tenant ID for multi-tenant scenarios

The server automatically chooses the correct authentication method based on your server URL, so no manual configuration is needed to switch between authentication types.

### Can I connect to more than one organization at a time?

No, you can connect to only one organization at a time. However, you can switch organizations as needed.

### Can I set a default project instead of fetching the list every time?

Currently, you need to fetch the list of projects so the LLM has context about the project name or ID. We plan to improve this experience in the future by leveraging prompts. In the meantime, you can set a default project name in your `copilot-instructions.md` file.
