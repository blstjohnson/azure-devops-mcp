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

    it("should handle HTTP errors", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_list"
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

      await expect(handler(params)).rejects.toThrow("Failed to list variable groups");
    });

    it("should handle pagination", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_list"
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

    it("should handle group without variables", async () => {
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
          name: "EmptyConfig"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        groupId: 1
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(1);
      expect(parsed.variables).toBeUndefined();
    });

    it("should handle authentication errors", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_get"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockRejectedValue(new Error("Token expired"));

      const params = {
        project: "TestProject",
        groupId: 1
      };

      await expect(handler(params)).rejects.toThrow("Token expired");
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

    it("should create variable group with secrets and redact them", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 4,
          name: "Secret-Config",
          variables: {
            Password: { value: "secret123", isSecret: true }
          }
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Secret-Config",
        variables: {
          Password: { value: "secret123", isSecret: true }
        }
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.variables.Password.value).toBe("[REDACTED]");
    });

    it("should handle validation errors", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_create_or_update"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Invalid variable group name")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "",
        variables: {}
      };

      await expect(handler(params)).rejects.toThrow("Failed to create variable group");
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

    it("should handle force delete", async () => {
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
        forceDelete: true
      };

      await expect(handler(params)).rejects.toThrow("Failed to delete variable group");
    });

    it("should handle not found", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_delete"
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

      await expect(handler(params)).rejects.toThrow("Failed to delete variable group");
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

    it("should handle multiple operations at once", async () => {
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
          Var1: { value: "updated-val1", isSecret: false },
          Var3: { value: "val3", isSecret: true }
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
          Var3: { value: "val3", isSecret: true }
        },
        updateVariables: {
          Var1: { value: "updated-val1" }
        },
        removeVariables: ["Var2"]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.variables.Var1.value).toBe("updated-val1");
      expect(parsed.variables.Var2).toBeUndefined();
      expect(parsed.variables.Var3.value).toBe("[REDACTED]");
    });

    it("should handle GET failure", async () => {
      configureVariableGroupsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "variablegroups_update_variables"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Not found")
      } as any);

      const params = {
        project: "TestProject",
        groupId: 999,
        addVariables: {
          Var1: { value: "val1", isSecret: false }
        }
      };

      await expect(handler(params)).rejects.toThrow("Failed to get variable group");
    });

    it("should handle PUT failure", async () => {
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

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(existingGroup)
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: jest.fn().mockResolvedValue("Invalid update")
        } as any);

      const params = {
        project: "TestProject",
        groupId: 1,
        addVariables: {
          Var2: { value: "val2", isSecret: false }
        }
      };

      await expect(handler(params)).rejects.toThrow("Failed to update variables");
    });
  });
});