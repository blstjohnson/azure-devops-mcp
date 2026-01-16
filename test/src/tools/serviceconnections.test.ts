// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

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

  describe("credential redaction", () => {
    it("should redact all sensitive parameter keys", async () => {
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
          authorization: {
            scheme: "Test",
            parameters: {
              password: "pwd",
              token: "tok",
              apitoken: "api",
              secret: "sec",
              clientsecret: "cli",
              serviceprincipalkey: "spk",
              certificate: "cert",
              certificatepassword: "certpwd",
              apikey: "key",
              accesstoken: "access",
              secrettoken: "sectok",
              tenantid: "tenant",
              normalParameter: "visible"
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
      const params_result = parsed.authorization.parameters;

      expect(params_result.password).toBe("[REDACTED]");
      expect(params_result.token).toBe("[REDACTED]");
      expect(params_result.apitoken).toBe("[REDACTED]");
      expect(params_result.secret).toBe("[REDACTED]");
      expect(params_result.clientsecret).toBe("[REDACTED]");
      expect(params_result.serviceprincipalkey).toBe("[REDACTED]");
      expect(params_result.certificate).toBe("[REDACTED]");
      expect(params_result.certificatepassword).toBe("[REDACTED]");
      expect(params_result.apikey).toBe("[REDACTED]");
      expect(params_result.accesstoken).toBe("[REDACTED]");
      expect(params_result.secrettoken).toBe("[REDACTED]");
      expect(params_result.tenantid).toBe("[REDACTED]");
      expect(params_result.normalParameter).toBe("visible");
    });

    it("should handle missing authorization parameters", async () => {
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
          name: "Test",
          type: "generic"
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
      expect(parsed.name).toBe("Test");
    });
  });

  describe("error handling", () => {
    it("should handle network errors in list", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_list"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error("Network error")
      );

      const params = { project: "TestProject" };

      await expect(handler(params)).rejects.toThrow("List service connections failed");
    });

    it("should handle API errors in create", async () => {
      configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "serviceconnections_create"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Bad request")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "Test",
        type: "github",
        url: "https://github.com",
        authorization: {
          scheme: "Token",
          parameters: { accesstoken: "token" }
        }
      };

      await expect(handler(params)).rejects.toThrow("Failed to create service connection");
    });
  });
});