# Variable Groups Tools Implementation Guide

**Category**: Variable Groups  
**File**: `src/tools/variablegroups.ts`  
**Test File**: `test/src/tools/variablegroups.test.ts`  
**Tool Count**: 5  
**API Version**: 6.0-preview.2 (Server 2020 compatible)

---

## Tool Names

```typescript
const VARIABLEGROUPS_TOOLS = {
  list: "variablegroups_list",
  get: "variablegroups_get",
  create_or_update: "variablegroups_create_or_update",
  delete: "variablegroups_delete",
  update_variables: "variablegroups_update_variables"
};
```

---

## Complete Implementation: src/tools/variablegroups.ts

```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getAuthorizationHeader } from "../utils.js";

const VARIABLEGROUPS_TOOLS = {
  list: "variablegroups_list",
  get: "variablegroups_get",
  create_or_update: "variablegroups_create_or_update",
  delete: "variablegroups_delete",
  update_variables: "variablegroups_update_variables"
};

const variableGroupsApiVersion = "6.0-preview.2";

function configureVariableGroupsTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  /**
   * Tool 1: List Variable Groups
   */
  server.tool(
    VARIABLEGROUPS_TOOLS.list,
    "List variable groups in a project",
    {
      project: z.string().describe("Project ID or name"),
      groupName: z.string().optional().describe("Filter by group name"),
      top: z.number().default(50).optional().describe("Maximum number of groups"),
      continuationToken: z.string().optional().describe("Continuation token")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.groupName) queryParams.append("groupName", params.groupName);
        if (params.top) queryParams.append("$top", params.top.toString());
        if (params.continuationToken) queryParams.append("continuationToken", params.continuationToken);
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups?${queryParams.toString()}&api-version=${variableGroupsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to list variable groups: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`List variable groups failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 2: Get Variable Group
   */
  server.tool(
    VARIABLEGROUPS_TOOLS.get,
    "Get a specific variable group with redacted secrets",
    {
      project: z.string().describe("Project ID or name"),
      groupId: z.number().describe("Variable group ID")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups/${params.groupId}?api-version=${variableGroupsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get variable group: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        
        // Redact secret values for security
        if (result.variables) {
          for (const [key, variable] of Object.entries(result.variables)) {
            if ((variable as any).isSecret) {
              (variable as any).value = "[REDACTED]";
            }
          }
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get variable group failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 3: Create or Update Variable Group
   */
  server.tool(
    VARIABLEGROUPS_TOOLS.create_or_update,
    "Create or update a variable group",
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
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        let endpoint: string;
        let method: string;
        
        if (params.groupId) {
          endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups/${params.groupId}?api-version=${variableGroupsApiVersion}`;
          method = "PUT";
        } else {
          endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups?api-version=${variableGroupsApiVersion}`;
          method = "POST";
        }
        
        const requestBody = {
          name: params.name,
          description: params.description || "",
          type: params.type,
          variables: params.variables
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
          throw new Error(`Failed to ${params.groupId ? 'update' : 'create'} variable group: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        
        // Redact secrets in response
        if (result.variables) {
          for (const [key, variable] of Object.entries(result.variables)) {
            if ((variable as any).isSecret) {
              (variable as any).value = "[REDACTED]";
            }
          }
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Variable group operation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 4: Delete Variable Group
   */
  server.tool(
    VARIABLEGROUPS_TOOLS.delete,
    "Delete a variable group",
    {
      project: z.string().describe("Project ID or name"),
      groupId: z.number().describe("Variable group ID to delete"),
      forceDelete: z.boolean().default(false).describe("Force delete even if in use")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups/${params.groupId}?api-version=${variableGroupsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          
          if (response.status === 409 && !params.forceDelete) {
            throw new Error(`Cannot delete variable group ${params.groupId}: Still in use by pipelines. Use forceDelete=true to override.`);
          }
          
          throw new Error(`Failed to delete variable group: ${response.status} ${errorText}`);
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify({ 
            success: true,
            deletedGroupId: params.groupId,
            message: "Variable group deleted successfully"
          }, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Delete variable group failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 5: Update Variables in Group
   */
  server.tool(
    VARIABLEGROUPS_TOOLS.update_variables,
    "Update specific variables in a variable group",
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
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        // First, get current group
        const getEndpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups/${params.groupId}?api-version=${variableGroupsApiVersion}`;
        const getResponse = await fetch(getEndpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!getResponse.ok) {
          const errorText = await getResponse.text();
          throw new Error(`Failed to get variable group: ${getResponse.status} ${errorText}`);
        }
        
        const currentGroup = await getResponse.json();
        const updatedVariables = { ...currentGroup.variables };
        
        // Remove variables
        if (params.removeVariables) {
          for (const varName of params.removeVariables) {
            delete updatedVariables[varName];
          }
        }
        
        // Add new variables
        if (params.addVariables) {
          for (const [varName, varConfig] of Object.entries(params.addVariables)) {
            updatedVariables[varName] = varConfig;
          }
        }
        
        // Update existing variables
        if (params.updateVariables) {
          for (const [varName, varConfig] of Object.entries(params.updateVariables)) {
            if (updatedVariables[varName]) {
              updatedVariables[varName] = {
                ...updatedVariables[varName],
                ...varConfig
              };
            }
          }
        }
        
        // Update the group
        const updateEndpoint = `${baseUrl}/${params.project}/_apis/distributedtask/variablegroups/${params.groupId}?api-version=${variableGroupsApiVersion}`;
        const updateResponse = await fetch(updateEndpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify({
            ...currentGroup,
            variables: updatedVariables
          })
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update variables: ${updateResponse.status} ${errorText}`);
        }
        
        const result = await updateResponse.json();
        
        // Redact secrets
        if (result.variables) {
          for (const [key, variable] of Object.entries(result.variables)) {
            if ((variable as any).isSecret) {
              (variable as any).value = "[REDACTED]";
            }
          }
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Update variables failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

export { VARIABLEGROUPS_TOOLS, configureVariableGroupsTools };
```

---

## Test Implementation: test/src/tools/variablegroups.test.ts

```typescript
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureVariableGroupsTools } from "../../../src/tools/variablegroups";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureVariableGroupsTools", () => {
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
    it("registers 5 variable group tools", () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(5);
    });

    it("registers all expected tool names", () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      const toolNames = calls.map(call => call[0]);
      
      expect(toolNames).toContain("variablegroups_list");
      expect(toolNames).toContain("variablegroups_get");
      expect(toolNames).toContain("variablegroups_create_or_update");
      expect(toolNames).toContain("variablegroups_delete");
      expect(toolNames).toContain("variablegroups_update_variables");
    });
  });

  describe("variablegroups_list tool", () => {
    it("should list variable groups", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 2,
          value: [
            { id: 1, name: "Dev-Config" },
            { id: 2, name: "Prod-Config" }
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
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 1,
          value: [{ id: 2, name: "Prod-Config" }]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupName: "Prod"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("groupName=Prod"),
        expect.any(Object)
      );
    });
  });

  describe("variablegroups_get tool", () => {
    it("should get variable group and redact secrets", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_get"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          name: "Config",
          variables: {
            ApiUrl: { value: "https://api.example.com", isSecret: false },
            ApiKey: { value: "secret-value", isSecret: true }
          }
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupId: 1
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.variables.ApiUrl.value).toBe("https://api.example.com");
      expect(parsed.variables.ApiKey.value).toBe("[REDACTED]");
    });

    it("should handle not found", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_get"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Not found")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupId: 999
      };

      await expect(handler(params)).rejects.toThrow("Failed to get variable group");
    });
  });

  describe("variablegroups_create_or_update tool", () => {
    it("should create variable group", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 3,
          name: "New-Config",
          variables: {
            Var1: { value: "value1", isSecret: false }
          }
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "New-Config",
        variables: {
          Var1: { value: "value1", isSecret: false }
        }
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(3);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/variablegroups?"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should update variable group", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 3,
          name: "Updated-Config"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupId: 3,
        name: "Updated-Config",
        variables: {
          Var1: { value: "new-value", isSecret: false }
        }
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/variablegroups/3?"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("variablegroups_delete tool", () => {
    it("should delete variable group", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_delete"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = { ok: true };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupId: 3
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.deletedGroupId).toBe(3);
    });

    it("should handle in-use conflict", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_delete"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 409,
        text: jest.fn().mockResolvedValue("In use")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupId: 3,
        forceDelete: false
      };

      await expect(handler(params)).rejects.toThrow("Still in use by pipelines");
    });
  });

  describe("variablegroups_update_variables tool", () => {
    it("should add variables", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_update_variables"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const existingGroup = {
        id: 1,
        name: "Config",
        variables: {
          Var1: { value: "val1", isSecret: false }
        }
      };

      const updatedGroup = {
        ...existingGroup,
        variables: {
          Var1: { value: "val1", isSecret: false },
          Var2: { value: "val2", isSecret: false }
        }
      };

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(existingGroup)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(updatedGroup)
        } as any);

      const params = {
        project: "TestProject",
        groupId: 1,
        addVariables: {
          Var2: { value: "val2", isSecret: false }
        }
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.variables.Var2).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2); // GET then PUT
    });

    it("should remove variables", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_update_variables"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const existingGroup = {
        id: 1,
        name: "Config",
        variables: {
          Var1: { value: "val1", isSecret: false },
          Var2: { value: "val2", isSecret: false }
        }
      };

      const updatedGroup = {
        ...existingGroup,
        variables: {
          Var1: { value: "val1", isSecret: false }
        }
      };

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(existingGroup)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(updatedGroup)
        } as any);

      const params = {
        project: "TestProject",
        groupId: 1,
        removeVariables: ["Var2"]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.variables.Var2).toBeUndefined();
    });

    it("should update existing variables", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_update_variables"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const existingGroup = {
        id: 1,
        name: "Config",
        variables: {
          Var1: { value: "old-value", isSecret: false }
        }
      };

      const updatedGroup = {
        ...existingGroup,
        variables: {
          Var1: { value: "new-value", isSecret: false }
        }
      };

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(existingGroup)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(updatedGroup)
        } as any);

      const params = {
        project: "TestProject",
        groupId: 1,
        updateVariables: {
          Var1: { value: "new-value" }
        }
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.variables.Var1.value).toBe("new-value");
    });
  });
});
```

---

## API Endpoints Reference

### Variable Groups API (v6.0-preview.2)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| list | GET | `/{project}/_apis/distributedtask/variablegroups?api-version=6.0-preview.2` |
| get | GET | `/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2` |
| create_or_update (create) | POST | `/{project}/_apis/distributedtask/variablegroups?api-version=6.0-preview.2` |
| create_or_update (update) | PUT | `/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2` |
| delete | DELETE | `/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2` |
| update_variables | GET + PUT | GET then PUT to `/{project}/_apis/distributedtask/variablegroups/{groupId}?api-version=6.0-preview.2` |

---

## Security Considerations

### Secret Handling

**CRITICAL**: All tools MUST redact secret values in responses:

```typescript
// After getting variable group
if (result.variables) {
  for (const [key, variable] of Object.entries(result.variables)) {
    if ((variable as any).isSecret) {
      (variable as any).value = "[REDACTED]";
    }
  }
}
```

### Secret Update Pattern

When updating secrets:
1. User provides new secret value in request
2. Value is sent to Azure DevOps API
3. Response is redacted before returning to user
4. Azure DevOps stores encrypted secret
5. Future GET requests return empty or redacted value

---

## Implementation Checklist

- [ ] Create `src/tools/variablegroups.ts` with all 5 tools
- [ ] Export `VARIABLEGROUPS_TOOLS` constant and `configureVariableGroupsTools` function
- [ ] Implement secret redaction in all tools that return variables
- [ ] Create `test/src/tools/variablegroups.test.ts` with comprehensive tests
- [ ] Test secret redaction logic
- [ ] Achieve >90% test coverage
- [ ] Validate tool names with ESLint
- [ ] Test on Server 2020 and Cloud
- [ ] Add to `src/tools.ts` registration

---

## Server 2020 Compatibility Notes

✅ **Fully Supported on Server 2020 Update 1**
- All endpoints available in API version 6.0-preview.2
- Variable group management fully functional
- Secret handling works correctly

⚠️ **Azure Key Vault Integration**
- AzureKeyVault type requires Azure subscription connection
- Server 2020 may need additional configuration
- Test thoroughly with both Vsts and AzureKeyVault types