import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestExecutionTools } from "../../../../src/tools/testing/testexecution.js";

describe("configureTestExecutionTools", () => {
  let server: McpServer;
  let tokenProvider: any;
  let connectionProvider: any;
  let mockConnection: any;
  let mockTestApi: any;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn() as () => Promise<AccessToken>;

    mockTestApi = {
      createTestRun: jest.fn(),
      updateTestRun: jest.fn(),
      getTestRuns: jest.fn(),
      getTestResults: jest.fn(),
      updateTestResults: jest.fn(),
      getTestResultById: jest.fn(),
      getPoints: jest.fn(),
      getTestRunById: jest.fn(),
      getTestIterations: jest.fn(),
      getTestResultAttachments: jest.fn(),
      createTestResultAttachment: jest.fn(),
    };

    mockConnection = {
      getTestApi: jest.fn(),
    };
    mockConnection.getTestApi.mockResolvedValue(mockTestApi);

    connectionProvider = jest.fn();
    connectionProvider.mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test execution tools on the server", () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("testexecution_run_test tool", () => {
    it("should create test run successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_run_test");

      if (!call) throw new Error("testexecution_run_test tool not registered");
      const [, , , handler] = call;

      const mockTestRun = {
        id: 123,
        name: "Test Run 1",
        state: "InProgress",
        url: "https://dev.azure.com/test/_apis/test/runs/123"
      };

      mockTestApi.getPoints.mockResolvedValue([
        { id: 1, testCase: { id: 123 }, state: "NotExecuted" },
        { id: 2, testCase: { id: 124 }, state: "NotExecuted" }
      ]);
      mockTestApi.createTestRun.mockResolvedValue(mockTestRun);

      const params = {
        project: "TestProject",
        planId: 456,
        suiteId: 789,
        runTitle: "Test Run 1",
        buildId: 101
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getPoints).toHaveBeenCalled();
      expect(mockTestApi.createTestRun).toHaveBeenCalled();
      expect(result.content[0].text).toContain("testRun");
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_run_test");

      if (!call) throw new Error("testexecution_run_test tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to create test run");
      mockTestApi.getPoints.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        planId: 456,
        suiteId: 789,
        runTitle: "Test Run 1"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testexecution_update_result tool", () => {
    it("should update test results successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_update_result");

      if (!call) throw new Error("testexecution_update_result tool not registered");
      const [, , , handler] = call;

      const mockResults = [
        { id: 1, outcome: "Passed", state: "Completed" },
        { id: 2, outcome: "Failed", state: "Completed" }
      ];

      mockTestApi.updateTestResults.mockResolvedValue(mockResults);

      const params = {
        project: "TestProject",
        runId: 123,
        testCaseResultId: 456,
        outcome: "Passed",
        comment: "Test passed successfully"
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.updateTestResults).toHaveBeenCalled();
      expect(result.content[0].text).toContain("updatedResult");
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_update_result");

      if (!call) throw new Error("testexecution_update_result tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to update results");
      mockTestApi.updateTestResults.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        runId: 123,
        testCaseResultId: 456,
        outcome: "Passed"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testexecution_get_run_results tool", () => {
    it("should get test results successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_run_results");

      if (!call) throw new Error("testexecution_get_run_results tool not registered");
      const [, , , handler] = call;

      const mockResults = [
        { id: 1, testCase: { id: 101, name: "Login Test" }, outcome: "Passed", state: "Completed", duration: 5000 },
        { id: 2, testCase: { id: 102, name: "Registration Test" }, outcome: "Failed", state: "Completed", duration: 8000 }
      ];

      mockTestApi.getTestRunById.mockResolvedValue({ id: 123, name: "Test Run" });
      mockTestApi.getTestResults.mockResolvedValue(mockResults);

      const params = {
        project: "TestProject",
        runId: 123
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestRunById).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2);
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_run_results");

      if (!call) throw new Error("testexecution_get_run_results tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to get results");
      mockTestApi.getTestRunById.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        runId: 123
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testexecution_get_run_results tool - get runs", () => {
    it("should get test runs successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_run_results");

      if (!call) throw new Error("testexecution_get_run_results tool not registered");
      const [, , , handler] = call;

      const mockResults = [
        { id: 1, testCase: { id: 101, name: "Login Test" }, outcome: "Passed", state: "Completed", duration: 5000 },
        { id: 2, testCase: { id: 102, name: "Registration Test" }, outcome: "Failed", state: "Completed", duration: 8000 }
      ];

      mockTestApi.getTestRunById.mockResolvedValue({ id: 123, name: "Test Run" });
      mockTestApi.getTestResults.mockResolvedValue(mockResults);

      const params = {
        project: "TestProject",
        runId: 123
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestRunById).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2);
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_run_results");

      if (!call) throw new Error("testexecution_get_run_results tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to get runs");
      mockTestApi.getTestRunById.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        runId: 123
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });
});