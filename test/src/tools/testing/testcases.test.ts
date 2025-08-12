import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestCaseTools } from "../../../../src/tools/testing/testcases.js";

describe("configureTestCaseTools", () => {
  let server: McpServer;
  let tokenProvider: any;
  let connectionProvider: any;
  let mockConnection: any;
  let mockWitApi: any;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn() as () => Promise<AccessToken>;

    mockWitApi = {
      updateWorkItem: jest.fn(),
      queryByWiql: jest.fn(),
      getWorkItems: jest.fn(),
      getWorkItem: jest.fn(),
    };

    mockConnection = {
      getWorkItemTrackingApi: jest.fn(),
    };
    mockConnection.getWorkItemTrackingApi.mockResolvedValue(mockWitApi);

    connectionProvider = jest.fn();
    connectionProvider.mockResolvedValue(mockConnection);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("tool registration", () => {
    it("registers test case tools on the server", () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("testcase_update_case tool", () => {
    it("should update test case successfully", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_update_case");

      if (!call) throw new Error("testcase_update_case tool not registered");
      const [, , , handler] = call;

      const mockTestCase = {
        id: 123,
        fields: {
          "System.Title": "Updated Test Case",
          "System.State": "Active",
          "Microsoft.VSTS.Common.Priority": 2
        }
      };

      mockWitApi.updateWorkItem.mockResolvedValue(mockTestCase);

      const params = {
        project: "TestProject",
        testCaseId: 123,
        title: "Updated Test Case",
        priority: 2,
        state: "Active"
      };

      const result = await (handler as Function)(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/System.Title",
            value: "Updated Test Case"
          }),
          expect.objectContaining({
            op: "add",
            path: "/fields/Microsoft.VSTS.Common.Priority",
            value: 2
          }),
          expect.objectContaining({
            op: "add",
            path: "/fields/System.State",
            value: "Active"
          })
        ]),
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockTestCase, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_update_case");

      if (!call) throw new Error("testcase_update_case tool not registered");
      const [, , , handler] = call;

      const testError = new Error("API error");
      mockWitApi.updateWorkItem.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        testCaseId: 123,
        title: "Updated Title"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
      expect(mockWitApi.updateWorkItem).toHaveBeenCalled();
    });
  });

  describe("testcase_search_cases tool", () => {
    it("should search test cases successfully", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_search_cases");

      if (!call) throw new Error("testcase_search_cases tool not registered");
      const [, , , handler] = call;

      const mockQueryResult = {
        workItems: [
          { id: 123 },
          { id: 124 }
        ]
      };

      const mockWorkItems = [
        {
          id: 123,
          fields: {
            "System.Id": 123,
            "System.Title": "Login Test",
            "System.State": "Active",
            "Microsoft.VSTS.Common.Priority": 1
          }
        },
        {
          id: 124,
          fields: {
            "System.Id": 124,
            "System.Title": "Registration Test",
            "System.State": "Ready",
            "Microsoft.VSTS.Common.Priority": 2
          }
        }
      ];

      mockWitApi.queryByWiql.mockResolvedValue(mockQueryResult);
      mockWitApi.getWorkItems.mockResolvedValue(mockWorkItems);

      const params = {
        project: "TestProject",
        searchText: "login",
        state: ["Active"],
        top: 100
      };

      const result = await (handler as Function)(params);

      expect(mockWitApi.queryByWiql).toHaveBeenCalled();
      expect(mockWitApi.getWorkItems).toHaveBeenCalledWith(
        [123, 124],
        expect.arrayContaining([
          "System.Id",
          "System.Title",
          "System.State",
          "Microsoft.VSTS.Common.Priority"
        ]),
        undefined,
        undefined,
        undefined,
        "TestProject"
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.testCases).toHaveLength(2);
      expect(response.totalCount).toBe(2);
    });

    it("should handle empty search results", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_search_cases");

      if (!call) throw new Error("testcase_search_cases tool not registered");
      const [, , , handler] = call;

      const mockQueryResult = {
        workItems: []
      };

      mockWitApi.queryByWiql.mockResolvedValue(mockQueryResult);

      const params = {
        project: "TestProject",
        searchText: "nonexistent"
      };

      const result = await (handler as Function)(params);

      const response = JSON.parse(result.content[0].text);
      expect(response.testCases).toHaveLength(0);
      expect(response.totalCount).toBe(0);
    });

    it("should handle API errors correctly", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_search_cases");

      if (!call) throw new Error("testcase_search_cases tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Query failed");
      mockWitApi.queryByWiql.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        searchText: "test"
      };

      await expect((handler as Function)(params)).rejects.toThrow();
      expect(mockWitApi.queryByWiql).toHaveBeenCalled();
    });
  });

  describe("testcase_bulk_update tool", () => {
    it("should perform bulk updates successfully", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_bulk_update");

      if (!call) throw new Error("testcase_bulk_update tool not registered");
      const [, , , handler] = call;

      const mockUpdatedItem = { id: 123, fields: { "System.State": "Ready" } };
      mockWitApi.updateWorkItem.mockResolvedValue(mockUpdatedItem);

      const params = {
        project: "TestProject",
        testCaseIds: [123, 124],
        updates: {
          priority: 2,
          state: "Ready"
        },
        batchSize: 2
      };

      const result = await (handler as Function)(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledTimes(2);

      const response = JSON.parse(result.content[0].text);
      expect(response.totalProcessed).toBe(2);
      expect(response.successCount).toBe(2);
      expect(response.errorCount).toBe(0);
    });

    it("should handle errors with continueOnError", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_bulk_update");

      if (!call) throw new Error("testcase_bulk_update tool not registered");
      const [, , , handler] = call;

      const mockUpdatedItem = { id: 124, fields: { "System.State": "Ready" } };
      
      // Mock updateWorkItem to fail for first call, succeed for second
      mockWitApi.updateWorkItem
        .mockRejectedValueOnce(new Error("Update failed for 123"))
        .mockResolvedValueOnce(mockUpdatedItem);

      const params = {
        project: "TestProject",
        testCaseIds: [123, 124],
        updates: {
          state: "Ready"  // Simple field update
        },
        continueOnError: true
      };

      const result = await (handler as Function)(params);
      
      const response = JSON.parse(result.content[0].text);
      
      expect(response.totalProcessed).toBe(2);
      expect(response.successCount).toBe(1);
      expect(response.errorCount).toBe(1);
      expect(response.errors).toHaveLength(1);
      expect(response.errors[0].testCaseId).toBe(123);
    });

    it("should handle API errors correctly", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_bulk_update");

      if (!call) throw new Error("testcase_bulk_update tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Update failed");
      mockWitApi.updateWorkItem.mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        testCaseIds: [123],
        updates: {
          state: "Ready"  // Simple field update
        },
        continueOnError: false
      };

      await expect((handler as Function)(params)).rejects.toThrow("Update failed");
      
      // Verify updateWorkItem was called
      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/System.State",
            value: "Ready"
          })
        ]),
        123
      );
    });
  });
});