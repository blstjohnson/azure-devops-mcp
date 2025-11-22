// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getAuthorizationHeader } from "../utils.js";

const PIPELINES_TOOLS = {
  create_or_update: "pipelines_create_or_update",
  run: "pipelines_run",
  run_status: "pipelines_run_status",
  cancel_run: "pipelines_cancel_run",
  get_logs: "pipelines_get_logs",
  list_artifacts: "pipelines_list_artifacts",
  get_artifact: "pipelines_get_artifact"
};

const pipelinesApiVersion = "6.0-preview.1";

function configurePipelinesTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  /**
   * Tool 1: Create or Update Pipeline
   */
  server.tool(
    PIPELINES_TOOLS.create_or_update,
    "Create or update a YAML pipeline configuration",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().optional().describe("Pipeline ID (for update)"),
      name: z.string().describe("Pipeline name"),
      folder: z.string().optional().describe("Folder path (e.g., '\\\\MyFolder')"),
      repository: z.object({
        id: z.string().describe("Repository ID"),
        name: z.string().describe("Repository name"),
        type: z.enum(["azureReposGit", "github", "githubEnterprise", "bitbucket"])
          .describe("Repository type")
      }).describe("Repository configuration"),
      yamlPath: z.string().describe("Path to YAML file (e.g., 'azure-pipelines.yml')"),
      description: z.string().optional().describe("Pipeline description")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        let endpoint: string;
        let method: string;
        
        if (params.pipelineId) {
          endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}?api-version=${pipelinesApiVersion}`;
          method = "PUT";
        } else {
          endpoint = `${baseUrl}/${params.project}/_apis/pipelines?api-version=${pipelinesApiVersion}`;
          method = "POST";
        }
        
        const requestBody = {
          name: params.name,
          folder: params.folder || null,
          configuration: {
            type: "yaml",
            path: params.yamlPath,
            repository: {
              id: params.repository.id,
              name: params.repository.name,
              type: params.repository.type
            }
          },
          description: params.description || null
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
          throw new Error(`Failed to ${params.pipelineId ? 'update' : 'create'} pipeline: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Pipeline operation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 2: Run Pipeline
   */
  server.tool(
    PIPELINES_TOOLS.run,
    "Trigger a pipeline run with optional parameters",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().describe("Pipeline ID to run"),
      branch: z.string().optional().describe("Branch to run (e.g., 'refs/heads/main')"),
      stagesToRun: z.array(z.string()).optional().describe("Specific stages to run"),
      templateParameters: z.record(z.string(), z.any()).optional().describe("Template parameters"),
      variables: z.record(z.string(), z.string()).optional().describe("Runtime variables")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs?api-version=${pipelinesApiVersion}`;
        
        const requestBody: any = {
          resources: {
            repositories: {
              self: {
                refName: params.branch || "refs/heads/main"
              }
            }
          }
        };
        
        if (params.stagesToRun && params.stagesToRun.length > 0) {
          requestBody.stagesToRun = params.stagesToRun;
        }
        
        if (params.templateParameters) {
          requestBody.templateParameters = params.templateParameters;
        }
        
        if (params.variables) {
          requestBody.variables = params.variables;
        }
        
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
          throw new Error(`Failed to run pipeline: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Pipeline run failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 3: Get Run Status
   */
  server.tool(
    PIPELINES_TOOLS.run_status,
    "Get the status of a pipeline run",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().describe("Pipeline ID"),
      runId: z.number().describe("Run ID"),
      includeTimeline: z.boolean().default(false).describe("Include timeline data"),
      includeStages: z.boolean().default(true).describe("Include stage information")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs/${params.runId}?api-version=${pipelinesApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get run status: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get run status failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 4: Cancel Pipeline Run
   */
  server.tool(
    PIPELINES_TOOLS.cancel_run,
    "Cancel a running pipeline",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().describe("Pipeline ID"),
      runId: z.number().describe("Run ID to cancel")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs/${params.runId}?api-version=${pipelinesApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify({ state: "canceling" })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to cancel run: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Cancel run failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 5: Get Pipeline Logs
   */
  server.tool(
    PIPELINES_TOOLS.get_logs,
    "Get logs for a pipeline run",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().describe("Pipeline ID"),
      runId: z.number().describe("Run ID"),
      logId: z.number().optional().describe("Specific log ID (optional)")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        let endpoint: string;
        if (params.logId) {
          endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs/${params.runId}/logs/${params.logId}?api-version=${pipelinesApiVersion}`;
        } else {
          endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs/${params.runId}/logs?api-version=${pipelinesApiVersion}`;
        }
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get logs: ${response.status} ${errorText}`);
        }
        
        let result;
        if (params.logId) {
          result = await response.text();
        } else {
          result = await response.json();
        }
        
        return {
          content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get logs failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 6: List Pipeline Artifacts
   */
  server.tool(
    PIPELINES_TOOLS.list_artifacts,
    "List artifacts produced by a pipeline run",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().describe("Pipeline ID"),
      runId: z.number().describe("Run ID")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs/${params.runId}/artifacts?api-version=${pipelinesApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to list artifacts: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`List artifacts failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 7: Get Pipeline Artifact
   */
  server.tool(
    PIPELINES_TOOLS.get_artifact,
    "Get download URL for a specific artifact",
    {
      project: z.string().describe("Project ID or name"),
      pipelineId: z.number().describe("Pipeline ID"),
      runId: z.number().describe("Run ID"),
      artifactName: z.string().describe("Artifact name")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const endpoint = `${baseUrl}/${params.project}/_apis/pipelines/${params.pipelineId}/runs/${params.runId}/artifacts?artifactName=${encodeURIComponent(params.artifactName)}&api-version=${pipelinesApiVersion}`;
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get artifact: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      } catch (error) {
        throw new Error(`Get artifact failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

export { PIPELINES_TOOLS, configurePipelinesTools };