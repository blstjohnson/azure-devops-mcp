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
        queryParams.append("api-version", serviceConnectionsApiVersion);
        
        const endpoint = `${baseUrl}/${params.project}/_apis/serviceendpoint/endpoints?${queryParams.toString()}`;
        
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
        // includeDetails defaults to true if not specified
        if (result.value && params.includeDetails !== false) {
          result.value = result.value.map((conn: any) => redactSensitiveData(conn));
        } else if (result.value && params.includeDetails === false) {
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
  if (!connection) return connection;
  
  // Deep clone the connection to avoid modifying the original
  const redacted = JSON.parse(JSON.stringify(connection));
  
  if (redacted.authorization && redacted.authorization.parameters) {
    const sensitiveKeys = [
      'password', 'token', 'apitoken', 'secret', 'clientsecret',
      'serviceprincipalkey', 'certificate', 'certificatepassword',
      'apikey', 'accesstoken', 'secrettoken', 'tenantid'
    ];
    
    for (const [key, value] of Object.entries(redacted.authorization.parameters)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        redacted.authorization.parameters[key] = "[REDACTED]";
      }
    }
  }
  
  return redacted;
}

export { SERVICECONNECTIONS_TOOLS, configureServiceConnectionsTools };