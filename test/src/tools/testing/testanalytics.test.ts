import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestAnalyticsTools } from "../../../../src/tools/testing/testanalytics";

describe("configureTestAnalyticsTools", () => {
  let server: McpServer;
  let tokenProvider: any;
  let connectionProvider: any;
  let mockConnection: any;
  let mockTestApi: any;
  let mockWorkItemApi: any;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn() as () => Promise<AccessToken>;

    mockTestApi = {
      getTestRuns: jest.fn(),
      getTestResults: jest.fn(),
      getTestRunById: jest.fn(),
      getTestResultById: jest.fn(),
      getTestResultAttachments: jest.fn(),
      getPlans: jest.fn(),
      getPoints: jest.fn(),
    };

    mockWorkItemApi = {
      queryByWiql: jest.fn(),
      getWorkItems: jest.fn(),
      getWorkItem: jest.fn(),
      updateWorkItem: jest.fn(),
      createWorkItem: jest.fn(),
    };

    mockConnection = {
      getTestApi: jest.fn(),
      getWorkItemTrackingApi: jest.fn(),
    };
    mockConnection.getTestApi.mockResolvedValue(mockTestApi);
    mockConnection.getWorkItemTrackingApi.mockResolvedValue(mockWorkItemApi);

    connectionProvider = jest.fn();
    connectionProvider.mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test analytics tools on the server", () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });

    it("registers all 5 analytics tools", () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      
      const toolNames = calls.map(call => call[0]);
      expect(toolNames).toContain("testanalytics_detect_flaky_tests");
      expect(toolNames).toContain("testanalytics_quality_metrics");
      expect(toolNames).toContain("testanalytics_performance_analysis");
      expect(toolNames).toContain("testanalytics_risk_assessment");
      expect(toolNames).toContain("testanalytics_team_productivity");
    });
  });

  describe("testanalytics_detect_flaky_tests tool", () => {
    it("should detect flaky tests successfully", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_detect_flaky_tests");

      if (!call) throw new Error("testanalytics_detect_flaky_tests tool not registered");
      const [, , , handler] = call;

      const mockTestRuns = [
        {
          id: 123,
          name: "Test Run 1",
          startedDate: new Date("2024-01-01"),
          completedDate: new Date("2024-01-01"),
          plan: { id: 456 }
        },
        {
          id: 124,
          name: "Test Run 2", 
          startedDate: new Date("2024-01-02"),
          completedDate: new Date("2024-01-02"),
          plan: { id: 456 }
        }
      ];

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101, name: "Login Test" },
          outcome: "Passed",
          runBy: { id: "user1" },
          completedDate: new Date("2024-01-01"),
          durationInMs: 5000
        },
        {
          id: 2,
          testCase: { id: 101, name: "Login Test" },
          outcome: "Failed",
          runBy: { id: "user1" },
          completedDate: new Date("2024-01-02"),
          durationInMs: 8000
        },
        {
          id: 3,
          testCase: { id: 102, name: "Registration Test" },
          outcome: "Passed",
          runBy: { id: "user2" },
          completedDate: new Date("2024-01-01"),
          durationInMs: 3000
        }
      ];

      mockTestApi.getTestRuns.mockResolvedValue(mockTestRuns);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);

      const params = {
        project: "TestProject",
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        minExecutions: 2,
        flakinessThreshold: 0.3,
        confidenceLevel: 0.85,
        includeEnvironmentCorrelation: true,
        groupBy: "testCase",
        outputFormat: "detailed"
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestRuns).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.flakyTests).toBeDefined();
      expect(response.summary).toBeDefined();
      expect(response.analysisMetadata).toBeDefined();
    });

    it("should handle insufficient execution data", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_detect_flaky_tests");

      if (!call) throw new Error("testanalytics_detect_flaky_tests tool not registered");
      const [, , , handler] = call;

      mockTestApi.getTestRuns.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        minExecutions: 5
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.flakyTests).toHaveLength(0);
      expect(response.summary.totalTestsAnalyzed).toBe(0);
    });

    it("should validate input parameters", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_detect_flaky_tests");

      if (!call) throw new Error("testanalytics_detect_flaky_tests tool not registered");
      const [, , , handler] = call;

      const invalidParams = {
        project: "TestProject",
        timeframe: {
          startDate: new Date("2024-01-31"),
          endDate: new Date("2024-01-01") // End before start
        }
      };

      await expect((handler as Function)(invalidParams)).rejects.toThrow();
    });
  });

  describe("testanalytics_quality_metrics tool", () => {
    it("should calculate quality metrics successfully", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_quality_metrics");

      if (!call) throw new Error("testanalytics_quality_metrics tool not registered");
      const [, , , handler] = call;

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101, automationStatus: "Automated" },
          outcome: "Passed",
          durationInMs: 5000,
          associatedBugs: []
        },
        {
          id: 2,
          testCase: { id: 102, automationStatus: "NotAutomated" },
          outcome: "Failed",
          durationInMs: 8000,
          associatedBugs: [{ id: 201 }]
        },
        {
          id: 3,
          testCase: { id: 103, automationStatus: "Automated" },
          outcome: "Passed",
          durationInMs: 3000,
          associatedBugs: []
        }
      ];

      const mockDefects = [
        { id: 201, fields: { "System.WorkItemType": "Bug", "System.State": "Active" } }
      ];

      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);
      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 201 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockDefects);

      const params = {
        project: "TestProject",
        scope: {
          planIds: [123]
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        metrics: ["passRate", "automationRate", "defectDensity"],
        includeComparison: true,
        comparisonPeriod: "previousMonth",
        includeRecommendations: true,
        aggregationLevel: "weekly"
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.qualityMetrics).toBeDefined();
      expect(response.qualityMetrics.passRate).toBeDefined();
      expect(response.qualityMetrics.automationRate).toBeDefined();
      expect(response.recommendations).toBeDefined();
    });

    it("should handle empty test data", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_quality_metrics");

      if (!call) throw new Error("testanalytics_quality_metrics tool not registered");
      const [, , , handler] = call;

      mockTestApi.getTestResults.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        scope: { planIds: [123] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        metrics: ["passRate", "automationRate"]
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.qualityMetrics.passRate).toBe(0);
      expect(response.qualityMetrics.automationRate).toBe(0);
    });
  });

  describe("testanalytics_performance_analysis tool", () => {
    it("should analyze performance successfully", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_performance_analysis");

      if (!call) throw new Error("testanalytics_performance_analysis tool not registered");
      const [, , , handler] = call;

      const mockTestRuns = [
        {
          id: 123,
          name: "Test Run 1",
          startedDate: new Date("2024-01-01T10:00:00Z"),
          completedDate: new Date("2024-01-01T10:30:00Z"),
          totalTests: 100,
          passedTests: 85,
          plan: { id: 456 }
        },
        {
          id: 124,
          name: "Test Run 2",
          startedDate: new Date("2024-01-02T10:00:00Z"),
          completedDate: new Date("2024-01-02T10:45:00Z"),
          totalTests: 100,
          passedTests: 82,
          plan: { id: 456 }
        }
      ];

      const mockTestResults = [
        { id: 1, durationInMs: 5000, outcome: "Passed" },
        { id: 2, durationInMs: 8000, outcome: "Failed" },
        { id: 3, durationInMs: 3000, outcome: "Passed" }
      ];

      mockTestApi.getTestRuns.mockResolvedValue(mockTestRuns);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);

      const params = {
        project: "TestProject",
        scope: {
          planIds: [456]
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        analysisTypes: ["executionTime", "throughput", "trends"],
        performanceThresholds: {
          maxExecutionTime: 600,
          minThroughput: 10
        },
        includeRegression: true,
        regressionSensitivity: 0.1,
        includeOptimizationSuggestions: true,
        statisticalAnalysis: true
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestRuns).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.performanceAnalysis).toBeDefined();
      expect(response.performanceAnalysis.performanceMetrics).toBeDefined();
      expect(response.performanceAnalysis.trends).toBeDefined();
      expect(response.performanceAnalysis.optimizationSuggestions).toBeDefined();
    });

    it("should detect performance regressions", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_performance_analysis");

      if (!call) throw new Error("testanalytics_performance_analysis tool not registered");
      const [, , , handler] = call;

      const mockTestRuns = [
        {
          id: 123,
          startedDate: new Date("2024-01-01T10:00:00Z"),
          completedDate: new Date("2024-01-01T10:30:00Z"),
          totalTests: 100
        },
        {
          id: 124,
          startedDate: new Date("2024-01-02T10:00:00Z"),
          completedDate: new Date("2024-01-02T11:00:00Z"), // Significantly longer
          totalTests: 100
        }
      ];

      mockTestApi.getTestRuns.mockResolvedValue(mockTestRuns);
      mockTestApi.getTestResults.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        scope: { planIds: [456] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        analysisTypes: ["executionTime", "regressions"],
        includeRegression: true,
        regressionSensitivity: 0.1
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.performanceAnalysis.regressionAnalysis).toBeDefined();
    });
  });

  describe("testanalytics_risk_assessment tool", () => {
    it("should assess risks successfully", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_risk_assessment");

      if (!call) throw new Error("testanalytics_risk_assessment tool not registered");
      const [, , , handler] = call;

      const mockTestPlans = [
        { id: 123, name: "Test Plan 1", areaPath: "Project\\Area1" }
      ];

      const mockDefects = [
        { id: 201, fields: { "System.WorkItemType": "Bug", "System.State": "Active", "Microsoft.VSTS.Common.Severity": "2 - High" } },
        { id: 202, fields: { "System.WorkItemType": "Bug", "System.State": "Resolved", "Microsoft.VSTS.Common.Severity": "3 - Medium" } }
      ];

      const mockTestResults = [
        { id: 1, outcome: "Passed", testCase: { id: 101 } },
        { id: 2, outcome: "Failed", testCase: { id: 102 } },
        { id: 3, outcome: "Passed", testCase: { id: 103 } }
      ];

      mockTestApi.getPlans.mockResolvedValue(mockTestPlans);
      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 201 }, { id: 202 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockDefects);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);

      const params = {
        project: "TestProject",
        scope: {
          planIds: [123]
        },
        riskFactors: ["testCoverage", "defectHistory", "dependencies"],
        assessmentPeriod: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        riskLevels: {
          lowThreshold: 0.2,
          mediumThreshold: 0.5,
          highThreshold: 0.8
        },
        includePredictiveAnalysis: true,
        predictionHorizon: 30,
        includeRecommendations: true,
        prioritizeByImpact: true
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getPlans).toHaveBeenCalled();
      expect(mockWorkItemApi.queryByWiql).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.riskAssessment).toBeDefined();
      expect(response.riskAssessment.overallRiskScore).toBeDefined();
      expect(response.riskAssessment.riskLevel).toBeDefined();
      expect(response.riskAssessment.riskFactors).toBeDefined();
      expect(response.riskAssessment.mitigationStrategies).toBeDefined();
    });

    it("should handle low risk scenarios", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_risk_assessment");

      if (!call) throw new Error("testanalytics_risk_assessment tool not registered");
      const [, , , handler] = call;

      mockTestApi.getPlans.mockResolvedValue([{ id: 123, name: "Test Plan 1" }]);
      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [] }); // No defects
      mockWorkItemApi.getWorkItems.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue([
        { id: 1, outcome: "Passed", testCase: { id: 101 } },
        { id: 2, outcome: "Passed", testCase: { id: 102 } }
      ]);

      const params = {
        project: "TestProject",
        scope: { planIds: [123] },
        riskFactors: ["testCoverage", "defectHistory"],
        assessmentPeriod: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        }
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.riskAssessment.riskLevel).toBe("low");
    });
  });

  describe("testanalytics_team_productivity tool", () => {
    it("should calculate team productivity successfully", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_team_productivity");

      if (!call) throw new Error("testanalytics_team_productivity tool not registered");
      const [, , , handler] = call;

      const mockTestCases = [
        { 
          id: 101, 
          fields: { 
            "System.CreatedBy": "user1@company.com",
            "System.CreatedDate": "2024-01-15T10:00:00Z",
            "Microsoft.VSTS.TCM.AutomationStatus": "Automated"
          }
        },
        { 
          id: 102, 
          fields: { 
            "System.CreatedBy": "user2@company.com",
            "System.CreatedDate": "2024-01-20T10:00:00Z",
            "Microsoft.VSTS.TCM.AutomationStatus": "NotAutomated"
          }
        }
      ];

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101 },
          outcome: "Passed",
          runBy: { uniqueName: "user1@company.com" },
          completedDate: new Date("2024-01-16"),
          durationInMs: 5000
        },
        {
          id: 2,
          testCase: { id: 102 },
          outcome: "Failed",
          runBy: { uniqueName: "user2@company.com" },
          completedDate: new Date("2024-01-21"),
          durationInMs: 8000
        }
      ];

      const mockDefects = [
        {
          id: 201,
          fields: {
            "System.CreatedBy": "user1@company.com",
            "System.CreatedDate": "2024-01-17T10:00:00Z",
            "System.WorkItemType": "Bug"
          }
        }
      ];

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 101 }, { id: 102 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockTestCases);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);
      
      // Second query for defects
      mockWorkItemApi.queryByWiql.mockResolvedValueOnce({ workItems: [{ id: 101 }, { id: 102 }] })
        .mockResolvedValueOnce({ workItems: [{ id: 201 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValueOnce(mockTestCases)
        .mockResolvedValueOnce(mockDefects);

      const params = {
        project: "TestProject",
        teamScope: {
          userIds: ["user1@company.com", "user2@company.com"],
          includeAllContributors: false
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        productivityMetrics: ["testCreationRate", "executionEfficiency", "defectDetectionRate"],
        benchmarkType: "team",
        includeIndividualMetrics: true,
        anonymizeResults: false,
        includeRecommendations: true,
        aggregationLevel: "weekly",
        includeCapacityPlanning: true
      };

      const result = await (handler as Function)(params);

      expect(mockWorkItemApi.queryByWiql).toHaveBeenCalled();
      expect(mockWorkItemApi.getWorkItems).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.teamProductivity).toBeDefined();
      expect(response.teamProductivity.teamMetrics).toBeDefined();
      expect(response.teamProductivity.individualMetrics).toBeDefined();
      expect(response.teamProductivity.recommendations).toBeDefined();
    });

    it("should handle team with no activity", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_team_productivity");

      if (!call) throw new Error("testanalytics_team_productivity tool not registered");
      const [, , , handler] = call;

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [] });
      mockWorkItemApi.getWorkItems.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        teamScope: {
          userIds: ["inactive@company.com"]
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        productivityMetrics: ["testCreationRate", "executionEfficiency"]
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.teamProductivity.teamMetrics.testCreationRate).toBe(0);
      expect(response.teamProductivity.teamMetrics.executionEfficiency).toBe(0);
    });

    it("should anonymize results when requested", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_team_productivity");

      if (!call) throw new Error("testanalytics_team_productivity tool not registered");
      const [, , , handler] = call;

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [] });
      mockWorkItemApi.getWorkItems.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        teamScope: {
          userIds: ["user1@company.com"]
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        productivityMetrics: ["testCreationRate"],
        includeIndividualMetrics: true,
        anonymizeResults: true
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      if (response.teamProductivity.individualMetrics && response.teamProductivity.individualMetrics.length > 0) {
        expect(response.teamProductivity.individualMetrics[0].displayName).toBeUndefined();
      }
    });
  });

  describe("error handling", () => {
    it("should handle API connection errors", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_detect_flaky_tests");

      if (!call) throw new Error("testanalytics_detect_flaky_tests tool not registered");
      const [, , , handler] = call;

      const connectionError = new Error("Failed to connect to Azure DevOps");
      connectionProvider.mockRejectedValue(connectionError);

      const params = {
        project: "TestProject",
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        }
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });

    it("should handle test API errors", async () => {
      configureTestAnalyticsTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testanalytics_quality_metrics");

      if (!call) throw new Error("testanalytics_quality_metrics tool not registered");
      const [, , , handler] = call;

      const apiError = new Error("Test API error");
      mockTestApi.getTestResults.mockRejectedValue(apiError);

      const params = {
        project: "TestProject",
        scope: { planIds: [123] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        metrics: ["passRate"]
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });
});