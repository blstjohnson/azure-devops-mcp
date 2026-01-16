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

    it("should handle pagination", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list"
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
        top: 10,
        continuationToken: "token123"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("%24top=10"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("continuationToken=token123"),
        expect.any(Object)
      );
    });

    it("should handle HTTP errors", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue("Access denied")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = { project: "TestProject" };

      await expect(handler(params)).rejects.toThrow("Failed to list environments");
    });

    it("should handle authentication errors", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockRejectedValue(new Error("Token expired"));

      const params = { project: "TestProject" };

      await expect(handler(params)).rejects.toThrow("Token expired");
    });
  });

  describe("environments_get tool", () => {
    it("should get environment successfully", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_get"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          name: "Development",
          description: "Dev environment"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(1);
      expect(parsed.name).toBe("Development");
    });

    it("should include resources when requested", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_get"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          name: "Development"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        includeResources: true
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("expands=resourceReferences"),
        expect.any(Object)
      );
    });

    it("should handle not found", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_get"
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
        environmentId: 999
      };

      await expect(handler(params)).rejects.toThrow("Failed to get environment");
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

    it("should create environment without description", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 4,
          name: "Test",
          description: ""
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Test"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(4);
      expect(parsed.description).toBe("");
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

    it("should handle force delete with conflict", async () => {
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
        forceDelete: true
      };

      await expect(handler(params)).rejects.toThrow("Failed to delete environment");
    });

    it("should handle not found", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_delete"
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
        environmentId: 999
      };

      await expect(handler(params)).rejects.toThrow("Failed to delete environment");
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

    it("should add virtual machine resource", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_add_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 11,
          name: "web-vm-01",
          type: "virtualmachine"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceType: "virtualMachine" as const,
        resourceName: "web-vm-01"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/providers/virtualmachines"),
        expect.any(Object)
      );
    });

    it("should add generic resource", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_add_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 12,
          name: "generic-resource",
          type: "generic"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceType: "generic" as const,
        resourceName: "generic-resource"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/providers/generic"),
        expect.any(Object)
      );
    });

    it("should add resource with tags", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_add_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 13,
          name: "tagged-resource",
          tags: ["prod", "critical"]
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceType: "generic" as const,
        resourceName: "tagged-resource",
        tags: ["prod", "critical"]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.tags).toHaveLength(2);
    });

    it("should handle errors", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_add_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Invalid resource")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceType: "kubernetes" as const,
        resourceName: ""
      };

      await expect(handler(params)).rejects.toThrow("Failed to add resource");
    });
  });

  describe("environments_remove_resource tool", () => {
    it("should remove resource", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_remove_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = { ok: true };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceId: 10
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.removedResourceId).toBe(10);
    });

    it("should handle not found", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_remove_resource"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Resource not found")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        resourceId: 999
      };

      await expect(handler(params)).rejects.toThrow("Failed to remove resource");
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

    it("should handle pagination", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list_deployments"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 0, value: [] })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1,
        top: 25,
        continuationToken: "deploy-token"
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("%24top=25"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("continuationToken=deploy-token"),
        expect.any(Object)
      );
    });

    it("should handle errors", async () => {
      configureEnvironmentsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "environments_list_deployments"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue("Access denied")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        environmentId: 1
      };

      await expect(handler(params)).rejects.toThrow("Failed to list deployments");
    });
  });
});