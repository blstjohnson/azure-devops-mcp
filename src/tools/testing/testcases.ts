// Copyright (c) eKassir ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import {
  createTestingError,
  measureExecutionTime,
  parseAzureDevOpsError,
  convertStepsToXml
} from "./utils.js";
import { ErrorCodes } from "./schemas.js";

const TEST_CASE_TOOLS = {
  update_case: "testcase_update_case",
  search_cases: "testcase_search_cases",
  bulk_update: "testcase_bulk_update"
};

export function configureTestCaseTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  
  /**
   * Update Test Case
   */
  server.tool(
    TEST_CASE_TOOLS.update_case,
    "Update an existing test case with comprehensive field modification support",
    {
      project: z.string().describe("Project ID or name"),
      testCaseId: z.number().describe("Test case ID to update"),
      title: z.string().min(1).max(512).optional().describe("Updated title"),
      description: z.string().max(4000).optional().describe("Updated description"),
      priority: z.number().min(1).max(4).optional().describe("Priority (1-4)"),
      steps: z.string().optional()
        .describe("Updated test steps (format: '1. Step|Expected result\\n2. Step|Expected')"),
      areaPath: z.string().optional().describe("Updated area path"),
      iterationPath: z.string().optional().describe("Updated iteration path"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
      state: z.enum(["Design", "Ready", "Closed", "Active"]).optional().describe("Test case state"),
      automationStatus: z.enum(["Not Automated", "Planned", "Automated"]).optional()
        .describe("Automation status")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const witApi = await connection.getWorkItemTrackingApi();

          // Build the update document
          const patchDocument = [];

          if (params.title) {
            patchDocument.push({
              op: "add",
              path: "/fields/System.Title",
              value: params.title
            });
          }

          if (params.description) {
            patchDocument.push({
              op: "add",
              path: "/fields/System.Description",
              value: params.description
            });
          }

          if (params.priority) {
            patchDocument.push({
              op: "add",
              path: "/fields/Microsoft.VSTS.Common.Priority",
              value: params.priority
            });
          }

          if (params.steps) {
            let stepsXml;
            // Check if steps is already XML formatted
            if (params.steps.trim().startsWith('<steps')) {
              stepsXml = params.steps; // Use as-is if already XML
            } else {
              stepsXml = convertStepsToXml(params.steps); // Convert from text format
            }
            patchDocument.push({
              op: "add",
              path: "/fields/Microsoft.VSTS.TCM.Steps",
              value: stepsXml
            });
          }

          if (params.areaPath) {
            patchDocument.push({
              op: "add",
              path: "/fields/System.AreaPath",
              value: params.areaPath
            });
          }

          if (params.iterationPath) {
            patchDocument.push({
              op: "add",
              path: "/fields/System.IterationPath",
              value: params.iterationPath
            });
          }

          if (params.tags && params.tags.length > 0) {
            patchDocument.push({
              op: "add",
              path: "/fields/System.Tags",
              value: params.tags.join("; ")
            });
          }

          if (params.state) {
            patchDocument.push({
              op: "add",
              path: "/fields/System.State",
              value: params.state
            });
          }

          if (params.automationStatus) {
            patchDocument.push({
              op: "add",
              path: "/fields/Microsoft.VSTS.TCM.AutomationStatus",
              value: params.automationStatus
            });
          }

          if (patchDocument.length === 0) {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "No fields specified for update",
              { testCaseId: params.testCaseId }
            );
          }

          // Update the test case
          const updatedTestCase = await witApi.updateWorkItem(
            {},
            patchDocument,
            params.testCaseId
          );

          return updatedTestCase;
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * Search Test Cases
   */
  server.tool(
    TEST_CASE_TOOLS.search_cases,
    "Advanced search capabilities across test cases with full-text search and filtering",
    {
      project: z.string().describe("Project ID or name"),
      searchText: z.string().optional().describe("Full-text search across title and description"),
      titleFilter: z.string().optional().describe("Filter by title (supports wildcards)"),
      planIds: z.array(z.number()).optional().describe("Filter by test plan IDs"),
      suiteIds: z.array(z.number()).optional().describe("Filter by test suite IDs"),
      state: z.array(z.enum(["Design", "Ready", "Closed", "Active"])).optional()
        .describe("Filter by test case states"),
      priority: z.array(z.number().min(1).max(4)).optional().describe("Filter by priority levels"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      automationStatus: z.array(z.enum(["Not Automated", "Planned", "Automated"])).optional()
        .describe("Filter by automation status"),
      createdBy: z.string().optional().describe("Filter by creator"),
      top: z.number().min(1).max(1000).default(100).describe("Maximum results"),
      skip: z.number().min(0).default(0).describe("Results to skip"),
      includeSteps: z.boolean().default(false).describe("Include test steps in results")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const witApi = await connection.getWorkItemTrackingApi();

          // Build WIQL query
          let wiqlQuery = "SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Common.Priority] FROM WorkItems WHERE [System.WorkItemType] = 'Test Case'";

          const conditions = [];

          if (params.searchText) {
            conditions.push(`([System.Title] CONTAINS '${params.searchText}' OR [System.Description] CONTAINS '${params.searchText}')`);
          }

          if (params.titleFilter) {
            conditions.push(`[System.Title] CONTAINS '${params.titleFilter}'`);
          }

          if (params.state && params.state.length > 0) {
            const stateConditions = params.state.map(s => `'${s}'`).join(', ');
            conditions.push(`[System.State] IN (${stateConditions})`);
          }

          if (params.priority && params.priority.length > 0) {
            const priorityConditions = params.priority.map(p => `${p}`).join(', ');
            conditions.push(`[Microsoft.VSTS.Common.Priority] IN (${priorityConditions})`);
          }

          if (params.createdBy) {
            conditions.push(`[System.CreatedBy] = '${params.createdBy}'`);
          }

          if (conditions.length > 0) {
            wiqlQuery += ` AND (${conditions.join(' AND ')})`;
          }

          wiqlQuery += ` ORDER BY [System.Id]`;

          // Execute the query
          const queryResult = await witApi.queryByWiql(
            { query: wiqlQuery },
            { project: params.project }
          );

          if (!queryResult.workItems || queryResult.workItems.length === 0) {
            return {
              testCases: [],
              totalCount: 0,
              returnedCount: 0
            };
          }

          // Get the work item IDs
          const workItemIds = queryResult.workItems.map(wi => wi.id!);

          // Get full work item details
          const fields = [
            "System.Id",
            "System.Title", 
            "System.Description",
            "System.State",
            "System.AreaPath",
            "System.IterationPath",
            "System.Tags",
            "Microsoft.VSTS.Common.Priority",
            "Microsoft.VSTS.TCM.AutomationStatus",
            "System.CreatedBy",
            "System.CreatedDate",
            "System.ChangedBy",
            "System.ChangedDate"
          ];

          if (params.includeSteps) {
            fields.push("Microsoft.VSTS.TCM.Steps");
          }

          const workItems = await witApi.getWorkItems(
            workItemIds,
            fields,
            undefined,
            undefined,
            undefined,
            params.project
          );

          // Filter by additional criteria if needed (tags, etc.)
          let filteredItems = workItems || [];

          if (params.tags && params.tags.length > 0) {
            filteredItems = filteredItems.filter(item => {
              const itemTags = item.fields?.["System.Tags"]?.toLowerCase().split(';').map((t: string) => t.trim()) || [];
              return params.tags!.some(tag => 
                itemTags.some((itemTag: string) => itemTag.includes(tag.toLowerCase()))
              );
            });
          }

          if (params.automationStatus && params.automationStatus.length > 0) {
            filteredItems = filteredItems.filter(item => {
              const automationStatus = item.fields?.["Microsoft.VSTS.TCM.AutomationStatus"];
              return params.automationStatus!.includes(automationStatus);
            });
          }

          return {
            testCases: filteredItems,
            totalCount: queryResult.workItems.length,
            returnedCount: filteredItems.length
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * Bulk Update Test Cases
   */
  server.tool(
    TEST_CASE_TOOLS.bulk_update,
    "Perform bulk updates on multiple test cases efficiently",
    {
      project: z.string().describe("Project ID or name"),
      testCaseIds: z.array(z.number()).describe("Test case IDs to update"),
      updates: z.object({
        priority: z.number().min(1).max(4).optional().describe("New priority"),
        state: z.enum(["Design", "Ready", "Closed", "Active"]).optional().describe("New state"),
        areaPath: z.string().optional().describe("New area path"),
        iterationPath: z.string().optional().describe("New iteration path"),
        addTags: z.array(z.string()).optional().describe("Tags to add"),
        removeTags: z.array(z.string()).optional().describe("Tags to remove"),
        automationStatus: z.enum(["Not Automated", "Planned", "Automated"]).optional()
          .describe("New automation status")
      }).describe("Updates to apply to all test cases"),
      batchSize: z.number().min(1).max(100).default(25).describe("Batch size for processing"),
      continueOnError: z.boolean().default(true).describe("Continue on individual failures")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const witApi = await connection.getWorkItemTrackingApi();

          const allResults: Array<{
            success: boolean;
            testCaseId: number;
            result?: any;
            message?: string;
            error?: string;
          }> = [];

          // Process test cases individually
          for (const testCaseId of params.testCaseIds) {
            try {
              // Build patch document for this test case
              const patchDocument = [];

              if (params.updates.priority) {
                patchDocument.push({
                  op: "add",
                  path: "/fields/Microsoft.VSTS.Common.Priority",
                  value: params.updates.priority
                });
              }

              if (params.updates.state) {
                patchDocument.push({
                  op: "add",
                  path: "/fields/System.State",
                  value: params.updates.state
                });
              }

              if (params.updates.areaPath) {
                patchDocument.push({
                  op: "add",
                  path: "/fields/System.AreaPath",
                  value: params.updates.areaPath
                });
              }

              if (params.updates.iterationPath) {
                patchDocument.push({
                  op: "add",
                  path: "/fields/System.IterationPath",
                  value: params.updates.iterationPath
                });
              }

              if (params.updates.automationStatus) {
                patchDocument.push({
                  op: "add",
                  path: "/fields/Microsoft.VSTS.TCM.AutomationStatus",
                  value: params.updates.automationStatus
                });
              }

              // Handle tag operations
              if (params.updates.addTags || params.updates.removeTags) {
                // Get current tags first
                const currentItem = await witApi.getWorkItem(testCaseId, ["System.Tags"]);
                const currentTags = currentItem.fields?.["System.Tags"]?.split(';').map((t: string) => t.trim()).filter((t: string) => t) || [];
                
                let newTags = [...currentTags];

                if (params.updates.addTags) {
                  newTags = [...new Set([...newTags, ...params.updates.addTags])];
                }

                if (params.updates.removeTags) {
                  newTags = newTags.filter(tag => !params.updates.removeTags!.includes(tag));
                }

                patchDocument.push({
                  op: "add",
                  path: "/fields/System.Tags",
                  value: newTags.join("; ")
                });
              }

              if (patchDocument.length > 0) {
                const updatedItem = await witApi.updateWorkItem({}, patchDocument, testCaseId);
                allResults.push({
                  success: true,
                  testCaseId,
                  result: updatedItem
                });
              } else {
                allResults.push({
                  success: true,
                  testCaseId,
                  message: "No updates needed"
                });
              }

            } catch (error) {
              if (params.continueOnError) {
                allResults.push({
                  success: false,
                  testCaseId,
                  error: error instanceof Error ? error.message : "Unknown error"
                });
              } else {
                throw error;
              }
            }
          }

          // Count successes and errors from results
          const successCount = allResults.filter(r => r.success).length;
          const errorCount = allResults.filter(r => !r.success).length;
          const errors = allResults.filter(r => !r.success);

          return {
            results: allResults,
            totalProcessed: params.testCaseIds.length,
            successCount,
            errorCount,
            errors: errors.length > 0 ? errors : undefined
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        // When continueOnError is false, preserve the original error
        if (!params.continueOnError && error instanceof Error) {
          throw error;
        }
        throw parseAzureDevOpsError(error);
      }
    }
  );
}

export { TEST_CASE_TOOLS };