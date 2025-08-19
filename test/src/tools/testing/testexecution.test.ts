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
      getWorkItemTrackingApi: jest.fn(),
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

  describe("testexecution_schedule_run tool", () => {
    let mockWorkItemApi: any;

    beforeEach(() => {
      mockWorkItemApi = {
        createWorkItem: jest.fn(),
        updateWorkItem: jest.fn(),
        getWorkItem: jest.fn(),
        deleteWorkItem: jest.fn(),
        queryByWiql: jest.fn()
      };
      mockConnection.getWorkItemTrackingApi.mockResolvedValue(mockWorkItemApi);
    });

    it("should schedule a test run successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_schedule_run");

      if (!call) throw new Error("testexecution_schedule_run tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 456,
        fields: {
          "System.Title": "Scheduled Test Run: Daily Tests",
          "Custom.ScheduleName": "Daily Tests"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        planId: 123,
        scheduleName: "Daily Tests",
        cronExpression: "0 2 * * 1-5",
        timezone: "UTC",
        suiteIds: [789],
        parallel: false,
        maxParallelism: 5,
        timeoutMinutes: 60,
        maxRetries: 2,
        retryOnFailure: true,
        retryDelay: 30,
        enabled: true
      };

      const result = await (handler as Function)(params);

      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/System.Title",
            value: "Scheduled Test Run: Daily Tests"
          })
        ]),
        "TestProject",
        "Task"
      );

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.scheduledRun.name).toBe("Daily Tests");
      expect(parsedResult.scheduledRun.cronExpression).toBe("0 2 * * 1-5");
    });

    it("should validate cron expression", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_schedule_run");

      if (!call) throw new Error("testexecution_schedule_run tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        planId: 123,
        scheduleName: "Invalid Schedule",
        cronExpression: "invalid cron",
        timezone: "UTC"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testexecution_batch_runs tool", () => {
    let mockWorkItemApi: any;

    beforeEach(() => {
      mockWorkItemApi = {
        createWorkItem: jest.fn(),
        updateWorkItem: jest.fn(),
        getWorkItem: jest.fn(),
        deleteWorkItem: jest.fn(),
        queryByWiql: jest.fn()
      };
      mockConnection.getWorkItemTrackingApi.mockResolvedValue(mockWorkItemApi);
    });

    it("should create batch execution successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_batch_runs");

      if (!call) throw new Error("testexecution_batch_runs tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 789,
        fields: {
          "System.Title": "Batch Test Execution: Integration Tests",
          "Custom.BatchName": "Integration Tests"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        batchName: "Integration Tests",
        runs: [
          {
            runName: "Frontend Tests",
            planId: 123,
            suiteIds: [456],
            priority: 1
          },
          {
            runName: "Backend Tests",
            planId: 124,
            suiteIds: [457],
            priority: 2,
            dependsOn: ["Frontend Tests"]
          }
        ],
        executionMode: "sequential",
        maxConcurrentRuns: 3,
        continueOnFailure: true,
        globalTimeout: 120,
        defaultMaxRetries: 1,
        defaultRetryDelay: 60
      };

      const result = await (handler as Function)(params);

      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/System.Title",
            value: "Batch Test Execution: Integration Tests"
          })
        ]),
        "TestProject",
        "Task"
      );

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.batchExecution.name).toBe("Integration Tests");
      expect(parsedResult.batchExecution.runs).toHaveLength(2);
      expect(parsedResult.batchExecution.executionMode).toBe("sequential");
    });

    it("should validate run dependencies", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_batch_runs");

      if (!call) throw new Error("testexecution_batch_runs tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        batchName: "Invalid Batch",
        runs: [
          {
            runName: "Run1",
            planId: 123,
            dependsOn: ["NonExistentRun"] // Invalid dependency
          }
        ],
        executionMode: "sequential"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("testexecution_get_execution_history tool", () => {
    it("should get execution history successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_execution_history");

      if (!call) throw new Error("testexecution_get_execution_history tool not registered");
      const [, , , handler] = call;

      const mockTestRuns = [
        {
          id: 123,
          name: "Test Run 1",
          plan: { id: 456, name: "Test Plan 1" },
          startedDate: new Date(),
          completedDate: new Date(),
          state: "Completed"
        },
        {
          id: 124,
          name: "Test Run 2",
          plan: { id: 456, name: "Test Plan 1" },
          startedDate: new Date(),
          completedDate: new Date(),
          state: "Completed"
        }
      ];

      const mockTestResults = [
        { id: 1, outcome: "Passed", durationInMs: 5000 },
        { id: 2, outcome: "Failed", durationInMs: 8000 },
        { id: 3, outcome: "Passed", durationInMs: 3000 }
      ];

      mockTestApi.getTestRuns.mockResolvedValue(mockTestRuns);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);

      const params = {
        project: "TestProject",
        planIds: [456],
        lastDays: 30,
        includeMetrics: true,
        includeTrends: true,
        groupBy: "day",
        top: 100,
        skip: 0
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestRuns).toHaveBeenCalledWith(
        "TestProject",
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        0,
        100
      );

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.executionHistory.length).toBeGreaterThanOrEqual(0);
      expect(parsedResult.summary).toBeDefined();
      expect(parsedResult.trends).toBeDefined();
      expect(parsedResult.metrics).toBeDefined();
    });

    it("should handle empty results", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_get_execution_history");

      if (!call) throw new Error("testexecution_get_execution_history tool not registered");
      const [, , , handler] = call;

      mockTestApi.getTestRuns.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        lastDays: 30
      };

      const result = await (handler as Function)(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.executionHistory).toHaveLength(0);
      expect(parsedResult.summary.totalRuns).toBe(0);
    });
  });

  describe("testexecution_manage_test_data tool", () => {
    let mockWorkItemApi: any;

    beforeEach(() => {
      mockWorkItemApi = {
        createWorkItem: jest.fn(),
        updateWorkItem: jest.fn(),
        getWorkItem: jest.fn(),
        deleteWorkItem: jest.fn(),
        queryByWiql: jest.fn()
      };
      mockConnection.getWorkItemTrackingApi.mockResolvedValue(mockWorkItemApi);
    });

    it("should create data generation operation successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_manage_test_data");

      if (!call) throw new Error("testexecution_manage_test_data tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 999,
        fields: {
          "System.Title": "Test Data Operation: generate",
          "Custom.Operation": "generate"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        operation: "generate",
        planIds: [123],
        dataType: "synthetic",
        recordCount: 1000,
        seedValue: 12345,
        executionMode: "immediate"
      };

      const result = await (handler as Function)(params);

      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/Custom.Operation",
            value: "generate"
          })
        ]),
        "TestProject",
        "Task"
      );

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.testDataOperation.operation).toBe("generate");
      expect(parsedResult.testDataOperation.state).toBe("InProgress");
    });

    it("should create data cleanup operation successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_manage_test_data");

      if (!call) throw new Error("testexecution_manage_test_data tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 998,
        fields: {
          "System.Title": "Test Data Operation: cleanup",
          "Custom.Operation": "cleanup"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        operation: "cleanup",
        retentionDays: 30,
        cleanupStrategy: "soft-delete",
        preserveReferences: true,
        executionMode: "immediate"
      };

      const result = await (handler as Function)(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.testDataOperation.operation).toBe("cleanup");
    });

    it("should create data masking operation successfully", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_manage_test_data");

      if (!call) throw new Error("testexecution_manage_test_data tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 997,
        fields: {
          "System.Title": "Test Data Operation: mask",
          "Custom.Operation": "mask"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        operation: "mask",
        maskingRules: [
          {
            fieldPattern: "email",
            maskingType: "hash",
            maskingValue: undefined
          },
          {
            fieldPattern: "ssn",
            maskingType: "static",
            maskingValue: "XXX-XX-XXXX"
          }
        ],
        executionMode: "immediate"
      };

      const result = await (handler as Function)(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.testDataOperation.operation).toBe("mask");
    });

    it("should validate operation parameters", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_manage_test_data");

      if (!call) throw new Error("testexecution_manage_test_data tool not registered");
      const [, , , handler] = call;

      // Test missing record count for generation
      const paramsGenerate = {
        project: "TestProject",
        operation: "generate",
        recordCount: 0 // Invalid
      };

      await expect((handler as Function)(paramsGenerate)).rejects.toThrow();

      // Test missing masking rules for mask operation
      const paramsMask = {
        project: "TestProject",
        operation: "mask"
        // Missing maskingRules
      };

      await expect((handler as Function)(paramsMask)).rejects.toThrow();

      // Test missing version name for version operation
      const paramsVersion = {
        project: "TestProject",
        operation: "version"
        // Missing versionName
      };

      await expect((handler as Function)(paramsVersion)).rejects.toThrow();
    });

    it("should handle scheduled execution mode", async () => {
      configureTestExecutionTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testexecution_manage_test_data");

      if (!call) throw new Error("testexecution_manage_test_data tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 996,
        fields: {
          "System.Title": "Test Data Operation: backup",
          "Custom.Operation": "backup"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        operation: "backup",
        versionName: "weekly-backup",
        versionDescription: "Weekly data backup",
        executionMode: "scheduled",
        scheduleExpression: "0 2 * * 0",
        onCompletionEmails: ["admin@example.com"],
        onErrorEmails: ["alerts@example.com"]
      };

      const result = await (handler as Function)(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.testDataOperation.operation).toBe("backup");
      expect(parsedResult.testDataOperation.state).toBe("Pending");
      expect(parsedResult.testDataOperation.executionMode).toBe("scheduled");
      expect(parsedResult.testDataOperation.scheduleExpression).toBe("0 2 * * 0");
    });
  });
});