import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestReportingTools } from "../../../../src/tools/testing/testreporting";

describe("configureTestReportingTools", () => {
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
      getPlans: jest.fn(),
      getPoints: jest.fn(),
      getTestSuites: jest.fn(),
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
    it("registers test reporting tools on the server", () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });

    it("registers all 4 reporting tools", () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      
      const toolNames = calls.map(call => call[0]);
      expect(toolNames).toContain("testreporting_generate_standard_reports");
      expect(toolNames).toContain("testreporting_create_custom_reports");
      expect(toolNames).toContain("testreporting_export_data");
      expect(toolNames).toContain("testreporting_manage_dashboards");
    });
  });

  describe("testreporting_generate_standard_reports tool", () => {
    it("should generate standard reports successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_generate_standard_reports");

      if (!call) throw new Error("testreporting_generate_standard_reports tool not registered");
      const [, , , handler] = call;

      const mockTestRuns = [
        {
          id: 123,
          name: "Test Run 1",
          plan: { id: 456, name: "Test Plan 1" },
          startedDate: new Date("2024-01-01T10:00:00Z"),
          completedDate: new Date("2024-01-01T10:30:00Z"),
          totalTests: 50,
          passedTests: 45,
          state: "Completed"
        },
        {
          id: 124,
          name: "Test Run 2",
          plan: { id: 456, name: "Test Plan 1" },
          startedDate: new Date("2024-01-02T10:00:00Z"),
          completedDate: new Date("2024-01-02T10:25:00Z"),
          totalTests: 50,
          passedTests: 48,
          state: "Completed"
        }
      ];

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101, name: "Login Test", automationStatus: "Automated" },
          outcome: "Passed",
          durationInMs: 5000,
          completedDate: new Date("2024-01-01T10:15:00Z")
        },
        {
          id: 2,
          testCase: { id: 102, name: "Registration Test", automationStatus: "NotAutomated" },
          outcome: "Failed",
          durationInMs: 8000,
          completedDate: new Date("2024-01-01T10:20:00Z")
        }
      ];

      const mockDefects = [
        {
          id: 201,
          fields: {
            "System.WorkItemType": "Bug",
            "System.State": "Active",
            "Microsoft.VSTS.Common.Severity": "2 - High",
            "System.CreatedDate": "2024-01-01T11:00:00Z"
          }
        }
      ];

      mockTestApi.getTestRuns.mockResolvedValue(mockTestRuns);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);
      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 201 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockDefects);

      const params = {
        project: "TestProject",
        reportTypes: ["testExecution", "testCoverage", "defectSummary", "automationProgress"],
        scope: {
          planIds: [456],
          suiteIds: [789]
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
          comparisonPeriod: "previousMonth"
        },
        outputFormats: ["pdf", "html", "excel"],
        customization: {
          includeCharts: true,
          includeTables: true,
          includeExecutiveSummary: true,
          includeDetailedAnalysis: false,
          brandingTemplate: "company-template"
        },
        distribution: {
          recipients: ["manager@company.com", "lead@company.com"],
          shareLocation: "/shared/reports",
          scheduledDelivery: false,
          retentionDays: 90
        }
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestRuns).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      expect(mockWorkItemApi.queryByWiql).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.standardReports).toBeDefined();
      expect(response.standardReports.length).toBe(4); // 4 report types requested
      expect(response.standardReports[0].outputFiles).toBeDefined();
      expect(response.standardReports[0].summary).toBeDefined();
    });

    it("should handle empty data gracefully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_generate_standard_reports");

      if (!call) throw new Error("testreporting_generate_standard_reports tool not registered");
      const [, , , handler] = call;

      mockTestApi.getTestRuns.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue([]);
      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [] });
      mockWorkItemApi.getWorkItems.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        reportTypes: ["testExecution"],
        scope: { planIds: [456] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        outputFormats: ["json"]
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.standardReports).toBeDefined();
      expect(response.standardReports[0].summary.totalTests).toBe(0);
      expect(response.standardReports[0].summary.passRate).toBe(0);
    });

    it("should validate required parameters", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_generate_standard_reports");

      if (!call) throw new Error("testreporting_generate_standard_reports tool not registered");
      const [, , , handler] = call;

      const invalidParams = {
        project: "TestProject",
        reportTypes: [], // Empty array should fail
        scope: { planIds: [456] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        }
      };

      await expect((handler as Function)(invalidParams)).rejects.toThrow();
    });
  });

  describe("testreporting_create_custom_reports tool", () => {
    it("should create custom reports successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_create_custom_reports");

      if (!call) throw new Error("testreporting_create_custom_reports tool not registered");
      const [, , , handler] = call;

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101, name: "Login Test" },
          outcome: "Passed",
          durationInMs: 5000
        },
        {
          id: 2,
          testCase: { id: 102, name: "Registration Test" },
          outcome: "Failed",
          durationInMs: 8000
        }
      ];

      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);
      mockWorkItemApi.createWorkItem.mockResolvedValue({
        id: 999,
        fields: {
          "System.Title": "Custom Report Template: Executive Summary",
          "Custom.ReportDefinition": JSON.stringify({
            name: "Executive Summary",
            template: "executive"
          })
        }
      });

      const params = {
        project: "TestProject",
        reportDefinition: {
          name: "Executive Summary",
          description: "Monthly executive summary report",
          category: "Executive",
          template: "executive"
        },
        dataSource: {
          planIds: [123, 124],
          suiteIds: [456, 457],
          customQueries: [
            {
              queryName: "recent_failures",
              queryString: "SELECT * FROM TestResults WHERE Outcome = 'Failed' AND Date >= @startDate",
              parameters: { startDate: "2024-01-01" }
            }
          ]
        },
        layout: {
          sections: [
            {
              sectionId: "header",
              sectionType: "header",
              title: "Executive Summary Report",
              content: { logoUrl: "/assets/logo.png", reportDate: new Date() },
              position: { page: 1, order: 1 }
            },
            {
              sectionId: "summary",
              sectionType: "summary",
              title: "Test Summary",
              content: { 
                metrics: ["totalTests", "passRate", "executionTime"],
                chartType: "pie"
              },
              position: { page: 1, order: 2 }
            },
            {
              sectionId: "detailed_results",
              sectionType: "table",
              title: "Detailed Results",
              content: {
                dataQuery: "recent_failures",
                columns: ["testName", "outcome", "duration", "failureReason"]
              },
              position: { page: 2, order: 1 }
            }
          ]
        },
        formatting: {
          pageSize: "A4",
          orientation: "portrait",
          margins: { top: 25, bottom: 25, left: 25, right: 25 },
          fonts: { headerFont: "Arial", bodyFont: "Arial", fontSize: 12 },
          colors: {
            primaryColor: "#0078D4",
            secondaryColor: "#106EBE",
            accentColor: "#FFB900"
          }
        },
        outputOptions: {
          formats: ["pdf", "powerpoint"],
          quality: "high",
          compression: true
        },
        saveAsTemplate: true
      };

      const result = await (handler as Function)(params);

      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.customReport).toBeDefined();
      expect(response.customReport.reportName).toBe("Executive Summary");
      expect(response.customReport.outputFiles).toBeDefined();
      expect(response.customReport.outputFiles.length).toBe(2); // PDF and PowerPoint
      expect(response.customReport.templateSaved).toBe(true);
    });

    it("should handle complex layout configurations", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_create_custom_reports");

      if (!call) throw new Error("testreporting_create_custom_reports tool not registered");
      const [, , , handler] = call;

      mockTestApi.getTestResults.mockResolvedValue([]);

      const params = {
        project: "TestProject",
        reportDefinition: {
          name: "Complex Dashboard Report",
          template: "blank"
        },
        dataSource: {
          planIds: [123]
        },
        layout: {
          sections: [
            {
              sectionId: "chart1",
              sectionType: "chart",
              title: "Pass Rate Trend",
              content: {
                chartType: "line",
                dataQuery: "SELECT Date, PassRate FROM TestMetrics ORDER BY Date",
                xAxis: "Date",
                yAxis: "PassRate"
              },
              position: { page: 1, order: 1 }
            },
            {
              sectionId: "heatmap1",
              sectionType: "chart",
              title: "Test Coverage Heatmap",
              content: {
                chartType: "heatmap",
                dataQuery: "SELECT Component, Coverage FROM CoverageMetrics",
                colorScale: ["#FF0000", "#FFFF00", "#00FF00"]
              },
              position: { page: 1, order: 2 }
            }
          ]
        },
        outputOptions: {
          formats: ["html"],
          quality: "standard"
        }
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.customReport.processingStats.sectionsGenerated).toBe(2);
    });

    it("should validate section requirements", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_create_custom_reports");

      if (!call) throw new Error("testreporting_create_custom_reports tool not registered");
      const [, , , handler] = call;

      const invalidParams = {
        project: "TestProject",
        reportDefinition: {
          name: "Invalid Report",
          template: "blank"
        },
        dataSource: { planIds: [123] },
        layout: {
          sections: [] // Empty sections should fail
        }
      };

      await expect((handler as Function)(invalidParams)).rejects.toThrow();
    });
  });

  describe("testreporting_export_data tool", () => {
    it("should export data successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_export_data");

      if (!call) throw new Error("testreporting_export_data tool not registered");
      const [, , , handler] = call;

      const mockTestCases = [
        {
          id: 101,
          fields: {
            "System.Title": "Login Test",
            "System.State": "Active",
            "Microsoft.VSTS.TCM.AutomationStatus": "Automated",
            "System.CreatedDate": "2024-01-01T10:00:00Z"
          }
        },
        {
          id: 102,
          fields: {
            "System.Title": "Registration Test",
            "System.State": "Active",
            "Microsoft.VSTS.TCM.AutomationStatus": "NotAutomated",
            "System.CreatedDate": "2024-01-02T10:00:00Z"
          }
        }
      ];

      const mockTestRuns = [
        {
          id: 123,
          name: "Test Run 1",
          startedDate: new Date("2024-01-01T10:00:00Z"),
          completedDate: new Date("2024-01-01T10:30:00Z"),
          totalTests: 50,
          passedTests: 45
        }
      ];

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101 },
          outcome: "Passed",
          durationInMs: 5000,
          runBy: { uniqueName: "tester@company.com" }
        },
        {
          id: 2,
          testCase: { id: 102 },
          outcome: "Failed",
          durationInMs: 8000,
          runBy: { uniqueName: "tester@company.com" }
        }
      ];

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 101 }, { id: 102 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockTestCases);
      mockTestApi.getTestRuns.mockResolvedValue(mockTestRuns);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);

      const params = {
        project: "TestProject",
        dataScope: {
          planIds: [123],
          suiteIds: [456],
          testCaseIds: [101, 102],
          runIds: [123]
        },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
          includeHistorical: false
        },
        dataTypes: ["testCases", "testRuns", "testResults"],
        exportFormat: "excel",
        exportOptions: {
          includeMetadata: true,
          includeRelationships: true,
          flattenHierarchy: false,
          includeCalculatedFields: true,
          compression: "zip",
          encoding: "utf8"
        },
        transformation: {
          anonymize: false,
          aggregateData: false,
          customMappings: [
            {
              sourceField: "System.Title",
              targetField: "TestName",
              transformation: "trim"
            }
          ]
        },
        destination: {
          deliveryMethod: "download",
          notificationEmail: "admin@company.com"
        }
      };

      const result = await (handler as Function)(params);

      expect(mockWorkItemApi.queryByWiql).toHaveBeenCalled();
      expect(mockWorkItemApi.getWorkItems).toHaveBeenCalled();
      expect(mockTestApi.getTestRuns).toHaveBeenCalled();
      expect(mockTestApi.getTestResults).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.exportData).toBeDefined();
      expect(response.exportData.scope.dataTypes).toEqual(["testCases", "testRuns", "testResults"]);
      expect(response.exportData.exportFiles).toBeDefined();
      expect(response.exportData.exportFiles.length).toBeGreaterThan(0);
      expect(response.exportData.transformationSummary).toBeDefined();
    });

    it("should handle data anonymization", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_export_data");

      if (!call) throw new Error("testreporting_export_data tool not registered");
      const [, , , handler] = call;

      const mockTestResults = [
        {
          id: 1,
          testCase: { id: 101 },
          outcome: "Passed",
          runBy: { uniqueName: "john.doe@company.com", displayName: "John Doe" }
        }
      ];

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [] });
      mockWorkItemApi.getWorkItems.mockResolvedValue([]);
      mockTestApi.getTestRuns.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue(mockTestResults);

      const params = {
        project: "TestProject",
        dataScope: { runIds: [123] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        dataTypes: ["testResults"],
        exportFormat: "csv",
        transformation: {
          anonymize: true,
          filterCriteria: { "outcome": "Passed" }
        }
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.exportData.transformationSummary.anonymizedFields).toBeDefined();
      expect(response.exportData.transformationSummary.anonymizedFields).toContain("runBy");
    });

    it("should support different export formats", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_export_data");

      if (!call) throw new Error("testreporting_export_data tool not registered");
      const [, , , handler] = call;

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [] });
      mockWorkItemApi.getWorkItems.mockResolvedValue([]);
      mockTestApi.getTestRuns.mockResolvedValue([]);
      mockTestApi.getTestResults.mockResolvedValue([]);

      const formats = ["excel", "csv", "json", "xml", "powerbi"];

      for (const format of formats) {
        const params = {
          project: "TestProject",
          dataScope: { planIds: [123] },
          timeframe: {
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-01-31")
          },
          dataTypes: ["testCases"],
          exportFormat: format
        };

        const result = await (handler as Function)(params);
        const response = JSON.parse(result.content[0].text);

        expect(response.exportData.exportFiles[0].format).toBe(format);
      }
    });

    it("should validate data scope requirements", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_export_data");

      if (!call) throw new Error("testreporting_export_data tool not registered");
      const [, , , handler] = call;

      const invalidParams = {
        project: "TestProject",
        dataScope: {}, // Empty scope
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        dataTypes: ["testCases"],
        exportFormat: "csv"
      };

      await expect((handler as Function)(invalidParams)).rejects.toThrow();
    });
  });

  describe("testreporting_manage_dashboards tool", () => {
    it("should create dashboard successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_manage_dashboards");

      if (!call) throw new Error("testreporting_manage_dashboards tool not registered");
      const [, , , handler] = call;

      const mockWorkItem = {
        id: 777,
        fields: {
          "System.Title": "Dashboard: Test Quality Dashboard",
          "Custom.DashboardDefinition": JSON.stringify({
            name: "Test Quality Dashboard",
            widgets: 3
          })
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        operation: "create",
        dashboardConfig: {
          name: "Test Quality Dashboard",
          description: "Comprehensive test quality metrics dashboard",
          type: "team",
          layout: "grid",
          refreshInterval: 300,
          widgets: []
        },
        layout: {
          gridSize: { columns: 12, rows: 8 },
          widgets: [
            {
              widgetId: "passrate_chart",
              widgetType: "chart",
              title: "Pass Rate Trend",
              position: { x: 0, y: 0, width: 6, height: 4 },
              dataSource: {
                query: "SELECT Date, PassRate FROM TestMetrics ORDER BY Date DESC LIMIT 30",
                refreshInterval: 300,
                parameters: {}
              },
              visualization: {
                chartType: "line",
                colors: ["#0078D4", "#106EBE"],
                formatting: { showLegend: true, showDataLabels: false }
              }
            },
            {
              widgetId: "automation_gauge",
              widgetType: "gauge",
              title: "Automation Rate",
              position: { x: 6, y: 0, width: 3, height: 4 },
              dataSource: {
                query: "SELECT AutomationRate FROM CurrentMetrics",
                refreshInterval: 600
              },
              visualization: {
                thresholds: { low: 30, medium: 70, high: 90 },
                colors: ["#D13438", "#FFB900", "#107C10"],
                formatting: { showValue: true, showPercentage: true }
              }
            },
            {
              widgetId: "defect_table",
              widgetType: "table",
              title: "Recent Defects",
              position: { x: 0, y: 4, width: 9, height: 4 },
              dataSource: {
                query: "SELECT Id, Title, Severity, State FROM Bugs WHERE CreatedDate >= DATEADD(day, -7, GETDATE()) ORDER BY CreatedDate DESC",
                refreshInterval: 900
              }
            }
          ]
        },
        sharing: {
          shareWith: [
            { type: "team", identifier: "QA Team", permissions: "view" },
            { type: "user", identifier: "manager@company.com", permissions: "edit" }
          ],
          accessLink: true,
          embedCode: false
        },
        alerts: {
          enableAlerts: true,
          alertRules: [
            {
              ruleName: "Low Pass Rate Alert",
              condition: "passrate_chart.value < 80",
              threshold: 80,
              recipients: ["qa-lead@company.com", "manager@company.com"],
              frequency: "immediate"
            }
          ]
        },
        automation: {
          autoRefresh: true,
          refreshInterval: 300,
          scheduleReports: true,
          reportSchedule: "0 8 * * 1", // Weekly on Monday at 8 AM
          exportFormats: ["pdf", "png"]
        }
      };

      const result = await (handler as Function)(params);

      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.dashboardResult).toBeDefined();
      expect(response.dashboardResult.operation).toBe("create");
      expect(response.dashboardResult.status).toBe("success");
      expect(response.dashboardResult.dashboard).toBeDefined();
      expect(response.dashboardResult.dashboard.widgets).toBe(3);
      expect(response.dashboardResult.sharing).toBeDefined();
      expect(response.dashboardResult.alerts).toBeDefined();
    });

    it("should update dashboard successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_manage_dashboards");

      if (!call) throw new Error("testreporting_manage_dashboards tool not registered");
      const [, , , handler] = call;

      const mockExistingWorkItem = {
        id: 777,
        fields: {
          "System.Title": "Dashboard: Updated Test Quality Dashboard",
          "Custom.DashboardDefinition": JSON.stringify({
            name: "Updated Test Quality Dashboard",
            widgets: 4
          })
        }
      };

      mockWorkItemApi.getWorkItem.mockResolvedValue(mockExistingWorkItem);
      mockWorkItemApi.updateWorkItem.mockResolvedValue(mockExistingWorkItem);

      const params = {
        project: "TestProject",
        operation: "update",
        dashboardId: "dashboard_777",
        dashboardConfig: {
          name: "Updated Test Quality Dashboard",
          description: "Updated dashboard with new metrics",
          type: "team",
          layout: "grid",
          refreshInterval: 300,
          widgets: []
        },
        layout: {
          widgets: [
            {
              widgetId: "new_metric",
              widgetType: "metric",
              title: "Test Coverage",
              position: { x: 9, y: 0, width: 3, height: 2 },
              dataSource: {
                query: "SELECT Coverage FROM TestCoverage",
                refreshInterval: 600
              }
            }
          ]
        }
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.dashboardResult.operation).toBe("update");
      expect(response.dashboardResult.status).toBe("success");
    });

    it("should list dashboards successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_manage_dashboards");

      if (!call) throw new Error("testreporting_manage_dashboards tool not registered");
      const [, , , handler] = call;

      const mockDashboards = [
        {
          id: 777,
          fields: {
            "System.Title": "Dashboard: Test Quality Dashboard",
            "Custom.DashboardDefinition": JSON.stringify({
              name: "Test Quality Dashboard",
              category: "Quality",
              lastUpdated: "2024-01-15T10:00:00Z"
            })
          }
        },
        {
          id: 778,
          fields: {
            "System.Title": "Dashboard: Performance Dashboard",
            "Custom.DashboardDefinition": JSON.stringify({
              name: "Performance Dashboard",
              category: "Performance",
              lastUpdated: "2024-01-20T10:00:00Z"
            })
          }
        }
      ];

      mockWorkItemApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 777 }, { id: 778 }] });
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockDashboards);

      const params = {
        project: "TestProject",
        operation: "list"
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.dashboardResult.operation).toBe("list");
      expect(response.dashboardResult.dashboards).toBeDefined();
      expect(response.dashboardResult.dashboards.length).toBe(2);
    });

    it("should delete dashboard successfully", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_manage_dashboards");

      if (!call) throw new Error("testreporting_manage_dashboards tool not registered");
      const [, , , handler] = call;

      mockWorkItemApi.getWorkItem.mockResolvedValue({
        id: 777,
        fields: { "System.Title": "Dashboard: Test Dashboard" }
      });
      mockWorkItemApi.updateWorkItem.mockResolvedValue({
        id: 777,
        fields: { "System.State": "Removed" }
      });

      const params = {
        project: "TestProject",
        operation: "delete",
        dashboardId: "dashboard_777"
      };

      const result = await (handler as Function)(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.dashboardResult.operation).toBe("delete");
      expect(response.dashboardResult.status).toBe("success");
    });

    it("should validate widget layout for overlaps", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_manage_dashboards");

      if (!call) throw new Error("testreporting_manage_dashboards tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "TestProject",
        operation: "create",
        dashboardConfig: {
          name: "Invalid Dashboard",
          type: "team",
          layout: "grid",
          refreshInterval: 300,
          widgets: []
        },
        layout: {
          gridSize: { columns: 12, rows: 8 },
          widgets: [
            {
              widgetId: "widget1",
              widgetType: "chart",
              position: { x: 0, y: 0, width: 6, height: 4 },
              dataSource: { query: "SELECT 1", refreshInterval: 300 }
            },
            {
              widgetId: "widget2",
              widgetType: "chart",
              position: { x: 3, y: 2, width: 6, height: 4 }, // Overlaps with widget1
              dataSource: { query: "SELECT 2", refreshInterval: 300 }
            }
          ]
        }
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });

    it("should handle dashboard not found for update/delete", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_manage_dashboards");

      if (!call) throw new Error("testreporting_manage_dashboards tool not registered");
      const [, , , handler] = call;

      mockWorkItemApi.getWorkItem.mockRejectedValue(new Error("Work item not found"));

      const params = {
        project: "TestProject",
        operation: "update",
        dashboardId: "nonexistent_dashboard",
        dashboardConfig: {
          name: "Test Dashboard",
          type: "team",
          layout: "grid",
          refreshInterval: 300,
          widgets: []
        }
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle API connection errors", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_generate_standard_reports");

      if (!call) throw new Error("testreporting_generate_standard_reports tool not registered");
      const [, , , handler] = call;

      const connectionError = new Error("Failed to connect to Azure DevOps");
      connectionProvider.mockRejectedValue(connectionError);

      const params = {
        project: "TestProject",
        reportTypes: ["testExecution"],
        scope: { planIds: [123] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        }
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });

    it("should handle test API errors", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_export_data");

      if (!call) throw new Error("testreporting_export_data tool not registered");
      const [, , , handler] = call;

      const apiError = new Error("Test API error");
      mockTestApi.getTestResults.mockRejectedValue(apiError);

      const params = {
        project: "TestProject",
        dataScope: { planIds: [123] },
        timeframe: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31")
        },
        dataTypes: ["testResults"],
        exportFormat: "csv"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });

    it("should handle work item API errors", async () => {
      configureTestReportingTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testreporting_create_custom_reports");

      if (!call) throw new Error("testreporting_create_custom_reports tool not registered");
      const [, , , handler] = call;

      const workItemError = new Error("Work item API error");
      mockWorkItemApi.createWorkItem.mockRejectedValue(workItemError);

      const params = {
        project: "TestProject",
        reportDefinition: {
          name: "Test Report",
          template: "blank"
        },
        dataSource: { planIds: [123] },
        layout: {
          sections: [
            {
              sectionId: "section1",
              sectionType: "header",
              position: { page: 1, order: 1 },
              content: {}
            }
          ]
        },
        saveAsTemplate: true
      };

      await expect((handler as Function)(params)).rejects.toThrow();
    });
  });
});