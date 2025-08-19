import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestSuiteTools } from "../../../../src/tools/testing/testsuites.js";

describe("configureTestSuiteTools", () => {
  let server: McpServer;
  let tokenProvider: any;
  let connectionProvider: any;
  let mockConnection: any;
  let mockTestPlanApi: any;
  let mockWitApi: any;
  let mockTestApi: any;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn() as () => Promise<AccessToken>;

    mockTestPlanApi = {
      createTestSuite: jest.fn(),
      updateTestSuite: jest.fn(),
      deleteTestSuite: jest.fn(),
      getTestSuitesForPlan: jest.fn(),
      getTestSuiteById: jest.fn(),
      getTestCaseList: jest.fn(),
    };

    mockWitApi = {
      updateWorkItem: jest.fn(),
    };

    mockTestApi = {
      getPoints: jest.fn(),
    };

    mockConnection = {
      getTestPlanApi: jest.fn(),
      getWorkItemTrackingApi: jest.fn(),
      getTestApi: jest.fn(),
    };
    mockConnection.getTestPlanApi.mockResolvedValue(mockTestPlanApi);
    mockConnection.getWorkItemTrackingApi.mockResolvedValue(mockWitApi);
    mockConnection.getTestApi.mockResolvedValue(mockTestApi);

    connectionProvider = jest.fn();
    connectionProvider.mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test suite tools on the server", () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("testsuite_create_suite tool", () => {
    it("should create a static test suite successfully", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_create_suite");

      if (!call) throw new Error("testsuite_create_suite tool not registered");
      const [, , , handler] = call;

      const mockSuite = {
        id: 123,
        name: "Test Suite",
        suiteType: "StaticTestSuite",
        plan: { id: 1, name: "Test Plan" }
      };

      mockTestPlanApi.createTestSuite.mockResolvedValue(mockSuite);

      const params = {
        project: "TestProject",
        planId: 1,
        name: "Test Suite",
        suiteType: "StaticTestSuite"
      };

      const result = await (handler as Function)(params);

      expect(mockTestPlanApi.createTestSuite).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Suite",
          suiteType: "StaticTestSuite"
        }),
        "TestProject",
        1
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockSuite, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_create_suite");

      if (!call) throw new Error("testsuite_create_suite tool not registered");
      const [, , , handler] = call;

      const testError = new Error("API connection failed");
      mockTestPlanApi.createTestSuite.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        planId: 1,
        name: "Test Suite"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
      expect(mockTestPlanApi.createTestSuite).toHaveBeenCalled();
    });
  });

  describe("testsuite_update_suite tool", () => {
    it("should update test suite successfully", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_update_suite");

      if (!call) throw new Error("testsuite_update_suite tool not registered");
      const [, , , handler] = call;

      const currentSuite = {
        id: 123,
        name: "Old Name",
        suiteType: "StaticTestSuite"
      };

      const updatedSuite = {
        ...currentSuite,
        name: "New Name"
      };

      mockTestPlanApi.getTestSuiteById.mockResolvedValue(currentSuite);
      mockTestPlanApi.updateTestSuite.mockResolvedValue(updatedSuite);

      const params = {
        project: "TestProject",
        planId: 1,
        suiteId: 123,
        name: "New Name"
      };

      const result = await (handler as Function)(params);

      expect(mockTestPlanApi.getTestSuiteById).toHaveBeenCalledWith("TestProject", 1, 123);
      expect(mockTestPlanApi.updateTestSuite).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(updatedSuite, null, 2));
    });

    it("should handle suite not found", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_update_suite");

      if (!call) throw new Error("testsuite_update_suite tool not registered");
      const [, , , handler] = call;

      mockTestPlanApi.getTestSuiteById.mockResolvedValue(null);

      const params = {
        project: "TestProject",
        planId: 1,
        suiteId: 999
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testsuite_delete_suite tool", () => {
    it("should delete test suite successfully", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_delete_suite");

      if (!call) throw new Error("testsuite_delete_suite tool not registered");
      const [, , , handler] = call;

      const mockSuite = {
        id: 123,
        name: "Test Suite"
      };

      mockTestPlanApi.getTestSuiteById.mockResolvedValue(mockSuite);
      mockTestPlanApi.deleteTestSuite.mockResolvedValue({});

      const params = {
        project: "TestProject",
        planId: 1,
        suiteId: 123
      };

      const result = await (handler as Function)(params);

      expect(mockTestPlanApi.deleteTestSuite).toHaveBeenCalledWith("TestProject", 1, 123);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.deletedSuiteId).toBe(123);
    });

    it("should handle suite not found", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_delete_suite");

      if (!call) throw new Error("testsuite_delete_suite tool not registered");
      const [, , , handler] = call;

      mockTestPlanApi.getTestSuiteById.mockResolvedValue(null);

      const params = {
        project: "TestProject",
        planId: 1,
        suiteId: 999
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testsuite_list_suites tool", () => {
    it("should list test suites successfully", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_list_suites");

      if (!call) throw new Error("testsuite_list_suites tool not registered");
      const [, , , handler] = call;

      const mockSuites = [
        { id: 123, name: "Suite 1", suiteType: "StaticTestSuite" },
        { id: 124, name: "Suite 2", suiteType: "DynamicTestSuite" }
      ];

      mockTestPlanApi.getTestSuitesForPlan.mockResolvedValue(mockSuites);

      const params = {
        project: "TestProject",
        planId: 1
      };

      const result = await (handler as Function)(params);

      expect(mockTestPlanApi.getTestSuitesForPlan).toHaveBeenCalledWith("TestProject", 1);

      const response = JSON.parse(result.content[0].text);
      expect(response.suites).toHaveLength(2);
    });

    it("should handle missing planId", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_list_suites");

      if (!call) throw new Error("testsuite_list_suites tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testsuite_get_suite_details tool", () => {
    it("should get suite details successfully", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_get_suite_details");

      if (!call) throw new Error("testsuite_get_suite_details tool not registered");
      const [, , , handler] = call;

      const mockSuite = {
        id: 123,
        name: "Test Suite",
        suiteType: "StaticTestSuite"
      };

      mockTestPlanApi.getTestSuiteById.mockResolvedValue(mockSuite);

      const params = {
        project: "TestProject",
        planId: 1,
        suiteId: 123
      };

      const result = await (handler as Function)(params);

      expect(mockTestPlanApi.getTestSuiteById).toHaveBeenCalledWith("TestProject", 1, 123);
      expect(result.content[0].text).toBe(JSON.stringify(mockSuite, null, 2));
    });

    it("should handle suite not found", async () => {
      configureTestSuiteTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testsuite_get_suite_details");

      if (!call) throw new Error("testsuite_get_suite_details tool not registered");
      const [, , , handler] = call;

      mockTestPlanApi.getTestSuiteById.mockResolvedValue(null);

      const params = {
        project: "TestProject",
        planId: 1,
        suiteId: 999
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });
});