# Pipelines Tools Implementation Guide

**Category**: Pipelines  
**File**: `src/tools/pipelines.ts`  
**Test File**: `test/src/tools/pipelines.test.ts`  
**Tool Count**: 7  
**API Version**: 6.0-preview.1 (Server 2020 compatible)

---

## Tool Names

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

---

## Complete Implementation: src/tools/pipelines.ts

```typescript
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
```

---

## Test Implementation: test/src/tools/pipelines.test.ts

```typescript
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configurePipelinesTools } from "../../../src/tools/pipelines";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configurePipelinesTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { serverUrl: string; getPipelinesApi: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue({ token: "test-token" });
    mockConnection = {
      serverUrl: "https://dev.azure.com/test-org",
      getPipelinesApi: jest.fn()
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers 7 pipeline tools", () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(7);
    });

    it("registers all expected tool names", () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      const toolNames = calls.map(call => call[0]);
      
      expect(toolNames).toContain("pipelines_create_or_update");
      expect(toolNames).toContain("pipelines_run");
      expect(toolNames).toContain("pipelines_run_status");
      expect(toolNames).toContain("pipelines_cancel_run");
      expect(toolNames).toContain("pipelines_get_logs");
      expect(toolNames).toContain("pipelines_list_artifacts");
      expect(toolNames).toContain("pipelines_get_artifact");
    });
  });

  describe("pipelines_create_or_update tool", () => {
    it("should create a new pipeline successfully", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 123,
          name: "Test Pipeline",
          configuration: { type: "yaml", path: "azure-pipelines.yml" }
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Test Pipeline",
        repository: {
          id: "repo-guid",
          name: "TestRepo",
          type: "azureReposGit" as const
        },
        yamlPath: "azure-pipelines.yml"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(123);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/pipelines?"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should update existing pipeline", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 123, name: "Updated" })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        name: "Updated",
        repository: {
          id: "repo-guid",
          name: "TestRepo",
          type: "azureReposGit" as const
        },
        yamlPath: "azure-pipelines.yml"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/pipelines/123?"),
        expect.objectContaining({ method: "PUT" })
      );
    });

    it("should handle API errors", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Bad Request")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Test",
        repository: {
          id: "invalid",
          name: "Test",
          type: "azureReposGit" as const
        },
        yamlPath: "azure-pipelines.yml"
      };

      await expect(handler(params)).rejects.toThrow("Failed to create pipeline");
    });
  });

  describe("pipelines_run tool", () => {
    it("should trigger pipeline run", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_run"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 456,
          name: "20241122.1",
          state: "inProgress"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        branch: "refs/heads/feature"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(456);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/runs?"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("refs/heads/feature")
        })
      );
    });

    it("should use default branch when not specified", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_run"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 456 })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("refs/heads/main")
        })
      );
    });
  });

  describe("pipelines_run_status tool", () => {
    it("should get run status", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_run_status"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 456,
          state: "completed",
          result: "succeeded"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.state).toBe("completed");
      expect(parsed.result).toBe("succeeded");
    });
  });

  describe("pipelines_cancel_run tool", () => {
    it("should cancel pipeline run", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_cancel_run"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 456,
          state: "canceling"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/runs/456"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ state: "canceling" })
        })
      );
    });
  });

  describe("pipelines_get_logs tool", () => {
    it("should list all logs when logId not provided", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_get_logs"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 2,
          value: [
            { id: 1, lineCount: 100 },
            { id: 2, lineCount: 50 }
          ]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(2);
    });

    it("should get specific log content", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_get_logs"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue("Log line 1\nLog line 2\n")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456,
        logId: 1
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Log line 1\nLog line 2\n");
    });
  });

  describe("pipelines_list_artifacts tool", () => {
    it("should list artifacts", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_list_artifacts"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 1,
          value: [{ name: "drop", type: "Container" }]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(1);
      expect(parsed.value[0].name).toBe("drop");
    });
  });

  describe("pipelines_get_artifact tool", () => {
    it("should get artifact download URL", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_get_artifact"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          name: "drop",
          downloadUrl: "https://..."
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456,
        artifactName: "drop"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.name).toBe("drop");
      expect(parsed.downloadUrl).toBeTruthy();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("artifactName=drop"),
        expect.any(Object)
      );
    });

    it("should handle artifact not found", async () => {
      configurePipelinesTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipelines_get_artifact"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Artifact not found")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        pipelineId: 123,
        runId: 456,
        artifactName: "nonexistent"
      };

      await expect(handler(params)).rejects.toThrow("Failed to get artifact");
    });
  });
});
```

---

## API Endpoints Reference

### Pipelines API (v6.0-preview.1)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| create_or_update (create) | POST | `/{project}/_apis/pipelines?api-version=6.0-preview.1` |
| create_or_update (update) | PUT | `/{project}/_apis/pipelines/{pipelineId}?api-version=6.0-preview.1` |
| run | POST | `/{project}/_apis/pipelines/{pipelineId}/runs?api-version=6.0-preview.1` |
| run_status | GET | `/{project}/_apis/pipelines/{pipelineId}/runs/{runId}?api-version=6.0-preview.1` |
| cancel_run | PATCH | `/{project}/_apis/pipelines/{pipelineId}/runs/{runId}?api-version=6.0-preview.1` |
| get_logs | GET | `/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/logs?api-version=6.0-preview.1` |
| list_artifacts | GET | `/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/artifacts?api-version=6.0-preview.1` |
| get_artifact | GET | `/{project}/_apis/pipelines/{pipelineId}/runs/{runId}/artifacts?artifactName={name}&api-version=6.0-preview.1` |

---

## Implementation Checklist

- [ ] Create `src/tools/pipelines.ts` with all 7 tools
- [ ] Export `PIPELINES_TOOLS` constant and `configurePipelinesTools` function
- [ ] Create `test/src/tools/pipelines.test.ts` with comprehensive tests
- [ ] Achieve >90% test coverage
- [ ] Validate tool names with ESLint
- [ ] Test on Server 2020 and Cloud
- [ ] Add to `src/tools.ts` registration

---

## Server 2020 Compatibility Notes

✅ **Fully Supported on Server 2020 Update 1**
- All endpoints available in API version 6.0
- Repository types: azureReposGit, github supported
- YAML pipeline features fully available

⚠️ **Limitations**
- githubEnterprise repository type may not be available
- Some advanced YAML features may be limited
- Check server version for feature availability