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