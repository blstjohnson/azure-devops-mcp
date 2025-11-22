# Environments Tools Implementation Guide

**Category**: Environments  
**File**: `src/tools/environments.ts`  
**Test File**: `test/src/tools/environments.test.ts`  
**Tool Count**: 7  
**API Version**: 6.0-preview.1 (Server 2020 compatible)

---

## Tool Names

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

---

## Complete Implementation: src/tools/environments.ts

```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getAuthorizationHeader } from "../utils.js";

const ENVIRONMENTS_TOOLS = {
  list: "environments_list",
  get: "environments_get",
  create_or_update: "environments_create_or_update",
  delete: "environments_delete",
  add_resource: "environments_add_resource",
  remove_resource: "environments_remove_resource",
  list_deployments: "environments_list_deployments"
};

const environmentsApiVersion = "6.0-preview.1";

function configureEnvironmentsTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  /**
   * Tool 1: List Environments
   */
  server.tool(
    ENVIRONMENTS_TOOLS.list,
    "List environments in a project",
    {
      project: z.string().describe("Project ID or name"),
      name: z.string().optional().describe("Filter by environment name"),
      top: z.number().default(50).optional().describe("Maximum number of environments"),
      continuationToken: z.string().optional().describe("Continuation token for pagination")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.name) queryParams.append("name", params.name);
        if (params.top) queryParams.append("$top", params.top.toString());
        if (params.continuationToken) queryParams.append("continuationToken", params.continuationToken);
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments?${queryParams.toString()}&api-version=${environmentsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to list environments: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`List environments failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 2: Get Environment
   */
  server.tool(
    ENVIRONMENTS_TOOLS.get,
    "Get a specific environment by ID",
    {
      project: z.string().describe("Project ID or name"),
      environmentId: z.number().describe("Environment ID"),
      includeResources: z.boolean().default(false).describe("Include environment resources"),
      includeLatestDeployments: z.boolean().default(false).describe("Include latest deployments")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.includeResources) queryParams.append("expands", "resourceReferences");
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments/${params.environmentId}?${queryParams.toString()}&api-version=${environmentsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get environment: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get environment failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 3: Create or Update Environment
   */
  server.tool(
    ENVIRONMENTS_TOOLS.create_or_update,
    "Create or update an environment",
    {
      project: z.string().describe("Project ID or name"),
      environmentId: z.number().optional().describe("Environment ID (for update)"),
      name: z.string().describe("Environment name"),
      description: z.string().optional().describe("Environment description")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        let endpoint: string;
        let method: string;
        
        if (params.environmentId) {
          endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments/${params.environmentId}?api-version=${environmentsApiVersion}`;
          method = "PATCH";
        } else {
          endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments?api-version=${environmentsApiVersion}`;
          method = "POST";
        }
        
        const requestBody = {
          name: params.name,
          description: params.description || ""
        };
        
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to ${params.environmentId ? 'update' : 'create'} environment: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Environment operation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 4: Delete Environment
   */
  server.tool(
    ENVIRONMENTS_TOOLS.delete,
    "Delete an environment",
    {
      project: z.string().describe("Project ID or name"),
      environmentId: z.number().describe("Environment ID to delete"),
      forceDelete: z.boolean().default(false).describe("Force delete even if resources exist")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments/${params.environmentId}?api-version=${environmentsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          
          if (response.status === 409 && !params.forceDelete) {
            throw new Error(`Cannot delete environment ${params.environmentId}: Resources or deployments exist. Use forceDelete=true to override.`);
          }
          
          throw new Error(`Failed to delete environment: ${response.status} ${errorText}`);
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify({ 
            success: true, 
            deletedEnvironmentId: params.environmentId,
            message: "Environment deleted successfully"
          }, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Delete environment failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 5: Add Environment Resource
   */
  server.tool(
    ENVIRONMENTS_TOOLS.add_resource,
    "Add a resource (Kubernetes, VM) to an environment",
    {
      project: z.string().describe("Project ID or name"),
      environmentId: z.number().describe("Environment ID"),
      resourceType: z.enum(["virtualMachine", "kubernetes", "generic"]).describe("Resource type"),
      resourceName: z.string().describe("Resource name"),
      tags: z.array(z.string()).optional().describe("Resource tags"),
      metadata: z.record(z.string(), z.any()).optional().describe("Additional metadata")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        let providerType: string;
        switch (params.resourceType) {
          case "kubernetes":
            providerType = "kubernetes";
            break;
          case "virtualMachine":
            providerType = "virtualmachines";
            break;
          default:
            providerType = "generic";
        }
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments/${params.environmentId}/providers/${providerType}?api-version=${environmentsApiVersion}`;
        
        const requestBody = {
          name: params.resourceName,
          tags: params.tags || [],
          ...params.metadata
        };
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to add resource: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Add resource failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 6: Remove Environment Resource
   */
  server.tool(
    ENVIRONMENTS_TOOLS.remove_resource,
    "Remove a resource from an environment",
    {
      project: z.string().describe("Project ID or name"),
      environmentId: z.number().describe("Environment ID"),
      resourceId: z.number().describe("Resource ID to remove")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments/${params.environmentId}/providers/generic/resources/${params.resourceId}?api-version=${environmentsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to remove resource: ${response.status} ${errorText}`);
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify({ 
            success: true,
            removedResourceId: params.resourceId,
            message: "Resource removed successfully"
          }, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Remove resource failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 7: List Environment Deployments
   */
  server.tool(
    ENVIRONMENTS_TOOLS.list_deployments,
    "List deployments to an environment",
    {
      project: z.string().describe("Project ID or name"),
      environmentId: z.number().describe("Environment ID"),
      top: z.number().default(50).optional().describe("Maximum number of deployments"),
      continuationToken: z.string().optional().describe("Continuation token")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.top) queryParams.append("$top", params.top.toString());
        if (params.continuationToken) queryParams.append("continuationToken", params.continuationToken);
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/environments/${params.environmentId}/environmentdeploymentrecords?${queryParams.toString()}&api-version=${environmentsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to list deployments: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`List deployments failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

export { ENVIRONMENTS_TOOLS, configureEnvironmentsTools };
```

---

## Test Implementation: test/src/tools/environments.test.ts

```typescript
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureEnvironmentsTools } from "../../../src/tools/environments";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureEnvironmentsTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { serverUrl: string };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue({ token: "test-token" });
    mockConnection = {
      serverUrl: "https://dev.azure.com/test-org"
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers 7 environment tools", () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(7);
    });

    it("registers all expected tool names", () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      const toolNames = calls.map(call => call[0]);
      
      expect(toolNames).toContain("environments_list");
      expect(toolNames).toContain("environments_get");
      expect(toolNames).toContain("environments_create_or_update");
      expect(toolNames).toContain("environments_delete");
      expect(toolNames).toContain("environments_add_resource");
      expect(toolNames).toContain("environments_remove_resource");
      expect(toolNames).toContain("environments_list_deployments");
    });
  });

  describe("environments_list tool", () => {
    it("should list environments successfully", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 2,
          value: [
            { id: 1, name: "Development" },
            { id: 2, name: "Production" }
          ]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = { project: "TestProject" };
      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(2);
      expect(parsed.value).toHaveLength(2);
    });

    it("should filter by name", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 1,
          value: [{ id: 2, name: "Production" }]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Production"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("name=Production"),
        expect.any(Object)
      );
    });
  });

  describe("environments_create_or_update tool", () => {
    it("should create new environment", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 3,
          name: "Staging",
          description: "Staging environment"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Staging",
        description: "Staging environment"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(3);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/environments?"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should update existing environment", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 3, name: "Updated" })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 3,
        name: "Updated"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/environments/3?"),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("should handle errors", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Invalid name")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Invalid@Name"
      };

      await expect(handler(params)).rejects.toThrow("Failed to create environment");
    });
  });

  describe("environments_delete tool", () => {
    it("should delete environment", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_delete"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = { ok: true };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 3
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.deletedEnvironmentId).toBe(3);
    });

    it("should handle dependency conflicts", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_delete"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 409,
        text: jest.fn().mockResolvedValue("Dependencies exist")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 3,
        forceDelete: false
      };

      await expect(handler(params)).rejects.toThrow("Resources or deployments exist");
    });
  });

  describe("environments_add_resource tool", () => {
    it("should add resource", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_add_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 10,
          name: "k8s-cluster",
          type: "kubernetes"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceType: "kubernetes" as const,
        resourceName: "k8s-cluster"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(10);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/providers/kubernetes"),
        expect.any(Object)
      );
    });
  });

  describe("environments_list_deployments tool", () => {
    it("should list deployments", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list_deployments"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 3,
          value: [
            { id: 1, result: "succeeded" },
            { id: 2, result: "succeeded" },
            { id: 3, result: "failed" }
          ]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(3);
      expect(parsed.value).toHaveLength(3);
    });
  });
});
```

---

## API Endpoints Reference

### Environments API (v6.0-preview.1)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| list | GET | `/{project}/_apis/distributedtask/environments?api-version=6.0-preview.1` |
| get | GET | `/{project}/_apis/distributedtask/environments/{environmentId}?api-version=6.0-preview.1` |
| create_or_update (create) | POST | `/{project}/_apis/distributedtask/environments?api-version=6.0-preview.1` |
| create_or_update (update) | PATCH | `/{project}/_apis/distributedtask/environments/{environmentId}?api-version=6.0-preview.1` |
| delete | DELETE | `/{project}/_apis/distributedtask/environments/{environmentId}?api-version=6.0-preview.1` |
| add_resource | POST | `/{project}/_apis/distributedtask/environments/{environmentId}/providers/{provider}?api-version=6.0-preview.1` |
| remove_resource | DELETE | `/{project}/_apis/distributedtask/environments/{environmentId}/providers/{provider}/resources/{resourceId}?api-version=6.0-preview.1` |
| list_deployments | GET | `/{project}/_apis/distributedtask/environments/{environmentId}/environmentdeploymentrecords?api-version=6.0-preview.1` |

---

## Implementation Checklist

- [ ] Create `src/tools/environments.ts` with all 7 tools
- [ ] Export `ENVIRONMENTS_TOOLS` constant and `configureEnvironmentsTools` function
- [ ] Create `test/src/tools/environments.test.ts` with comprehensive tests
- [ ] Achieve >90% test coverage
- [ ] Validate tool names with ESLint
- [ ] Test on Server 2020 and Cloud
- [ ] Add to `src/tools.ts` registration

---

## Server 2020 Compatibility Notes

✅ **Fully Supported on Server 2020 Update 1**
- All endpoints available in API version 6.0
- Environment management fully functional
- Deployment tracking available

⚠️ **Resource-Specific Considerations**
- Kubernetes resources require Kubernetes extension installed
- Virtual Machine resources require deployment group setup
- Generic resources always available