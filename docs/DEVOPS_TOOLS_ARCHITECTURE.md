# Azure DevOps Tools Architecture Specification

**Document Version:** 1.0  
**Date:** 2025-11-22  
**Author:** Architect Mode  
**Status:** Approved for Implementation  

---

## Executive Summary

This document provides comprehensive architecture and implementation specifications for adding three new tool categories to the Azure DevOps MCP Server:

1. **Pipelines Tools** (7 tools) - YAML pipeline management
2. **Environments Tools** (7 tools) - Environment and deployment management  
3. **Variable Groups Tools** (5 tools) - Variable group and library management

All tools are designed for **Azure DevOps Server 2020 Update 1 compatibility** (API versions 5.1-6.0) while maintaining forward compatibility with Azure DevOps Services.

---

## Table of Contents

- [1. Project Context](#1-project-context)
- [2. Architecture Overview](#2-architecture-overview)
- [3. Pipelines Tools Specification](#3-pipelines-tools-specification)
- [4. Environments Tools Specification](#4-environments-tools-specification)
- [5. Variable Groups Tools Specification](#5-variable-groups-tools-specification)
- [6. Implementation Patterns](#6-implementation-patterns)
- [7. Testing Strategy](#7-testing-strategy)
- [8. Integration Checklist](#8-integration-checklist)
- [9. API Compatibility Matrix](#9-api-compatibility-matrix)

---

## 1. Project Context

### 1.1 Existing Codebase Patterns

The project follows these established patterns:

```typescript
// File structure
src/tools/{category}.ts           // Tool implementations
test/src/tools/{category}.test.ts // Unit tests

// Copyright header (ALL NEW FILES)
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

// Tool constant naming
const {CATEGORY}_TOOLS = {
  action_name: "{category}_{action}",
  // ... more tools
};

// Configuration function
function configure{Category}Tools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  server.tool(
    TOOL_NAME,
    "Tool description",
    zodSchema,
    async (params) => {
      // Implementation
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

### 1.2 Key Dependencies

- **Zod**: Schema validation (`z.object()`, `z.string()`, etc.)
- **Azure DevOps Node API**: `azure-devops-node-api` package
- **Authentication**: Automatic detection (Bearer for cloud, Basic for on-premise)
- **Utils**: `apiVersion`, `getEnumKeys()`, `safeEnumConvert()`, `getAuthorizationHeader()`

### 1.3 API Version Strategy

- **Default API Version**: `7.2-preview.1` (defined in `src/utils.ts`)
- **Server 2020 Support**: Must work with API versions 5.1-6.0
- **Compatibility Approach**: Use lowest common denominator endpoints where possible
- **Cloud-Only Features**: Document clearly with fallback behavior

---

## 2. Architecture Overview

### 2.1 File Structure

```
src/tools/
├── pipelines.ts           # NEW: 7 YAML pipeline tools
├── environments.ts        # NEW: 7 environment management tools
├── variablegroups.ts      # NEW: 5 variable group tools
└── ... (existing files)

test/src/tools/
├── pipelines.test.ts      # NEW: Pipelines tool tests
├── environments.test.ts   # NEW: Environments tool tests
├── variablegroups.test.ts # NEW: Variable groups tool tests
└── ... (existing files)
```

### 2.2 Registration Flow

```typescript
// src/tools.ts
import { configurePipelinesTools } from "./tools/pipelines.js";
import { configureEnvironmentsTools } from "./tools/environments.js";
import { configureVariableGroupsTools } from "./tools/variablegroups.js";

function configureAllTools(...) {
  // ... existing tools
  configurePipelinesTools(server, tokenProvider, connectionProvider);
  configureEnvironmentsTools(server, tokenProvider, connectionProvider);
  configureVariableGroupsTools(server, tokenProvider, connectionProvider);
}
```

### 2.3 Common Patterns

All tools follow these patterns:

1. **Input Validation**: Zod schemas with descriptive error messages
2. **Error Handling**: Try/catch with proper error formatting
3. **Response Format**: JSON stringified with 2-space indentation
4. **Authentication**: Automatic via `connectionProvider()` and `tokenProvider()`
5. **API Calls**: Use Azure DevOps Node API when available, fetch() for advanced features

---

## 3. Pipelines Tools Specification

### 3.1 Overview

YAML pipelines are the modern CI/CD solution in Azure DevOps. These tools manage pipeline definitions and runs.

**File**: `src/tools/pipelines.ts`  
**Tool Count**: 7  
**Primary API**: Pipelines REST API (6.0-preview)

### 3.2 Tool Definitions

```typescript
const PIPELINES_TOOLS = {
  create_or_update: "pipelines_create_or_update",
  run: "pipelines_run",
  run_status: "pipelines_run_status", 
  cancel_run: "pipelines_cancel_run",
  get_logs: "pipelines_get_logs",
  list_artifacts: "pipelines_list_artifacts",
  get_artifact: "pipelines_get_artifact"
};
```

### 3.3 Tool Schemas

#### 3.3.1 `pipelines_create_or_update`

Create or update a YAML pipeline configuration.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().optional().describe("Pipeline ID (for update)"),
  name: z.string().describe("Pipeline name"),
  folder: z.string().optional().describe("Folder path (e.g., '\\\\MyFolder')"),
  repository: z.object({
    id: z.string().describe("Repository ID"),
    name: z.string().describe("Repository name"),
    type: z.enum(["azureReposGit", "github", "githubEnterprise", "bitbucket"]).describe("Repository type")
  }).describe("Repository configuration"),
  yamlPath: z.string().describe("Path to YAML file in repository (e.g., 'azure-pipelines.yml')"),
  description: z.string().optional().describe("Pipeline description")
}
```

**Azure DevOps API Endpoint**:
- **Create**: `POST https://dev.azure.com/{organization}/{project}/_apis/pipelines?api-version=6.0-preview.1`
- **Update**: `PUT https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}?api-version=6.0-preview.1`

**Implementation Notes**:
- Check if pipeline exists by name first to determine create vs update
- For Server 2020, ensure repository type is supported
- Return full pipeline object including ID

**Response Format**:
```json
{
  "id": 123,
  "name": "My Pipeline",
  "folder": "\\MyFolder",
  "configuration": {
    "type": "yaml",
    "path": "azure-pipelines.yml",
    "repository": {
      "id": "repo-guid",
      "type": "azureReposGit"
    }
  },
  "_links": {
    "self": "...",
    "web": "..."
  }
}
```

#### 3.3.2 `pipelines_run`

Trigger a pipeline run with optional parameters.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().describe("Pipeline ID to run"),
  branch: z.string().optional().describe("Branch to run (e.g., 'refs/heads/main')"),
  stagesToRun: z.array(z.string()).optional().describe("Specific stages to run"),
  templateParameters: z.record(z.string(), z.any()).optional().describe("Template parameters"),
  variables: z.record(z.string(), z.string()).optional().describe("Runtime variables")
}
```

**Azure DevOps API Endpoint**:
- `POST https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs?api-version=6.0-preview.1`

**Request Body**:
```json
{
  "resources": {
    "repositories": {
      "self": {
        "refName": "refs/heads/main"
      }
    }
  },
  "stagesToSkip": [],
  "templateParameters": {},
  "variables": {}
}
```

**Implementation Notes**:
- Default branch to repository's default if not specified
- Validate stagesToRun against pipeline definition
- Return run object with buildNumber and state

#### 3.3.3 `pipelines_run_status`

Get the status of a pipeline run.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().describe("Pipeline ID"),
  runId: z.number().describe("Run ID"),
  includeTimeline: z.boolean().default(false).describe("Include timeline data"),
  includeStages: z.boolean().default(true).describe("Include stage information")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}?api-version=6.0-preview.1`

**Response Format**:
```json
{
  "id": 456,
  "name": "20241122.1",
  "state": "completed",
  "result": "succeeded",
  "createdDate": "2024-11-22T10:00:00Z",
  "finishedDate": "2024-11-22T10:15:00Z",
  "pipeline": {
    "id": 123,
    "name": "My Pipeline"
  },
  "stages": [...]
}
```

#### 3.3.4 `pipelines_cancel_run`

Cancel a running pipeline.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().describe("Pipeline ID"),
  runId: z.number().describe("Run ID to cancel")
}
```

**Azure DevOps API Endpoint**:
- `PATCH https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}?api-version=6.0-preview.1`

**Request Body**:
```json
{
  "state": "canceling"
}
```

#### 3.3.5 `pipelines_get_logs`

Get logs for a pipeline run.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().describe("Pipeline ID"),
  runId: z.number().describe("Run ID"),
  logId: z.number().optional().describe("Specific log ID (optional)")
}
```

**Azure DevOps API Endpoint**:
- List logs: `GET https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/logs?api-version=6.0-preview.1`
- Get log: `GET https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/logs/{logId}?api-version=6.0-preview.1`

**Implementation Notes**:
- If logId not provided, return list of available logs
- If logId provided, return the specific log content
- Logs are returned as plain text

#### 3.3.6 `pipelines_list_artifacts`

List artifacts produced by a pipeline run.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().describe("Pipeline ID"),
  runId: z.number().describe("Run ID")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/artifacts?api-version=6.0-preview.1`

#### 3.3.7 `pipelines_get_artifact`

Get download URL for a specific artifact.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  pipelineId: z.number().describe("Pipeline ID"),
  runId: z.number().describe("Run ID"),
  artifactName: z.string().describe("Artifact name")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/artifacts?artifactName={artifactName}&api-version=6.0-preview.1`

---

## 4. Environments Tools Specification

### 4.1 Overview

Environments provide deployment targets and approval gates for release pipelines.

**File**: `src/tools/environments.ts`  
**Tool Count**: 7  
**Primary API**: Distributed Task REST API (6.0-preview)

### 4.2 Tool Definitions

```typescript
const ENVIRONMENTS_TOOLS = {
  list: "environments_list",
  get: "environments_get",
  create_or_update: "environments_create_or_update",
  delete: "environments_delete",
  add_resource: "environments_add_resource",
  remove_resource: "environments_remove_resource",
  list_deployments: "environments_list_deployments"
};
```

### 4.3 Tool Schemas

#### 4.3.1 `environments_list`

List environments in a project.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  name: z.string().optional().describe("Filter by environment name"),
  top: z.number().default(50).optional().describe("Maximum number of environments"),
  continuationToken: z.string().optional().describe("Continuation token for pagination")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments?api-version=6.0-preview.1`

**Response Format**:
```json
{
  "count": 2,
  "value": [
    {
      "id": 1,
      "name": "Production",
      "description": "Production environment",
      "createdBy": {...},
      "createdOn": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### 4.3.2 `environments_get`

Get a specific environment by ID.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  environmentId: z.number().describe("Environment ID"),
  includeResources: z.boolean().default(false).describe("Include environment resources"),
  includeLatestDeployments: z.boolean().default(false).describe("Include latest deployments")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}?api-version=6.0-preview.1`

#### 4.3.3 `environments_create_or_update`

Create or update an environment.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  environmentId: z.number().optional().describe("Environment ID (for update)"),
  name: z.string().describe("Environment name"),
  description: z.string().optional().describe("Environment description")
}
```

**Azure DevOps API Endpoint**:
- **Create**: `POST https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments?api-version=6.0-preview.1`
- **Update**: `PATCH https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}?api-version=6.0-preview.1`

**Request Body**:
```json
{
  "name": "Production",
  "description": "Production environment"
}
```

**Implementation Notes**:
- Check if environment exists by name for idempotency
- Update returns modified environment object
- Name must be unique within project

#### 4.3.4 `environments_delete`

Delete an environment.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  environmentId: z.number().describe("Environment ID to delete"),
  forceDelete: z.boolean().default(false).describe("Force delete even if resources exist")
}
```

**Azure DevOps API Endpoint**:
- `DELETE https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}?api-version=6.0-preview.1`

**Implementation Notes**:
- Check for dependent deployments before deletion
- If forceDelete is false and dependencies exist, return error
- Return success confirmation with deleted environment ID

#### 4.3.5 `environments_add_resource`

Add a resource (e.g., Kubernetes, VM) to an environment.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  environmentId: z.number().describe("Environment ID"),
  resourceType: z.enum(["virtualMachine", "kubernetes", "generic"]).describe("Resource type"),
  resourceName: z.string().describe("Resource name"),
  tags: z.array(z.string()).optional().describe("Resource tags"),
  metadata: z.record(z.string(), z.any()).optional().describe("Additional metadata")
}
```

**Azure DevOps API Endpoint**:
- Kubernetes: `POST https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}/providers/kubernetes?api-version=6.0-preview.1`
- Virtual Machine: `POST https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}/providers/virtualmachines?api-version=6.0-preview.1`

**Implementation Notes**:
- Different resource types have different endpoints
- Validate metadata based on resourceType
- Return created resource with ID

#### 4.3.6 `environments_remove_resource`

Remove a resource from an environment.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  environmentId: z.number().describe("Environment ID"),
  resourceId: z.number().describe("Resource ID to remove")
}
```

**Azure DevOps API Endpoint**:
- `DELETE https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}/providers/{providerId}/resources/{resourceId}?api-version=6.0-preview.1`

#### 4.3.7 `environments_list_deployments`

List deployments to an environment.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  environmentId: z.number().describe("Environment ID"),
  top: z.number().default(50).optional().describe("Maximum number of deployments"),
  continuationToken: z.string().optional().describe("Continuation token")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/distributedtask/environments/{environmentId}/environmentdeploymentrecords?api-version=6.0-preview.1`

---

## 5. Variable Groups Tools Specification

### 5.1 Overview

Variable groups centralize variable management across pipelines.

**File**: `src/tools/variablegroups.ts`  
**Tool Count**: 5  
**Primary API**: Distributed Task REST API (6.0-preview)

### 5.2 Tool Definitions

```typescript
const VARIABLEGROUPS_TOOLS = {
  list: "variablegroups_list",
  get: "variablegroups_get",
  create_or_update: "variablegroups_create_or_update",
  delete: "variablegroups_delete",
  update_variables: "variablegroups_update_variables"
};
```

### 5.3 Tool Schemas

#### 5.3.1 `variablegroups_list`

List variable groups in a project.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  groupName: z.string().optional().describe("Filter by group name"),
  top: z.number().default(50).optional().describe("Maximum number of groups"),
  continuationToken: z.string().optional().describe("Continuation token")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/distributedtask/variablegroups?api-version=6.0-preview.2`

**Response Format**:
```json
{
  "count": 2,
  "value": [
    {
      "id": 1,
      "name": "Production-Config",
      "description": "Production variables",
      "type": "Vsts",
      "variables": {
        "ApiUrl": {
          "value": "https://api.prod.example.com",
          "isSecret": false
        }
      }
    }
  ]
}
```

#### 5.3.2 `variablegroups_get`

Get a specific variable group.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  groupId: z.number().describe("Variable group ID")
}
```

**Azure DevOps API Endpoint**:
- `GET https://dev.azure.com/{organization}/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2`

**Implementation Notes**:
- Secret values are returned as empty strings for security
- Include metadata about when last modified

#### 5.3.3 `variablegroups_create_or_update`

Create or update a variable group.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  groupId: z.number().optional().describe("Group ID (for update)"),
  name: z.string().describe("Variable group name"),
  description: z.string().optional().describe("Group description"),
  variables: z.record(z.string(), z.object({
    value: z.string().describe("Variable value"),
    isSecret: z.boolean().default(false).describe("Is secret variable")
  })).describe("Variables in the group"),
  type: z.enum(["Vsts", "AzureKeyVault"]).default("Vsts").describe("Variable group type")
}
```

**Azure DevOps API Endpoint**:
- **Create**: `POST https://dev.azure.com/{organization}/{project}/_apis/distributedtask/variablegroups?api-version=6.0-preview.2`
- **Update**: `PUT https://dev.azure.com/{organization}/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2`

**Request Body**:
```json
{
  "name": "Production-Config",
  "description": "Production variables",
  "type": "Vsts",
  "variables": {
    "ApiUrl": {
      "value": "https://api.prod.example.com",
      "isSecret": false
    },
    "ApiKey": {
      "value": "secret-value",
      "isSecret": true
    }
  }
}
```

**Implementation Notes**:
- For updates, include all variables (not just changed ones)
- Secret values cannot be read back once set
- Check if name exists for idempotent create

#### 5.3.4 `variablegroups_delete`

Delete a variable group.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  groupId: z.number().describe("Variable group ID to delete"),
  forceDelete: z.boolean().default(false).describe("Force delete even if in use")
}
```

**Azure DevOps API Endpoint**:
- `DELETE https://dev.azure.com/{organization}/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2`

**Implementation Notes**:
- Check for pipeline dependencies before deletion
- If forceDelete is false and in use, return error with pipeline references
- Return success with deleted group ID

#### 5.3.5 `variablegroups_update_variables`

Update specific variables in a variable group without full group update.

**Zod Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  groupId: z.number().describe("Variable group ID"),
  addVariables: z.record(z.string(), z.object({
    value: z.string(),
    isSecret: z.boolean().default(false)
  })).optional().describe("Variables to add"),
  updateVariables: z.record(z.string(), z.object({
    value: z.string(),
    isSecret: z.boolean().optional()
  })).optional().describe("Variables to update"),
  removeVariables: z.array(z.string()).optional().describe("Variable names to remove")
}
```

**Azure DevOps API Endpoint**:
- `PUT https://dev.azure.com/{organization}/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2`

**Implementation Notes**:
- Get current group first
- Merge changes with existing variables
- Send complete updated group back
- Return updated group object

---

## 6. Implementation Patterns

### 6.1 File Template

```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { apiVersion, getAuthorizationHeader } from "../utils.js";

const {CATEGORY}_TOOLS = {
  action1: "{category}_action1",
  // ... more tools
};

function configure{Category}Tools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  
  // Tool 1
  server.tool(
    {CATEGORY}_TOOLS.action1,
    "Tool description",
    {
      // Zod schema
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        // Implementation
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Failed to {action}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // ... more tools
}

export { {CATEGORY}_TOOLS, configure{Category}Tools };
```

### 6.2 Error Handling Pattern

```typescript
try {
  // Operation code
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Operation failed: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
} catch (error) {
  throw new Error(`Failed to perform action: ${error instanceof Error ? error.message : String(error)}`);
}
```

### 6.3 Fetch vs Azure DevOps API

**Use Azure DevOps Node API when**:
- Standard CRUD operations exist
- Methods are well-documented
- No advanced features needed

**Use fetch() when**:
- Advanced API features not in Node API
- Need direct control over request
- Preview APIs not yet in library

```typescript
// Fetch pattern
const token = await tokenProvider();
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": getAuthorizationHeader(connection.serverUrl, token.token)
  },
  body: JSON.stringify(requestBody)
});
```

### 6.4 Pagination Pattern

```typescript
{
  top: z.number().default(50).optional().describe("Maximum number of results"),
  skip: z.number().default(0).optional().describe("Number to skip"),
  continuationToken: z.string().optional().describe("Continuation token")
}

// In implementation:
const params = new URLSearchParams();
if (top) params.append("$top", top.toString());
if (skip) params.append("$skip", skip.toString());
if (continuationToken) params.append("continuationToken", continuationToken);
```

### 6.5 API Version Compatibility

```typescript
// For Server 2020 compatibility, use specific API versions
const pipelinesApiVersion = "6.0-preview.1"; // Supported on Server 2020
const environmentsApiVersion = "6.0-preview.1"; // Supported on Server 2020
const variableGroupsApiVersion = "6.0-preview.2"; // Supported on Server 2020

// Build endpoint
const endpoint = `${connection.serverUrl}/${project}/_apis/pipelines?api-version=${pipelinesApiVersion}`;
```

---

## 7. Testing Strategy

### 7.1 Test File Structure

```typescript
// test/src/tools/{category}.test.ts
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configure{Category}Tools } from "../../../src/tools/{category}";

// Mock fetch globally if needed
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("configure{Category}Tools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<AccessToken>;
  let connectionProvider: () => Promise<WebApi>;
  let mockConnection: any;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockConnection = {
      serverUrl: "https://dev.azure.com/test-org"
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers {category} tools on the server", () => {
      configure{Category}Tools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("{tool_name} tool", () => {
    it("should perform {action} successfully", async () => {
      // Test implementation
    });

    it("should handle errors correctly", async () => {
      // Error test
    });
  });
});
```

### 7.2 Test Coverage Requirements

Each tool must have tests for:

1. **Successful operation**: Happy path with valid inputs
2. **Error handling**: API errors, network errors, validation errors
3. **Edge cases**: Empty responses, pagination, optional parameters
4. **Authentication**: Token provider errors
5. **API compatibility**: Server 2020 vs Cloud differences

### 7.3 Mock Patterns

```typescript
// Mock successful API response
const mockResponse = {
  ok: true,
  json: jest.fn().mockResolvedValue({ id: 123, name: "Test" }),
  text: jest.fn().mockResolvedValue(JSON.stringify({ id: 123 }))
};
(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

// Mock API error
const errorResponse = {
  ok: false,
  status: 404,
  text: jest.fn().mockResolvedValue("Not found")
};
(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(errorResponse as any);

// Mock Azure DevOps API
const mockPipelinesApi = {
  getPipeline: jest.fn().mockResolvedValue({ id: 123, name: "Test Pipeline" }),
  createPipeline: jest.fn().mockResolvedValue({ id: 456 })
};
mockConnection.getPipelinesApi = jest.fn().mockResolvedValue(mockPipelinesApi);
```

### 7.4 Test Coverage Goals

- **Line Coverage**: >90%
- **Branch Coverage**: >85%
- **Function Coverage**: 100%
- **Statement Coverage**: >90%

---

## 8. Integration Checklist

### 8.1 Implementation Steps

- [ ] 1. Create `src/tools/pipelines.ts` with 7 tools
- [ ] 2. Create `src/tools/environments.ts` with 7 tools
- [ ] 3. Create `src/tools/variablegroups.ts` with 5 tools
- [ ] 4. Update `src/tools.ts` to register new tools
- [ ] 5. Create `test/src/tools/pipelines.test.ts`
- [ ] 6. Create `test/src/tools/environments.test.ts`
- [ ] 7. Create `test/src/tools/variablegroups.test.ts`
- [ ] 8. Run tests and achieve >90% coverage
- [ ] 9. Update README.md with new tool documentation
- [ ] 10. Validate tool names with eslint rules
- [ ] 11. Test on Azure DevOps Server 2020
- [ ] 12. Test on Azure DevOps Services (cloud)

### 8.2 Registration in src/tools.ts

```typescript
// Add imports
import { configurePipelinesTools } from "./tools/pipelines.js";
import { configureEnvironmentsTools } from "./tools/environments.js";
import { configureVariableGroupsTools } from "./tools/variablegroups.js";

// Add to configureAllTools function
function configureAllTools(...) {
  // ... existing tool configurations ...
  configurePipelinesTools(server, tokenProvider, connectionProvider);
  configureEnvironmentsTools(server, tokenProvider, connectionProvider);
  configureVariableGroupsTools(server, tokenProvider, connectionProvider);
  // ... remaining tools ...
}
```

### 8.3 Validation Requirements

Each tool must pass:

1. **ESLint validation**: `npm run lint`
2. **Tool name validation**: Names must match `{category}_{action}` pattern
3. **Schema validation**: Zod schemas compile without errors
4. **Unit tests**: All tests pass with >90% coverage
5. **Integration tests**: Works on Server 2020 and Cloud

### 8.4 Documentation Updates

Update the following files:

1. **README.md**: Add new tools to tools list
2. **EXAMPLES.md**: Add usage examples for new tools
3. **API.md** (if exists): Document API endpoints used

---

## 9. API Compatibility Matrix

### 9.1 Pipelines API

| Tool | API Version | Server 2020 | Cloud | Notes |
|------|-------------|-------------|-------|-------|
| create_or_update | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| run | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| run_status | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| cancel_run | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| get_logs | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| list_artifacts | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| get_artifact | 6.0-preview.1 | ✅ | ✅ | Fully supported |

### 9.2 Environments API

| Tool | API Version | Server 2020 | Cloud | Notes |
|------|-------------|-------------|-------|-------|
| list | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| get | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| create_or_update | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| delete | 6.0-preview.1 | ✅ | ✅ | Fully supported |
| add_resource | 6.0-preview.1 | ✅ | ✅ | K8s requires additional setup |
| remove_resource | 6.0-preview.1 | ✅ | ✅ | K8s requires additional setup |
| list_deployments | 6.0-preview.1 | ✅ | ✅ | Fully supported |

### 9.3 Variable Groups API

| Tool | API Version | Server 2020 | Cloud | Notes |
|------|-------------|-------------|-------|-------|
| list | 6.0-preview.2 | ✅ | ✅ | Fully supported |
| get | 6.0-preview.2 | ✅ | ✅ | Secrets redacted |
| create_or_update | 6.0-preview.2 | ✅ | ✅ | Fully supported |
| delete | 6.0-preview.2 | ✅ | ✅ | Fully supported |
| update_variables | 6.0-preview.2 | ✅ | ✅ | Fully supported |

### 9.4 Known Limitations

**Server 2020 Update 1:**
- Some advanced YAML pipeline features may not be available
- Repository types limited to azureReposGit and github (no githubEnterprise)
- Kubernetes resources require Kubernetes extension installed

**Azure DevOps Services (Cloud):**
- All features fully supported
- Additional repository types available
- Advanced environment checks available

---

## 10. Implementation Order

Recommended implementation sequence:

1. **Phase 1: Variable Groups** (Simplest)
   - Implement 5 tools in `variablegroups.ts`
   - Write tests
   - Validate on Server 2020

2. **Phase 2: Environments** (Moderate complexity)
   - Implement 7 tools in `environments.ts`
   - Write tests
   - Validate resource management

3. **Phase 3: Pipelines** (Most complex)
   - Implement 7 tools in `pipelines.ts`
   - Write tests
   - Validate YAML pipeline operations

4. **Phase 4: Integration**
   - Register all tools in `src/tools.ts`
   - Run full test suite
   - Update documentation

---

## 11. Success Criteria

The implementation will be considered complete when:

1. ✅ All 19 tools implemented across 3 files
2. ✅ All tools properly registered in `src/tools.ts`
3. ✅ Test coverage >90% for all new code
4. ✅ All tests passing
5. ✅ Tool names validated by ESLint
6. ✅ Works on Azure DevOps Server 2020 Update 1
7. ✅ Works on Azure DevOps Services (cloud)
8. ✅ Documentation updated
9. ✅ No breaking changes to existing tools
10. ✅ Proper error handling for all edge cases

---

## Appendix A: Quick Reference

### Tool Name Pattern
```
{category}_{action}
```

### File Locations
```
src/tools/{category}.ts
test/src/tools/{category}.test.ts
```

### Copyright Header
```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.
```

### Response Format
```typescript
return {
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
};
```

### API Version Constants
```typescript
const pipelinesApiVersion = "6.0-preview.1";
const environmentsApiVersion = "6.0-preview.1";
const variableGroupsApiVersion = "6.0-preview.2";
```

---

**End of Document**

This architecture document provides complete specifications for implementing all 19 new Azure DevOps tools. Code mode can implement directly from these specifications without additional design decisions.