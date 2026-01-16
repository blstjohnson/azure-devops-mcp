// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureReleaseTools } from "../../../src/tools/releases";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureReleaseTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { serverUrl: string; getReleaseApi: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue({ token: "test-token" });
    mockConnection = {
      serverUrl: "https://dev.azure.com/test-org",
      getReleaseApi: jest.fn()
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers 14 release tools", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(14);
    });

    it("registers all expected tool names", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      const toolNames = calls.map(call => call[0]);
      
      // Existing tools
      expect(toolNames).toContain("release_get_definitions");
      expect(toolNames).toContain("release_get_releases");
      
      // New definition management
      expect(toolNames).toContain("release_get_definition");
      expect(toolNames).toContain("release_create_definition");
      expect(toolNames).toContain("release_update_definition");
      expect(toolNames).toContain("release_delete_definition");
      
      // New release management
      expect(toolNames).toContain("release_get_release");
      expect(toolNames).toContain("release_create_release");
      expect(toolNames).toContain("release_update_release");
      expect(toolNames).toContain("release_abandon_release");
      
      // New deployment
      expect(toolNames).toContain("release_deploy_environment");
      expect(toolNames).toContain("release_get_environment");
      
      // New approvals
      expect(toolNames).toContain("release_list_approvals");
      expect(toolNames).toContain("release_update_approval");
    });
  });

  describe("release_get_definitions tool (existing)", () => {
    it("should list release definitions", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_definitions"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleaseDefinitions: jest.fn().mockResolvedValue([
          { id: 1, name: "Production Release" },
          { id: 2, name: "Staging Release" }
        ])
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Production Release");
      expect(mockApi.getReleaseDefinitions).toHaveBeenCalled();
    });
  });

  describe("release_get_releases tool (existing)", () => {
    it("should list releases", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_releases"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleases: jest.fn().mockResolvedValue([
          { id: 100, name: "Release-1" },
          { id: 101, name: "Release-2" }
        ])
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Release-1");
      expect(mockApi.getReleases).toHaveBeenCalled();
    });
  });

  describe("release_get_definition tool", () => {
    it("should get release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleaseDefinition: jest.fn().mockResolvedValue({
          id: 1,
          name: "Production Release",
          environments: [{ id: 10, name: "Production" }]
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 1
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(1);
      expect(parsed.name).toBe("Production Release");
      expect(mockApi.getReleaseDefinition).toHaveBeenCalledWith("TestProject", 1);
    });

    it("should handle errors", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleaseDefinition: jest.fn().mockRejectedValue(new Error("Not found"))
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 999
      };

      await expect(handler(params)).rejects.toThrow("Get release definition failed");
    });
  });

  describe("release_create_definition tool", () => {
    it("should create release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 5,
          name: "New Release Pipeline",
          environments: []
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "New Release Pipeline",
        environments: [
          { name: "Development", rank: 1 },
          { name: "Production", rank: 2 }
        ],
        artifacts: [
          {
            sourceId: "build-1",
            type: "Build",
            alias: "_MyBuild"
          }
        ]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(5);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/release/definitions?"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should handle creation errors", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_definition"
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
        name: "Invalid Definition",
        environments: [],
        artifacts: []
      };

      await expect(handler(params)).rejects.toThrow("Create release definition failed");
    });
  });

  describe("release_update_definition tool", () => {
    it("should update release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleaseDefinition: jest.fn().mockResolvedValue({
          id: 1,
          name: "Old Name",
          description: "Old Description"
        }),
        updateReleaseDefinition: jest.fn().mockResolvedValue({
          id: 1,
          name: "New Name",
          description: "New Description"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 1,
        name: "New Name",
        description: "New Description"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.name).toBe("New Name");
      expect(mockApi.updateReleaseDefinition).toHaveBeenCalled();
    });
  });

  describe("release_delete_definition tool", () => {
    it("should delete release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_delete_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        deleteReleaseDefinition: jest.fn().mockResolvedValue(undefined)
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 5
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.deletedDefinitionId).toBe(5);
    });

    it("should handle force delete", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_delete_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        deleteReleaseDefinition: jest.fn().mockResolvedValue(undefined)
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 5,
        forceDelete: true,
        comment: "Force deleting"
      };

      await handler(params);

      expect(mockApi.deleteReleaseDefinition).toHaveBeenCalledWith(
        "TestProject",
        5,
        "Force deleting",
        true
      );
    });
  });

  describe("release_get_release tool", () => {
    it("should get release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          status: "Active"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseId: 100
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(100);
      expect(parsed.name).toBe("Release-1");
    });
  });

  describe("release_create_release tool", () => {
    it("should create release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        createRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          definitionId: 1
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 1,
        artifacts: [
          {
            alias: "_MyBuild",
            instanceReference: {
              id: "123",
              name: "Build 20240101.1"
            }
          }
        ]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(100);
      expect(mockApi.createRelease).toHaveBeenCalled();
    });

    it("should create draft release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        createRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          definitionId: 1,
          isDraft: true
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 1,
        artifacts: [],
        isDraft: true
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.isDraft).toBe(true);
    });
  });

  describe("release_update_release tool", () => {
    it("should update release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          description: "Old description",
          status: "Active"
        }),
        updateRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1-Updated",
          description: "New description",
          status: "Active"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseId: 100,
        name: "Release-1-Updated",
        description: "New description"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.name).toBe("Release-1-Updated");
      expect(parsed.description).toBe("New description");
    });
  });

  describe("release_abandon_release tool", () => {
    it("should abandon release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_abandon_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          status: "Active"
        }),
        updateRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          status: "Abandoned"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseId: 100,
        comment: "Cancelled deployment"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.status).toBe("Abandoned");
      expect(mockApi.updateRelease).toHaveBeenCalled();
    });
  });

  describe("release_deploy_environment tool", () => {
    it("should deploy to environment", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_deploy_environment"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 10,
          status: "inProgress",
          name: "Production"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        releaseId: 100,
        environmentId: 10,
        comment: "Deploying to production"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(10);
      expect(parsed.status).toBe("inProgress");
    });

    it("should handle deployment errors", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_deploy_environment"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Deployment failed")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        releaseId: 100,
        environmentId: 10
      };

      await expect(handler(params)).rejects.toThrow("Deploy environment failed");
    });
  });

  describe("release_get_environment tool", () => {
    it("should get environment details", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_environment"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getRelease: jest.fn().mockResolvedValue({
          id: 100,
          environments: [
            { id: 10, name: "Development", status: "succeeded" },
            { id: 20, name: "Production", status: "notStarted" }
          ]
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseId: 100,
        environmentId: 10
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(10);
      expect(parsed.name).toBe("Development");
    });

    it("should handle environment not found", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_environment"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getRelease: jest.fn().mockResolvedValue({
          id: 100,
          environments: [
            { id: 10, name: "Development" }
          ]
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseId: 100,
        environmentId: 999
      };

      await expect(handler(params)).rejects.toThrow("Environment 999 not found");
    });
  });

  describe("release_list_approvals tool", () => {
    it("should list pending approvals", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_list_approvals"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getApprovals: jest.fn().mockResolvedValue([
          {
            id: 1,
            status: "pending",
            release: { id: 100, name: "Release-1" }
          },
          {
            id: 2,
            status: "pending",
            release: { id: 101, name: "Release-2" }
          }
        ])
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        statusFilter: "Pending" as const
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].status).toBe("pending");
    });

    it("should filter approvals by release IDs", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_list_approvals"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getApprovals: jest.fn().mockResolvedValue([
          { id: 1, status: "pending", release: { id: 100 } }
        ])
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseIdsFilter: [100],
        statusFilter: "Pending" as const
      };

      const result = await handler(params);

      // Verify the API was called with the correct project and release filter
      expect(mockApi.getApprovals).toHaveBeenCalled();
      const callArgs = mockApi.getApprovals.mock.calls[0];
      expect(callArgs[0]).toBe("TestProject");
      expect(callArgs[3]).toEqual([100]);
    });
  });

  describe("release_update_approval tool", () => {
    it("should approve an approval", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_approval"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        updateReleaseApproval: jest.fn().mockResolvedValue({
          id: 1,
          status: "approved",
          comments: "Looks good!"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        approvalId: 1,
        status: "Approved" as const,
        comments: "Looks good!"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.status).toBe("approved");
      expect(parsed.comments).toBe("Looks good!");
    });

    it("should reject an approval", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_approval"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        updateReleaseApproval: jest.fn().mockResolvedValue({
          id: 1,
          status: "rejected",
          comments: "Failed tests"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        approvalId: 1,
        status: "Rejected" as const,
        comments: "Failed tests"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.status).toBe("rejected");
    });

    it("should reassign an approval", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_approval"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        updateReleaseApproval: jest.fn().mockResolvedValue({
          id: 1,
          status: "reassigned",
          approver: { displayName: "NewApprover" }
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        approvalId: 1,
        status: "Reassigned" as const,
        reassignTo: "NewApprover"
      };

      await handler(params);

      expect(mockApi.updateReleaseApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          approver: { displayName: "NewApprover" }
        }),
        "TestProject",
        1
      );
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully in get_definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleaseDefinition: jest.fn().mockRejectedValue(new Error("API Error"))
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      await expect(handler({ project: "Test", definitionId: 1 }))
        .rejects.toThrow("Get release definition failed");
    });

    it("should handle network errors in create_release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        createRelease: jest.fn().mockRejectedValue(new Error("Network error"))
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "Test",
        definitionId: 1,
        artifacts: []
      };

      await expect(handler(params)).rejects.toThrow("Create release failed");
    });
  });

  describe("authentication", () => {
    it("should use token provider for fetch calls", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 1 })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "Test",
        name: "Test",
        environments: [],
        artifacts: []
      };

      await handler(params);

      expect(tokenProvider).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": expect.stringContaining("Bearer")
          })
        })
      );
    });
  });
});