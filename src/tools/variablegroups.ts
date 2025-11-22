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