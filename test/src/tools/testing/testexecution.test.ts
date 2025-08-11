import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestExecutionTools } from "../../../../src/tools/testing/testexecution.js";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface TestApiMock {
  createTestRun: jest.Mock;
  updateTestRun: jest.Mock;
  getTestRuns: jest.Mock;
  getTestResults: jest.Mock;
  updateTestResults: jest.Mock;
  getTestResultById: jest.Mock;
}

describe("configureTestExecutionTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getTestApi: jest.Mock };
  let mockTestApi: TestApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockTestApi = {
      createTestRun: jest.fn(),
      updateTestRun: jest.fn(),
      getTestRuns: jest.fn(),
      getTestResults: jest.fn(),
      updateTestResults: jest.fn(),
      getTestResultById: jest.fn(),
    };

    mockConnection = {
      getTestApi: jest.fn().mockResolvedValue(mockTestApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test execution tools on the server", () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("testexecution_create_run tool", () => {
    it("should create test run successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_create_run");

      if (!call) throw new Error("testexecution_create_run tool not registered");
      const [, , , handler] = call;

      const mockTestRun = {
        id: 123,
        name: "Test Run 1",
        state: "InProgress",
        url: "https://dev.azure.com/test/_apis/test/runs/123"
      };

      mockTestApi.createTestRun.mockResolvedValue(mockTestRun);

      const params = {
        project: "TestProject",
        planId: 456,
        suiteId: 789,
        name: "Test Run 1",
        buildId: 101
      };

      const result = await handler(params);

      expect(mockTestApi.createTestRun).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockTestRun, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_create_run");

      if (!call) throw new Error("testexecution_create_run tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to create test run");
      mockTestApi.createTestRun.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        planId: 456,
        suiteId: 789,
        name: "Test Run 1"
      };

      const result = await handler(params);

      expect(mockTestApi.createTestRun).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating test run: Failed to create test run");
    });
  });

  describe("testexecution_update_results tool", () => {
    it("should update test results successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_update_results");

      if (!call) throw new Error("testexecution_update_results tool not registered");
      const [, , , handler] = call;

      const mockResults = [
        { id: 1, outcome: "Passed", state: "Completed" },
        { id: 2, outcome: "Failed", state: "Completed" }
      ];

      mockTestApi.updateTestResults.mockResolvedValue(mockResults);

      const params = {
        project: "TestProject",
        runId: 123,
        results: [
          { id: 1, outcome: "Passed", comment: "Test passed successfully" },
          { id: 2, outcome: "Failed", comment: "Test failed due to assertion error" }
        ]
      };

      const result = await handler(params);

      expect(mockTestApi.updateTestResults).toHaveBeenCalled();
      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2);
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_update_results");

      if (!call) throw new Error("testexecution_update_results tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to update results");
      mockTestApi.updateTestResults.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        runId: 123,
        results: [{ id: 1, outcome: "Passed" }]
      };

      const result = await handler(params);

      expect(mockTestApi.updateTestResults).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error updating test results: Failed to update results");
    });
  });

  describe("testexecution_get_results tool", () => {
    it("should get test results successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_results");

      if (!call) throw new Error("testexecution_get_results tool not registered");
      const [, , , handler] = call;

      const mockResults = [
        { id: 1, testCase: { id: 101, name: "Login Test" }, outcome: "Passed", state: "Completed", duration: 5000 },
        { id: 2, testCase: { id: 102, name: "Registration Test" }, outcome: "Failed", state: "Completed", duration: 8000 }
      ];

      mockTestApi.getTestResults.mockResolvedValue(mockResults);

      const params = {
        project: "TestProject",
        runId: 123,
        outcomes: ["Passed", "Failed"],
        top: 100
      };

      const result = await handler(params);

      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      const response = JSON.parse(result.content[0].text);
      expect(response.results).toHaveLength(2);
      expect(response.summary.total).toBe(2);
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_results");

      if (!call) throw new Error("testexecution_get_results tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to get results");
      mockTestApi.getTestResults.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        runId: 123
      };

      const result = await handler(params);

      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting test results: Failed to get results");
    });
  });

  describe("testexecution_get_runs tool", () => {
    it("should get test runs successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_runs");

      if (!call) throw new Error("testexecution_get_runs tool not registered");
      const [, , , handler] = call;

      const mockRuns = [
        { id: 123, name: "Test Run 1", state: "Completed", totalTests: 10, passedTests: 8, failedTests: 2 },
        { id: 124, name: "Test Run 2", state: "InProgress", totalTests: 5, passedTests: 3, failedTests: 0 }
      ];

      mockTestApi.getTestRuns.mockResolvedValue(mockRuns);

      const params = {
        project: "TestProject",
        planId: 456,
        includeRunDetails: true,
        top: 50
      };

      const result = await handler(params);

      expect(mockTestApi.getTestRuns).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockRuns, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_runs");

      if (!call) throw new Error("testexecution_get_runs tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to get runs");
      mockTestApi.getTestRuns.mockRejectedValue(testError);

      const params = {
        project: "TestProject"
      };

      const result = await handler(params);

      expect(mockTestApi.getTestRuns).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting test runs: Failed to get runs");
    });
  });
});