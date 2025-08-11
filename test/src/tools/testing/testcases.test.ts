import { AccessToken } from "@azure/identity";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestCaseTools } from "../../../../src/tools/testing/testcases.js";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface WitApiMock {
  updateWorkItem: jest.Mock;
  queryByWiql: jest.Mock;
  getWorkItems: jest.Mock;
  getWorkItem: jest.Mock;
}

describe("configureTestCaseTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getWorkItemTrackingApi: jest.Mock };
  let mockWitApi: WitApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockWitApi = {
      updateWorkItem: jest.fn(),
      queryByWiql: jest.fn(),
      getWorkItems: jest.fn(),
      getWorkItem: jest.fn(),
    };

    mockConnection = {
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWitApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
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

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue(mockTestCase);

      const params = {
        project: "TestProject",
        testCaseId: 123,
        title: "Updated Test Case",
        priority: 2,
        state: "Active"
      };

      const result = await handler(params);

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
      (mockWitApi.updateWorkItem as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        testCaseId: 123,
        title: "Updated Title"
      };

      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error updating test case: API error");
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

      (mockWitApi.queryByWiql as jest.Mock).mockResolvedValue(mockQueryResult);
      (mockWitApi.getWorkItems as jest.Mock).mockResolvedValue(mockWorkItems);

      const params = {
        project: "TestProject",
        searchText: "login",
        state: ["Active"],
        top: 100
      };

      const result = await handler(params);

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

      (mockWitApi.queryByWiql as jest.Mock).mockResolvedValue(mockQueryResult);

      const params = {
        project: "TestProject",
        searchText: "nonexistent"
      };

      const result = await handler(params);

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
      (mockWitApi.queryByWiql as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        searchText: "test"
      };

      const result = await handler(params);

      expect(mockWitApi.queryByWiql).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error searching test cases: Query failed");
    });
  });

  describe("testcase_bulk_update tool", () => {
    it("should perform bulk updates successfully", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_bulk_update");

      if (!call) throw new Error("testcase_bulk_update tool not registered");
      const [, , , handler] = call;

      const mockUpdatedItem = { id: 123, fields: { "System.State": "Ready" } };
      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue(mockUpdatedItem);

      const params = {
        project: "TestProject",
        testCaseIds: [123, 124],
        updates: {
          priority: 2,
          state: "Ready"
        },
        batchSize: 2
      };

      const result = await handler(params);

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

      const mockUpdatedItem = { id: 124 };
      (mockWitApi.updateWorkItem as jest.Mock)
        .mockRejectedValueOnce(new Error("Update failed for 123"))
        .mockResolvedValueOnce(mockUpdatedItem);

      const params = {
        project: "TestProject",
        testCaseIds: [123, 124],
        updates: {
          priority: 2
        },
        continueOnError: true
      };

      const result = await handler(params);

      const response = JSON.parse(result.content[0].text);
      expect(response.totalProcessed).toBe(2);
      expect(response.successCount).toBe(1);
      expect(response.errorCount).toBe(1);
      expect(response.errors).toHaveLength(1);
    });

    it("should handle API errors correctly", async () => {
      configureTestCaseTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testcase_bulk_update");

      if (!call) throw new Error("testcase_bulk_update tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Update failed");
      (mockWitApi.updateWorkItem as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        testCaseIds: [123, 124],
        updates: {
          priority: 2
        },
        continueOnError: false
      };

      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error in bulk update: Update failed");
    });
  });
});