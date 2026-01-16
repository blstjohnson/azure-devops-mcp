# Changelog

All notable changes to the Azure DevOps MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### DevOps Infrastructure Tools (38 new tools)

Enhanced Azure DevOps Server 2020 Update 1 support with comprehensive DevOps infrastructure management capabilities. All tools tested and verified with 657 passing tests.

**Variable Groups (5 tools):**
- `variablegroups_list` - List variable groups with pagination and optional name filtering
- `variablegroups_get` - Get a specific variable group by ID with automatic secret value redaction
- `variablegroups_create_or_update` - Create a new variable group or update an existing one with full variable management
- `variablegroups_delete` - Delete a variable group by ID
- `variablegroups_update_variables` - Update specific variables within a variable group with merge or replace semantics

**Environments (7 tools):**
- `environments_list` - List deployment environments with pagination and optional name filtering
- `environments_get` - Get detailed information about a specific environment by ID
- `environments_create_or_update` - Create a new deployment environment or update an existing one
- `environments_delete` - Delete a deployment environment by ID
- `environments_add_resource` - Add a resource (VM, Kubernetes) to a deployment environment
- `environments_remove_resource` - Remove a resource from a deployment environment
- `environments_list_deployments` - List deployment history for a specific environment

**Pipelines (7 tools):**
- `pipelines_create_or_update` - Create a new YAML pipeline or update an existing pipeline definition
- `pipelines_run` - Trigger a pipeline run with optional branch, commit, and parameter specifications
- `pipelines_run_status` - Get the current status of a pipeline run with optional polling until completion
- `pipelines_cancel_run` - Cancel a running or queued pipeline execution
- `pipelines_get_logs` - Retrieve logs for a completed or running pipeline execution
- `pipelines_list_artifacts` - List all artifacts produced by a pipeline run
- `pipelines_get_artifact` - Get download URL for a specific pipeline artifact

**Service Connections (7 tools):**
- `serviceconnections_list` - List service connections (service endpoints) with optional filtering and pagination
- `serviceconnections_get` - Get detailed information about a specific service connection with automatic credential redaction
- `serviceconnections_get_or_create` - Idempotently get or create a service connection by name with dry-run support
- `serviceconnections_create_or_update` - Create a new service connection or update an existing one with full credential management
- `serviceconnections_delete` - Delete a service connection by ID
- `serviceconnections_authorize_for_pipeline` - Authorize a service connection for use in YAML pipelines
- `serviceconnections_share_with_project` - Share a service connection across multiple projects

**Releases (12 new tools - expanded from 2 to 14 total):**
- `release_get_definition` - Get detailed information about a specific release definition
- `release_create_definition` - Create a new release definition with environments and artifacts
- `release_update_definition` - Update an existing release definition configuration
- `release_delete_definition` - Delete a release definition by ID
- `release_get_release` - Get detailed information about a specific release
- `release_create_release` - Create a new release from a definition with artifact bindings
- `release_update_release` - Update release metadata and configuration
- `release_abandon_release` - Abandon an active release
- `release_deploy_environment` - Deploy a release to a specific environment (stage)
- `release_get_environment` - Get detailed environment deployment status
- `release_list_approvals` - List pending approvals with filtering options
- `release_update_approval` - Approve or reject a deployment approval

**Features:**
- Full Azure DevOps Server 2020 Update 1 compatibility
- Comprehensive error handling and validation
- Secret value redaction for secure variable management and service connections
- Credential redaction for service connection security
- Full release lifecycle support (create → deploy → approve)
- Pagination support for large datasets
- Merge and replace semantics for flexible updates
- Dry-run support for safe operations

**Credits:**
Implementation by Ekassir Ltd.

---

## Previous Versions

_This is the initial changelog entry. Previous versions were not documented in this format._