# Service Connections (Endpoints) Tools Implementation Guide

**Category**: Service Connections  
**File**: `src/tools/serviceconnections.ts`  
**Test File**: `test/src/tools/serviceconnections.test.ts`  
**Tool Count**: 7  
**API Version**: 6.0-preview.4 (Server 2020 compatible)

---

## Overview

Service Connections (also known as Service Endpoints) provide secure connections to external services like Azure Resource Manager, GitHub, Docker registries, and more. These tools enable complete lifecycle management of service connections in Azure DevOps.

## Tool Names

```typescript
const SERVICECONNECTIONS_TOOLS = {
  list: "serviceconnections_list",
  get: "serviceconnections_get",
  create: "serviceconnections_create",
  update: "serviceconnections_update",
  delete: "serviceconnections_delete",
  share_with_project: "serviceconnections_share_with_project",
  get_connection_data: "serviceconnections_get_connection_data"
};
```

---

## Complete Implementation: src/tools/serviceconnections.ts

```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getAuthorizationHeader } from "../utils.js";

const SERVICECONNECTIONS_TOOLS = {
  list: "serviceconnections_list",
  get: "serviceconnections_get",
  create: "serviceconnections_create",
  update: "serviceconnections_update",
  delete: "serviceconnections_delete",
  share_with_project: "serviceconnections_share_with_project",
  get_connection_data: "serviceconnections_get_connection_data"
};

const serviceConnectionsApiVersion = "6.0-preview.4";

// Common connection types in Azure DevOps
const ConnectionTypes = {
  AZURE_RM: "azurerm",
  GITHUB: "github",
  GITHUB_ENTERPRISE: "githubenterprise",
  BITBUCKET: "bitbucket",
  DOCKER_REGISTRY: "dockerregistry",
  KUBERNETES: "kubernetes",
  GENERIC: "generic",
  NUGET: "externalnugetfeed",
  NPM: "externalnpmregistry"
} as const;

function configureServiceConnectionsTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  /**
   * Tool 1: List Service Connections
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.list,
    "List service connections (endpoints) in a project",
    {
      project: z.string().describe("Project ID or name"),
      type: z.string().optional().describe("Filter by connection type (e.g., 'azurerm', 'github', 'dockerregistry')"),
      authSchemes: z.array(z.string()).optional().describe("Filter by authentication schemes"),
      endpointNames: z.array(z.string()).optional().describe("Filter by specific endpoint names"),
      includeFailed: z.boolean().default(false).describe("Include connections with failed authentication"),
      includeDetails: z.boolean().default(true).describe("Include full connection details")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.type) queryParams.append("type", params.type);
        if (params.authSchemes) queryParams.append("authSchemes", params.authSchemes.join(","));
        if (params.endpointNames) queryParams.append("endpointNames", params.endpointNames.join(","));
        if (params.includeFailed) queryParams.append("includeFailed", "true");
        
        const endpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints?${queryParams.toString()}&api-version=${serviceConnectionsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to list service connections: ${response.status} ${errorText}`);
        }
        
        let result = await response.json();
        
        // Redact sensitive authorization data
        if (result.value && params.includeDetails) {
          result.value = result.value.map((conn: any) => redactSensitiveData(conn));
        } else if (result.value && !params.includeDetails) {
          // Return only basic info
          result.value = result.value.map((conn: any) => ({
            id: conn.id,
            name: conn.name,
            type: conn.type,
            description: conn.description,
            isReady: conn.isReady,
            isShared: conn.isShared
          }));
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`List service connections failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 2: Get Service Connection
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.get,
    "Get a specific service connection with redacted credentials",
    {
      project: z.string().describe("Project ID or name"),
      endpointId: z.string().describe("Service connection (endpoint) ID")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints/${params.endpointId}?api-version=${serviceConnectionsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get service connection: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        
        // Redact sensitive data for security
        const redactedResult = redactSensitiveData(result);
        
        return {
          content: [{ type: "text", text: JSON.stringify(redactedResult, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get service connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 3: Create Service Connection
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.create,
    "Create a new service connection",
    {
      project: z.string().describe("Project ID or name"),
      name: z.string().describe("Service connection name"),
      type: z.string().describe("Connection type (e.g., 'azurerm', 'github', 'dockerregistry', 'kubernetes')"),
      url: z.string().describe("Service URL"),
      authorization: z.object({
        scheme: z.string().describe("Authorization scheme (e.g., 'ServicePrincipal', 'UsernamePassword', 'Token', 'Certificate')"),
        parameters: z.record(z.string(), z.string()).describe("Authorization parameters (credentials will be redacted in response)")
      }).describe("Authorization configuration"),
      data: z.record(z.string(), z.string()).optional().describe("Additional connection-specific data"),
      description: z.string().optional().describe("Connection description"),
      isShared: z.boolean().default(false).describe("Share with all pipelines in project"),
      isReady: z.boolean().default(true).describe("Connection is ready to use")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints?api-version=${serviceConnectionsApiVersion}`;
        
        const requestBody = {
          name: params.name,
          type: params.type,
          url: params.url,
          authorization: params.authorization,
          data: params.data || {},
          description: params.description || "",
          isShared: params.isShared,
          isReady: params.isReady,
          owner: "Library"
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
          throw new Error(`Failed to create service connection: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        
        // Redact credentials in response
        const redactedResult = redactSensitiveData(result);
        
        return {
          content: [{ type: "text", text: JSON.stringify(redactedResult, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Create service connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 4: Update Service Connection
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.update,
    "Update an existing service connection",
    {
      project: z.string().describe("Project ID or name"),
      endpointId: z.string().describe("Service connection ID to update"),
      name: z.string().optional().describe("Updated name"),
      url: z.string().optional().describe("Updated service URL"),
      authorization: z.object({
        scheme: z.string().describe("Authorization scheme"),
        parameters: z.record(z.string(), z.string()).describe("Updated authorization parameters")
      }).optional().describe("Updated authorization (credentials will be redacted in response)"),
      data: z.record(z.string(), z.string()).optional().describe("Updated connection data"),
      description: z.string().optional().describe("Updated description"),
      isShared: z.boolean().optional().describe("Update sharing setting"),
      isReady: z.boolean().optional().describe("Update ready status")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        // First, get the current connection
        const getEndpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints/${params.endpointId}?api-version=${serviceConnectionsApiVersion}`;
        const getResponse = await fetch(getEndpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!getResponse.ok) {
          const errorText = await getResponse.text();
          throw new Error(`Failed to get current service connection: ${getResponse.status} ${errorText}`);
        }
        
        const currentConnection = await getResponse.json();
        
        // Merge updates
        const updatedConnection = {
          ...currentConnection,
          name: params.name || currentConnection.name,
          url: params.url || currentConnection.url,
          description: params.description !== undefined ? params.description : currentConnection.description,
          isShared: params.isShared !== undefined ? params.isShared : currentConnection.isShared,
          isReady: params.isReady !== undefined ? params.isReady : currentConnection.isReady,
          authorization: params.authorization || currentConnection.authorization,
          data: params.data || currentConnection.data
        };
        
        const updateEndpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints/${params.endpointId}?api-version=${serviceConnectionsApiVersion}`;
        const updateResponse = await fetch(updateEndpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(updatedConnection)
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update service connection: ${updateResponse.status} ${errorText}`);
        }
        
        const result = await updateResponse.json();
        
        // Redact credentials in response
        const redactedResult = redactSensitiveData(result);
        
        return {
          content: [{ type: "text", text: JSON.stringify(redactedResult, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Update service connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 5: Delete Service Connection
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.delete,
    "Delete a service connection",
    {
      project: z.string().describe("Project ID or name"),
      endpointId: z.string().describe("Service connection ID to delete"),
      deep: z.boolean().default(false).describe("Perform deep delete (remove all references)")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.deep) queryParams.append("deep", "true");
        
        const endpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints/${params.endpointId}?${queryParams.toString()}&api-version=${serviceConnectionsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          
          if (response.status === 409) {
            throw new Error(`Cannot delete service connection ${params.endpointId}: Still in use. Try deep=true to force deletion.`);
          }
          
          throw new Error(`Failed to delete service connection: ${response.status} ${errorText}`);
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            deletedEndpointId: params.endpointId,
            message: "Service connection deleted successfully"
          }, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Delete service connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 6: Share Service Connection with Project
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.share_with_project,
    "Share a service connection with another project",
    {
      project: z.string().describe("Source project ID or name"),
      endpointId: z.string().describe("Service connection ID to share"),
      targetProjectId: z.string().describe("Target project ID to share with"),
      targetProjectName: z.string().optional().describe("Target project name (for validation)")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/_apis/serviceendpoint/endpoints/${params.endpointId}?api-version=${serviceConnectionsApiVersion}`;
        
        const requestBody = {
          projectReference: {
            id: params.targetProjectId,
            name: params.targetProjectName || ""
          }
        };
        
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to share service connection: ${response.status} ${errorText}`);
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            endpointId: params.endpointId,
            sharedWithProject: params.targetProjectId,
            message: "Service connection shared successfully"
          }, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Share service connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 7: Get Connection Execution Data
   */
  server.tool(
    SERVICECONNECTIONS_TOOLS.get_connection_data,
    "Get service connection execution history and usage data",
    {
      project: z.string().describe("Project ID or name"),
      endpointId: z.string().describe("Service connection ID"),
      dataSourceName: z.string().optional().describe("Specific data source name to query")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const queryParams = new URLSearchParams();
        if (params.dataSourceName) queryParams.append("dataSourceName", params.dataSourceName);
        
        const endpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints/${params.endpointId}/executionhistory?${queryParams.toString()}&api-version=${serviceConnectionsApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get connection data: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get connection data failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

/**
 * Helper function to redact sensitive authorization data
 */
function redactSensitiveData(connection: any): any {
  const redacted = { ...connection };
  
  if (redacted.authorization && redacted.authorization.parameters) {
    const sensitiveKeys = [
      'password', 'token', 'apitoken', 'secret', 'clientsecret',
      'serviceprincipalkey', 'certificate', 'certificatepassword',
      'apikey', 'accesstoken', 'secrettoken', 'tenantid'
    ];
    
    const redactedParameters: any = {};
    for (const [key, value] of Object.entries(redacted.authorization.parameters)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        redactedParameters[key] = "[REDACTED]";
      } else {
        redactedParameters[key] = value;
      }
    }
    redacted.authorization.parameters = redactedParameters;
  }
  
  return redacted;
}

export { SERVICECONNECTIONS_TOOLS, configureServiceConnectionsTools };
```

---

## Test Implementation: test/src/tools/serviceconnections.test.ts

```typescript
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureServiceConnectionsTools } from "../../../src/tools/serviceconnections";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureServiceConnectionsTools", () => {
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
    it("registers 7 service connection tools", () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(7);
    });

    it("registers all expected tool names", () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      const toolNames = calls.map(call => call[0]);
      
      expect(toolNames).toContain("serviceconnections_list");
      expect(toolNames).toContain("serviceconnections_get");
      expect(toolNames).toContain("serviceconnections_create");
      expect(toolNames).toContain("serviceconnections_update");
      expect(toolNames).toContain("serviceconnections_delete");
      expect(toolNames).toContain("serviceconnections_share_with_project");
      expect(toolNames).toContain("serviceconnections_get_connection_data");
    });
  });

  describe("serviceconnections_list tool", () => {
    it("should list service connections", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 2,
          value: [
            {
              id: "conn-1",
              name: "Azure-Production",
              type: "azurerm",
              isReady: true,
              authorization: {
                scheme: "ServicePrincipal",
                parameters: { serviceprincipalkey: "secret-key" }
              }
            },
            {
              id: "conn-2",
              name: "GitHub-Repo",
              type: "github",
              isReady: true,
              authorization: {
                scheme: "Token",
                parameters: { accesstoken: "github-token" }
              }
            }
          ]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = { project: "TestProject" };
      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(2);
      expect(parsed.value).toHaveLength(2);
      // Verify credentials are redacted
      expect(parsed.value[0].authorization.parameters.serviceprincipalkey).toBe("[REDACTED]");
      expect(parsed.value[1].authorization.parameters.accesstoken).toBe("[REDACTED]");
    });

    it("should filter by connection type", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 1, value: [] })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        type: "github"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("type=github"),
        expect.any(Object)
      );
    });

    it("should return basic info when includeDetails is false", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 1,
          value: [{
            id: "conn-1",
            name: "Azure-Prod",
            type: "azurerm",
            description: "Production Azure",
            isReady: true,
            isShared: false,
            authorization: { scheme: "ServicePrincipal", parameters: {} },
            url: "https://management.azure.com/"
          }]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        includeDetails: false
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.value[0].id).toBe("conn-1");
      expect(parsed.value[0].name).toBe("Azure-Prod");
      expect(parsed.value[0].authorization).toBeUndefined();
      expect(parsed.value[0].url).toBeUndefined();
    });
  });

  describe("serviceconnections_get tool", () => {
    it("should get service connection and redact secrets", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_get"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "conn-1",
          name: "Azure-Production",
          type: "azurerm",
          url: "https://management.azure.com/",
          authorization: {
            scheme: "ServicePrincipal",
            parameters: {
              serviceprincipalid: "sp-id",
              serviceprincipalkey: "secret-key",
              tenantid: "tenant-id"
            }
          }
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        endpointId: "conn-1"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe("conn-1");
      expect(parsed.authorization.parameters.serviceprincipalid).toBe("sp-id");
      expect(parsed.authorization.parameters.serviceprincipalkey).toBe("[REDACTED]");
      expect(parsed.authorization.parameters.tenantid).toBe("[REDACTED]");
    });

    it("should handle not found", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_get"
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
        endpointId: "non-existent"
      };

      await expect(handler(params)).rejects.toThrow("Failed to get service connection");
    });
  });

  describe("serviceconnections_create tool", () => {
    it("should create service connection", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_create"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "new-conn",
          name: "New-GitHub",
          type: "github",
          url: "https://github.com",
          authorization: {
            scheme: "Token",
            parameters: { accesstoken: "github-token" }
          }
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "New-GitHub",
        type: "github",
        url: "https://github.com",
        authorization: {
          scheme: "Token",
          parameters: { accesstoken: "github-token" }
        }
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe("new-conn");
      expect(parsed.authorization.parameters.accesstoken).toBe("[REDACTED]");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/serviceendpoint/endpoints?"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should create Azure RM service connection", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_create"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "azure-conn",
          name: "Azure-Sub",
          type: "azurerm"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Azure-Sub",
        type: "azurerm",
        url: "https://management.azure.com/",
        authorization: {
          scheme: "ServicePrincipal",
          parameters: {
            serviceprincipalid: "sp-id",
            serviceprincipalkey: "sp-key",
            tenantid: "tenant-id"
          }
        },
        data: {
          subscriptionId: "sub-id",
          subscriptionName: "My Subscription"
        }
      };

      await handler(params);

      const callArgs = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const bodyString = callArgs[1]?.body as string;
      const body = JSON.parse(bodyString);

      expect(body.type).toBe("azurerm");
      expect(body.data.subscriptionId).toBe("sub-id");
    });
  });

  describe("serviceconnections_update tool", () => {
    it("should update service connection", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const existingConn = {
        id: "conn-1",
        name: "Old-Name",
        type: "github",
        url: "https://github.com",
        authorization: { scheme: "Token", parameters: { accesstoken: "old-token" } }
      };

      const updatedConn = {
        ...existingConn,
        name: "New-Name",
        authorization: { scheme: "Token", parameters: { accesstoken: "new-token" } }
      };

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(existingConn)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(updatedConn)
        } as any);

      const params = {
        project: "TestProject",
        endpointId: "conn-1",
        name: "New-Name",
        authorization: {
          scheme: "Token",
          parameters: { accesstoken: "new-token" }
        }
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.name).toBe("New-Name");
      expect(parsed.authorization.parameters.accesstoken).toBe("[REDACTED]");
      expect(global.fetch).toHaveBeenCalledTimes(2); // GET then PUT
    });
  });

  describe("serviceconnections_delete tool", () => {
    it("should delete service connection", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_delete"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = { ok: true };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        endpointId: "conn-1"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.deletedEndpointId).toBe("conn-1");
    });

    it("should handle in-use conflict", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_delete"
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
        endpointId: "conn-1",
        deep: false
      };

      await expect(handler(params)).rejects.toThrow("Still in use");
    });
  });

  describe("serviceconnections_share_with_project tool", () => {
    it("should share connection with project", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_share_with_project"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = { ok: true };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "SourceProject",
        endpointId: "conn-1",
        targetProjectId: "target-proj-id",
        targetProjectName: "TargetProject"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.sharedWithProject).toBe("target-proj-id");
    });
  });

  describe("serviceconnections_get_connection_data tool", () => {
    it("should get connection execution history", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_get_connection_data"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 5,
          value: [
            { executionTime: "2024-01-01", result: "succeeded" },
            { executionTime: "2024-01-02", result: "succeeded" }
          ]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        endpointId: "conn-1"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(5);
      expect(parsed.value).toHaveLength(2);
    });
  });
});
```

---

## API Endpoints Reference

### Service Endpoints API (v6.0-preview.4)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| list | GET | `/{project}/_apis/serviceendpoint/endpoints?api-version=6.0-preview.4` |
| get | GET | `/{project}/_apis/serviceendpoint/endpoints/{endpointId}?api-version=6.0-preview.4` |
| create | POST | `/{project}/_apis/serviceendpoint/endpoints?api-version=6.0-preview.4` |
| update | GET + PUT | GET then PUT to `/{project}/_apis/serviceendpoint/endpoints/{endpointId}?api-version=6.0-preview.4` |
| delete | DELETE | `/{project}/_apis/serviceendpoint/endpoints/{endpointId}?api-version=6.0-preview.4` |
| share_with_project | PATCH | `/_apis/serviceendpoint/endpoints/{endpointId}?api-version=6.0-preview.4` |
| get_connection_data | GET | `/{project}/_apis/serviceendpoint/endpoints/{endpointId}/executionhistory?api-version=6.0-preview.4` |

---

## Common Connection Types

### Azure Resource Manager (azurerm)
```typescript
{
  type: "azurerm",
  url: "https://management.azure.com/",
  authorization: {
    scheme: "ServicePrincipal",
    parameters: {
      serviceprincipalid: "<app-id>",
      serviceprincipalkey: "<secret>",
      tenantid: "<tenant-id>"
    }
  },
  data: {
    subscriptionId: "<subscription-id>",
    subscriptionName: "<name>"
  }
}
```

### GitHub
```typescript
{
  type: "github",
  url: "https://github.com",
  authorization: {
    scheme: "Token",
    parameters: {
      accesstoken: "<github-token>"
    }
  }
}
```

### Docker Registry
```typescript
{
  type: "dockerregistry",
  url: "https://registry.hub.docker.com",
  authorization: {
    scheme: "UsernamePassword",
    parameters: {
      username: "<username>",
      password: "<password>",
      email: "<email>",
      registry: "https://index.docker.io/v1/"
    }
  }
}
```

### Kubernetes
```typescript
{
  type: "kubernetes",
  url: "https://kubernetes-cluster-url",
  authorization: {
    scheme: "Kubernetes",
    parameters: {
      azureSubscriptionId: "<sub-id>",
      azureSubscriptionName: "<name>",
      clusterName: "<cluster>",
      namespace: "default"
    }
  }
}
```

---

## Security Considerations

### Credential Redaction

**CRITICAL**: All tools MUST redact sensitive authorization parameters in responses:

```typescript
function redactSensitiveData(connection: any): any {
  const sensitiveKeys = [
    'password', 'token', 'apitoken', 'secret', 'clientsecret',
    'serviceprincipalkey', 'certificate', 'certificatepassword',
    'apikey', 'accesstoken', 'secrettoken', 'tenantid'
  ];
  
  // Redact matching parameters
  for (const [key, value] of Object.entries(parameters)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      parameters[key] = "[REDACTED]";
    }
  }
}
```

### Authorization Schemes

Common schemes in Azure DevOps:
- **ServicePrincipal**: Azure RM connections
- **Token**: GitHub, generic tokens
- **UsernamePassword**: Basic auth
- **Certificate**: Certificate-based auth
- **Kubernetes**: K8s cluster connections

---

## Implementation Checklist

- [ ] Create `src/tools/serviceconnections.ts` with all 7 tools
- [ ] Export `SERVICECONNECTIONS_TOOLS` constant and `configureServiceConnectionsTools` function
- [ ] Implement credential redaction in all response handlers
- [ ] Create `test/src/tools/serviceconnections.test.ts` with comprehensive tests
- [ ] Test credential redaction for all auth schemes
- [ ] Test all connection types (Azure RM, GitHub, Docker, Kubernetes)
- [ ] Achieve >90% test coverage
- [ ] Validate tool names with ESLint
- [ ] Test on Server 2020 and Cloud
- [ ] Add to `src/tools.ts` registration

---

## Server 2020 Compatibility Notes

✅ **Fully Supported on Server 2020 Update 1**
- All endpoints available in API version 6.0-preview.4
- Service connection management fully functional
- Credential security properly handled

⚠️ **Connection Type Support**
- Azure RM connections require Azure subscription
- GitHub Enterprise connections need proper URL configuration
- Kubernetes connections may require additional cluster setup
- Test each connection type in your environment

⚠️ **Project Sharing**
- Cross-project sharing requires proper permissions
- Validate project access before sharing connections
- Some connection types may have sharing restrictions