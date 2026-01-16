# ⭐ Azure DevOps MCP Server

Easily install the Azure DevOps MCP Server for VS Code or VS Code Insiders:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

This TypeScript project provides a **local** MCP server for Azure DevOps, enabling you to perform a wide range of Azure DevOps tasks directly from your code editor. Supports both **Azure DevOps Services** (cloud) and **private/on-premises Azure DevOps Server** deployments with automatic authentication detection.

> 🚨 **Public Preview:** This project is in public preview. Tools and features may change before general availability.

## 📄 Table of Contents

1. [📺 Overview](#-overview)
2. [🏆 Expectations](#-expectations)
3. [⚙️ Supported Tools](#️-supported-tools)
4. [🔌 Installation & Getting Started](#-installation--getting-started)
5. [📝 Troubleshooting](#-troubleshooting)
6. [🎩 Examples & Best Practices](#-samples--best-practices)
7. [🙋‍♀️ Frequently Asked Questions](#️-frequently-asked-questions)
8. [📌 Contributing](#-contributing)

## 📺 Overview

The Azure DevOps MCP Server brings Azure DevOps context to your agents. Try prompts like:

- "List my ADO projects"
- "List ADO Builds for 'Contoso'"
- "List ADO Releases for 'Contoso'"
- "List ADO Repos for 'Contoso'"
- "List test plans for 'Contoso'"
- "List teams for project 'Contoso'"
- "List iterations for project 'Contoso'"
- "List my work items for project 'Contoso'"
- "List work items in current iteration for 'Contoso' project and 'Contoso Team'"

## 🏆 Expectations

The Azure DevOps MCP Server is built from tools that are concise, simple, focused, and easy to use—each designed for a specific scenario. We intentionally avoid complex tools that try to do too much. The goal is to provide a thin abstraction layer over the REST APIs, making data access straightforward and letting the language model handle complex reasoning.

## ⚙️ Supported Tools

Interact with these Azure DevOps services:

### 🧿 Core

- **core_list_project_teams**: Retrieve a list of teams for the specified Azure DevOps project.
- **core_list_projects**: Retrieve a list of projects in your Azure DevOps organization.
- **core_get_identity_ids**: Retrieve Azure DevOps identity IDs for a list of unique names.

### ⚒️ Work

- **work_list_team_iterations**: Retrieve a list of iterations for a specific team in a project.
- **work_create_iterations**: Create new iterations in a specified Azure DevOps project.
- **work_assign_iterations**: Assign existing iterations to a specific team in a project.

### 📅 Work Items

- **wit_my_work_items**: Retrieve a list of work items relevant to the authenticated user.
- **wit_list_backlogs**: Retrieve a list of backlogs for a given project and team.
- **wit_list_backlog_work_items**: Retrieve a list of backlogs for a given project, team, and backlog category.
- **wit_get_work_item**: Get a single work item by ID.
- **wit_get_work_items_batch_by_ids**: Retrieve a list of work items by IDs in batch.
- **wit_update_work_item**: Update a work item by ID with specified fields.
- **wit_create_work_item**: Create a new work item in a specified project and work item type.
- **wit_list_work_item_comments**: Retrieve a list of comments for a work item by ID.
- **wit_get_work_items_for_iteration**: Retrieve a list of work items for a specified iteration.
- **wit_add_work_item_comment**: Add a comment to a work item by ID.
- **wit_add_child_work_items**: Create one or more child work items of a specific work item type for the given parent ID.
- **wit_list_work_item_attachments**: List all attachments for a specific work item with metadata including ID, filename, size, and creation date.
- **wit_download_work_item_attachment**: Download attachment content from a work item as base64-encoded data with metadata.
- **wit_upload_work_item_attachment**: Upload new attachments to work items with file validation and automatic linking.
- **wit_delete_work_item_attachment**: Remove attachments from work items with proper cleanup and error handling.
- **wit_link_work_item_to_pull_request**: Link a single work item to an existing pull request.
- **wit_get_work_item_type**: Get a specific work item type.
- **wit_get_query**: Get a query by its ID or path.
- **wit_get_query_results_by_id**: Retrieve the results of a work item query given the query ID.
- **wit_update_work_items_batch**: Update work items in batch.
- **wit_work_items_link**: Link work items together in batch.
- **wit_work_item_unlink**: Unlink one or many links from a work item.

#### Deprecated Tools

- **wit_add_child_work_item**: Replaced by `wit_add_child_work_items` to allow creating one or more child items per call.
- **wit_close_and_link_workitem_duplicates**: This tool is no longer needed. Finding and marking duplicates can be done with other tools.

### 📁 Repositories

- **repo_list_repos_by_project**: Retrieve a list of repositories for a given project.
- **repo_list_pull_requests_by_repo**: Retrieve a list of pull requests for a given repository.
- **repo_list_pull_requests_by_project**: Retrieve a list of pull requests for a given project ID or name.
- **repo_list_branches_by_repo**: Retrieve a list of branches for a given repository.
- **repo_list_my_branches_by_repo**: Retrieve a list of your branches for a given repository ID.
- **repo_list_pull_requests_by_commits**: List pull requests associated with commits.
- **repo_list_pull_request_threads**: Retrieve a list of comment threads for a pull request.
- **repo_list_pull_request_thread_comments**: Retrieve a list of comments in a pull request thread.
- **repo_get_repo_by_name_or_id**: Get the repository by project and repository name or ID.
- **repo_get_branch_by_name**: Get a branch by its name.
- **repo_get_pull_request_by_id**: Get a pull request by its ID.
- **repo_create_pull_request**: Create a new pull request.
- **repo_update_pull_request_status**: Update the status of an existing pull request to active or abandoned.
- **repo_update_pull_request**: Update various fields of an existing pull request (title, description, draft status, target branch).
- **repo_update_pull_request_reviewers**: Add or remove reviewers for an existing pull request.
- **repo_reply_to_comment**: Replies to a specific comment on a pull request.
- **repo_resolve_comment**: Resolves a specific comment thread on a pull request.
- **repo_search_commits**: Searches for commits.
- **repo_create_pull_request_thread**: Creates a new comment thread on a pull request.

### 📦 Variable Groups

- **variablegroups_list**: List variable groups with pagination and optional name filtering.
- **variablegroups_get**: Get a specific variable group by ID with automatic secret value redaction.
- **variablegroups_create_or_update**: Create a new variable group or update an existing one with full variable management.
- **variablegroups_delete**: Delete a variable group by ID.
- **variablegroups_update_variables**: Update specific variables within a variable group with merge or replace semantics.

### 🌍 Environments

- **environments_list**: List deployment environments with pagination and optional name filtering.
- **environments_get**: Get detailed information about a specific environment by ID.
- **environments_create_or_update**: Create a new deployment environment or update an existing one.
- **environments_delete**: Delete a deployment environment by ID.
- **environments_add_resource**: Add a resource (VM, Kubernetes) to a deployment environment.
- **environments_remove_resource**: Remove a resource from a deployment environment.
- **environments_list_deployments**: List deployment history for a specific environment.

### 🔄 Pipelines

- **pipelines_create_or_update**: Create a new YAML pipeline or update an existing pipeline definition.
- **pipelines_run**: Trigger a pipeline run with optional branch, commit, and parameter specifications.
- **pipelines_run_status**: Get the current status of a pipeline run with optional polling until completion.
- **pipelines_cancel_run**: Cancel a running or queued pipeline execution.
- **pipelines_get_logs**: Retrieve logs for a completed or running pipeline execution.
- **pipelines_list_artifacts**: List all artifacts produced by a pipeline run.
- **pipelines_get_artifact**: Get download URL for a specific pipeline artifact.

### 🛰️ Builds

- **build_get_definitions**: Retrieve a list of build definitions for a given project.
- **build_get_definition_revisions**: Retrieve a list of revisions for a specific build definition.
- **build_get_builds**: Retrieve a list of builds for a given project.
- **build_get_log**: Retrieve the logs for a specific build.
- **build_get_log_by_id**: Get a specific build log by log ID.
- **build_get_changes**: Get the changes associated with a specific build.
- **build_run_build**: Trigger a new build for a specified definition.
- **build_get_status**: Fetch the status of a specific build.
- **build_update_build_stage**: Update the stage of a specific build.

### 🔌 Service Connections

- **serviceconnections_list**: List service connections (service endpoints) with optional filtering and pagination.
- **serviceconnections_get**: Get detailed information about a specific service connection with automatic credential redaction.
- **serviceconnections_get_or_create**: Idempotently get or create a service connection by name with dry-run support.
- **serviceconnections_create_or_update**: Create a new service connection or update an existing one with full credential management.
- **serviceconnections_delete**: Delete a service connection by ID.
- **serviceconnections_authorize_for_pipeline**: Authorize a service connection for use in YAML pipelines.
- **serviceconnections_share_with_project**: Share a service connection across multiple projects.

### 🚀 Releases

- **release_get_definitions**: List release definitions with filtering and pagination support.
- **release_get_releases**: List releases with comprehensive filtering options.
- **release_get_definition**: Get detailed information about a specific release definition.
- **release_create_definition**: Create a new release definition with environments and artifacts.
- **release_update_definition**: Update an existing release definition configuration.
- **release_delete_definition**: Delete a release definition by ID.
- **release_get_release**: Get detailed information about a specific release.
- **release_create_release**: Create a new release from a definition with artifact bindings.
- **release_update_release**: Update release metadata and configuration.
- **release_abandon_release**: Abandon an active release.
- **release_deploy_environment**: Deploy a release to a specific environment (stage).
- **release_get_environment**: Get detailed environment deployment status.
- **release_list_approvals**: List pending approvals with filtering options.
- **release_update_approval**: Approve or reject a deployment approval.

### 🔒 Advanced Security

- **advsec_get_alerts**: Retrieve Advanced Security alerts for a repository.
- **advsec_get_alert_details**: Get detailed information about a specific Advanced Security alert.

### 🧪 Testing Intelligence Platform

#### Test Plans & Management
- **testplan_create_test_plan**: Create a new test plan in the project.
- **testplan_create_test_case**: Create a new test case work item.
- **testplan_add_test_cases_to_suite**: Add existing test cases to a test suite.
- **testplan_list_test_plans**: Retrieve a paginated list of test plans from an Azure DevOps project. Allows filtering for active plans and toggling detailed information.
- **testplan_list_test_cases**: Get a list of test cases in the test plan.
- **testplan_show_test_results_from_build_id**: Get a list of test results for a given project and build ID.

#### Test Analytics & Intelligence 🧠
- **testanalytics_detect_flaky_tests**: Intelligent flaky test detection with statistical analysis, pattern recognition, confidence scoring, and historical trend analysis.
- **testanalytics_quality_metrics**: Comprehensive quality metrics including test coverage analysis, success rate trends, execution time analysis, and defect density correlation.
- **testanalytics_performance_analysis**: Performance insights with execution time trends, resource utilization patterns, performance regression detection, and bottleneck identification.
- **testanalytics_risk_assessment**: Risk-based testing insights with code change impact analysis, test selection optimization, risk scoring, and predictive failure analysis.
- **testanalytics_team_productivity**: Team performance metrics including test authoring velocity, maintenance effort analysis, and resource optimization suggestions.

#### Test Reporting & Visualization 📊
- **testreporting_generate_standard_reports**: Standard report generation with multiple format support (PDF, Excel, HTML, JSON, CSV).
- **testreporting_create_custom_reports**: Custom report builder with drag-and-drop designer, custom metrics, templates, and scheduled generation.
- **testreporting_export_data**: Data export capabilities with raw data extraction, filtered datasets, API feeds, and BI tool integration.
- **testreporting_manage_dashboards**: Dashboard management with real-time test dashboards, executive views, team-specific dashboards, and alerting.

### 🔎 Search

- **search_code**: Get code search results for a given search text.
- **search_wiki**: Get wiki search results for a given search text.
- **search_workitem**: Get work item search results for a given search text.

## 🔌 Installation & Getting Started

For the best experience, use Visual Studio Code and GitHub Copilot. The server automatically detects your Azure DevOps deployment type and uses the appropriate authentication method:

- **Azure DevOps Services** (`*.dev.azure.com`): Bearer token authentication
- **Private/On-premises servers**: Basic authentication with Personal Access Token (PAT)

See the [getting started documentation](./docs/GETTINGSTARTED.md) to use our MCP Server with other tools such as Visual Studio 2022, Claude Code, and Cursor.

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders)
2. Install [Node.js](https://nodejs.org/en/download) 20+
3. Install [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)
4. Open VS Code in an empty folder

### Authentication

The MCP Server supports both Azure DevOps Services (cloud) and private Azure DevOps Server deployments:

#### Azure DevOps Services (Cloud)
For cloud deployments, ensure you are logged in via the Azure CLI:

```sh
az login
```

#### Private/On-premises Azure DevOps Server
For private servers, you'll need:
1. A Personal Access Token (PAT) generated from your Azure DevOps Server
2. Azure CLI login for authentication: `az login`

The server automatically detects your deployment type based on the server URL and uses the appropriate authentication method.

For detailed configuration examples, see the [Getting Started guide](./docs/GETTINGSTARTED.md#private-server-configuration).

### Transport Options

The MCP server supports two transport protocols:

#### Standard MCP Transport (Default)
Uses stdio communication for direct integration with MCP clients:
```bash
mcp-server-azuredevops <organization> --server-url <url>
```

#### HTTP Streaming Transport
For scenarios requiring HTTP-based communication:
```bash
mcp-server-azuredevops <organization> --server-url <url> --transport http-streaming --http-port 3000
```

**HTTP Streaming Features:**
- REST API endpoints for MCP communication
- Custom authentication via HTTP headers
- Configurable port (default: 3000)
- Supports Bearer token authentication in request headers
- Ideal for web applications and remote integrations

**Authentication with HTTP Streaming:**
- Pass Bearer token in `Authorization: Bearer <token>` header
- Server automatically handles cloud vs private server authentication
- Fallback to Azure CLI credentials if no token provided

### Installation

#### ✨ One-Click Install

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

After installation, select GitHub Copilot Agent Mode and refresh the tools list. Learn more about Agent Mode in the [VS Code Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode).

#### 🧨 Install from Public Feed (Recommended)

This installation method is the easiest for all users of Visual Studio Code.

🎥 [Watch this quick start video to get up and running in under two minutes!](https://youtu.be/EUmFM6qXoYk)

##### Steps

In your project, add a `.vscode\mcp.json` file with the following content:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}"]
    }
  }
}
```

Save the file, then click 'Start'.

<img src="./docs/media/start-mcp-server.gif" alt="start mcp server" width="250"/>

In chat, switch to [Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).

Click "Select Tools" and choose the available tools.

<img src="./docs/media/configure-mcp-server-tools.gif" alt="configure mcp server tools" width="300"/>

Open GitHub Copilot Chat and try a prompt like `List ADO projects`.

> 💥 We strongly recommend creating a `.github\copilot-instructions.md` in your project. This will enhance your experience using the Azure DevOps MCP Server with GitHub Copilot Chat.
> To start, just include "`This project uses Azure DevOps. Always check to see if the Azure DevOps MCP server has a tool relevant to the user's request`" in your copilot instructions file.

See the [getting started documentation](./docs/GETTINGSTARTED.md) to use our MCP Server with other tools such as Visual Studio 2022, Claude Code, and Cursor.

For private server configuration examples, see the [configuration examples](./docs/examples/).

## 📝 Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## 🎩 Examples & Best Practices

Explore example prompts in our [Examples documentation](./docs/EXAMPLES.md).

For best practices and tips to enhance your experience with the MCP Server, refer to the [How-To guide](./docs/HOWTO.md).

## 🙋‍♀️ Frequently Asked Questions

For answers to common questions about the Azure DevOps MCP Server, see the [Frequently Asked Questions](./docs/FAQ.md).

## 📌 Contributing

We welcome contributions! During preview, please file issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

- 🛠️ Development setup
- ✨ Adding new tools
- 📝 Code style & testing
- 🔄 Pull request process

## 🤝 Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## 📈 Project Stats

[![Star History Chart](https://api.star-history.com/svg?repos=microsoft/azure-devops-mcp&type=Date)](https://star-history.com/#microsoft/azure-devops-mcp)

## 🏆 Hall of Fame

Thanks to all contributors who make this project awesome! ❤️

[![Contributors](https://contrib.rocks/image?repo=microsoft/azure-devops-mcp)](https://github.com/microsoft/azure-devops-mcp/graphs/contributors)

> Generated with [contrib.rocks](https://contrib.rocks)

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
