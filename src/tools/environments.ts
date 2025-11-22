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