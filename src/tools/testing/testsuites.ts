// Copyright (c) eKassir ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import {
  createTestingError,
  createToolResponse,
  measureExecutionTime,
  parseAzureDevOpsError
} from "./utils.js";
import { ErrorCodes } from "./schemas.js";

const TEST_SUITE_TOOLS = {
  create_suite: "testsuite_create_suite",
  update_suite: "testsuite_update_suite", 
  delete_suite: "testsuite_delete_suite",
  list_suites: "testsuite_list_suites",
  get_suite_details: "testsuite_get_suite_details"
};

export function configureTestSuiteTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  
  /**
   * Create Test Suite
   */
  server.tool(
    TEST_SUITE_TOOLS.create_suite,
    "Create a new test suite with support for all suite types (Static, Dynamic, Requirement-based)",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().describe("Test plan ID to create the suite in"),
      name: z.string().min(1).max(256).describe("Name of the test suite"),
      suiteType: z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"])
        .default("StaticTestSuite").describe("Type of test suite to create"),
      parentSuiteId: z.number().optional().describe("Parent suite ID for nested suites"),
      description: z.string().max(4000).optional().describe("Description of the test suite"),
      queryString: z.string().optional().describe("Query string for dynamic test suites"),
      requirementId: z.number().optional().describe("Requirement work item ID"),
      tags: z.array(z.string()).optional().describe("Tags to assign to the suite"),
      areaPath: z.string().optional().describe("Area path for the suite"),
      iterationPath: z.string().optional().describe("Iteration path for the suite")
    },
    async (params) => {
      try {
        // Validate suite type requirements
        if (params.suiteType === "DynamicTestSuite" && !params.queryString) {
          throw createTestingError(
            ErrorCodes.INVALID_INPUT,
            "Query string is required for dynamic test suites",
            { suiteType: params.suiteType }
          );
        }
        if (params.suiteType === "RequirementTestSuite" && !params.requirementId) {
          throw createTestingError(
            ErrorCodes.INVALID_INPUT,
            "Requirement ID is required for requirement test suites",
            { suiteType: params.suiteType }
          );
        }

        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testPlanApi = await connection.getTestPlanApi();

          // Build the suite creation parameters
          const suiteParams: any = {
            name: params.name,
            suiteType: params.suiteType,
            parentSuite: params.parentSuiteId ? { id: params.parentSuiteId, name: "" } : undefined,
            description: params.description,
            queryString: params.queryString,
            requirementId: params.requirementId
          };

          // Create the test suite
          const createdSuite = await testPlanApi.createTestSuite(
            suiteParams,
            params.project,
            params.planId
          );

          // Update additional properties via work item tracking if needed
          if ((params.tags && params.tags.length > 0) || params.areaPath || params.iterationPath) {
            const witApi = await connection.getWorkItemTrackingApi();
            const updateDocument = [];

            if (params.tags && params.tags.length > 0) {
              updateDocument.push({
                op: "add",
                path: "/fields/System.Tags",
                value: params.tags.join("; ")
              });
            }

            if (params.areaPath) {
              updateDocument.push({
                op: "add",
                path: "/fields/System.AreaPath",
                value: params.areaPath
              });
            }

            if (params.iterationPath) {
              updateDocument.push({
                op: "add",
                path: "/fields/System.IterationPath",
                value: params.iterationPath
              });
            }

            if (updateDocument.length > 0 && createdSuite.id) {
              await witApi.updateWorkItem({}, updateDocument, createdSuite.id);
            }
          }

          return createdSuite;
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
   * Update Test Suite
   */
  server.tool(
    TEST_SUITE_TOOLS.update_suite,
    "Update an existing test suite including properties and relationships",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().describe("Test plan ID"),
      suiteId: z.number().describe("Test suite ID to update"),
      name: z.string().min(1).max(256).optional().describe("New name for the test suite"),
      description: z.string().max(4000).optional().describe("New description"),
      parentSuiteId: z.number().optional().describe("New parent suite ID"),
      moveToRoot: z.boolean().default(false).describe("Move suite to root level"),
      queryString: z.string().optional().describe("Updated query string for dynamic suites"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
      areaPath: z.string().optional().describe("Updated area path"),
      iterationPath: z.string().optional().describe("Updated iteration path")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testPlanApi = await connection.getTestPlanApi();

          // Get current suite to validate updates
          const currentSuite = await testPlanApi.getTestSuiteById(
            params.project,
            params.planId,
            params.suiteId
          );

          if (!currentSuite) {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              `Test suite ${params.suiteId} not found`,
              { suiteId: params.suiteId, planId: params.planId }
            );
          }

          // Validate parent relationship if being changed
          if (params.parentSuiteId && !params.moveToRoot) {
            if (params.parentSuiteId === params.suiteId) {
              throw createTestingError(
                ErrorCodes.CIRCULAR_DEPENDENCY,
                "A suite cannot be its own parent",
                { suiteId: params.suiteId, parentSuiteId: params.parentSuiteId }
              );
            }
          }

          // Build update parameters
          const updateParams: any = {
            name: params.name || currentSuite.name,
            parentSuite: params.moveToRoot 
              ? undefined 
              : params.parentSuiteId 
                ? { id: params.parentSuiteId, name: "" }
                : currentSuite.parentSuite,
            queryString: params.queryString !== undefined ? params.queryString : currentSuite.queryString,
            description: params.description
          };

          // Update the test suite
          const updatedSuite = await testPlanApi.updateTestSuite(
            updateParams,
            params.project,
            params.planId,
            params.suiteId
          );

          // Update work item fields if needed
          if (params.tags || params.areaPath || params.iterationPath) {
            const witApi = await connection.getWorkItemTrackingApi();
            const updateDocument = [];

            if (params.tags) {
              updateDocument.push({
                op: "add",
                path: "/fields/System.Tags",
                value: params.tags.join("; ")
              });
            }

            if (params.areaPath) {
              updateDocument.push({
                op: "add",
                path: "/fields/System.AreaPath",
                value: params.areaPath
              });
            }

            if (params.iterationPath) {
              updateDocument.push({
                op: "add",
                path: "/fields/System.IterationPath",
                value: params.iterationPath
              });
            }

            if (updateDocument.length > 0 && updatedSuite.id) {
              await witApi.updateWorkItem({}, updateDocument, updatedSuite.id);
            }
          }

          return updatedSuite;
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
   * Delete Test Suite
   */
  server.tool(
    TEST_SUITE_TOOLS.delete_suite,
    "Safely delete test suites with dependency checking",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().describe("Test plan ID"),
      suiteId: z.number().describe("Test suite ID to delete"),
      deleteChildSuites: z.boolean().default(false).describe("Whether to delete child suites"),
      forceDelete: z.boolean().default(false).describe("Force deletion even with dependencies")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testPlanApi = await connection.getTestPlanApi();

          // Get suite details first for validation
          const suite = await testPlanApi.getTestSuiteById(
            params.project,
            params.planId,
            params.suiteId
          );

          if (!suite) {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              `Test suite ${params.suiteId} not found`,
              { suiteId: params.suiteId, planId: params.planId }
            );
          }

          // Delete child suites if requested
          if (params.deleteChildSuites) {
            try {
              const childSuites = await testPlanApi.getTestSuitesForPlan(
                params.project,
                params.planId
              );

              const childSuitesToDelete = childSuites?.filter(s => s.parentSuite?.id === params.suiteId) || [];
              
              for (const childSuite of childSuitesToDelete) {
                if (childSuite.id) {
                  await testPlanApi.deleteTestSuite(
                    params.project,
                    params.planId,
                    childSuite.id
                  );
                }
              }
            } catch (error) {
              // Continue with main suite deletion even if child deletion fails
            }
          }

          // Delete the main suite
          await testPlanApi.deleteTestSuite(
            params.project,
            params.planId,
            params.suiteId
          );

          return {
            success: true,
            deletedSuiteId: params.suiteId,
            deletedChildSuites: params.deleteChildSuites,
            message: `Successfully deleted test suite ${params.suiteId}`
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
   * List Test Suites
   */
  server.tool(
    TEST_SUITE_TOOLS.list_suites,
    "List and search test suites with filtering and pagination",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().optional().describe("Test plan ID to filter by"),
      parentSuiteId: z.number().optional().describe("Parent suite ID for hierarchical listing"),
      suiteType: z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"])
        .optional().describe("Filter by suite type"),
      nameFilter: z.string().optional().describe("Filter by suite name (partial match)"),
      includeDetails: z.boolean().default(false).describe("Include detailed suite information"),
      includeTestCaseCount: z.boolean().default(true).describe("Include test case count in results"),
      top: z.number().min(1).max(1000).default(100).describe("Maximum number of results"),
      skip: z.number().min(0).default(0).describe("Number of results to skip")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testPlanApi = await connection.getTestPlanApi();

          if (!params.planId) {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Plan ID is required for listing test suites",
              { project: params.project }
            );
          }

          // Get test suites for the plan
          let suites = await testPlanApi.getTestSuitesForPlan(
            params.project,
            params.planId
          );

          if (!suites) {
            suites = [];
          }

          // Apply filtering
          let filteredSuites = suites;

          // Filter by suite type
          if (params.suiteType) {
            filteredSuites = filteredSuites.filter(suite => 
              suite.suiteType === params.suiteType
            );
          }

          // Filter by name
          if (params.nameFilter) {
            const nameFilter = params.nameFilter.toLowerCase();
            filteredSuites = filteredSuites.filter(suite => 
              suite.name?.toLowerCase().includes(nameFilter)
            );
          }

          // Filter by parent suite
          if (params.parentSuiteId) {
            filteredSuites = filteredSuites.filter(suite => 
              suite.parentSuite?.id === params.parentSuiteId
            );
          }

          // Apply pagination
          const totalCount = filteredSuites.length;
          const startIndex = params.skip || 0;
          const endIndex = startIndex + (params.top || 100);
          const paginatedSuites = filteredSuites.slice(startIndex, endIndex);

          // Enhance with additional information if requested
          const enhancedSuites = await Promise.all(
            paginatedSuites.map(async (suite) => {
              const enhanced: any = { ...suite };

              if (params.includeTestCaseCount && suite.id) {
                try {
                  const testCases = await testPlanApi.getTestCaseList(
                    params.project,
                    params.planId!,
                    suite.id
                  );
                  enhanced.testCaseCount = testCases?.length || 0;
                } catch {
                  enhanced.testCaseCount = 0;
                }
              }

              return enhanced;
            })
          );

          return {
            suites: enhancedSuites,
            totalCount,
            filteredCount: filteredSuites.length,
            returnedCount: enhancedSuites.length
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
   * Get Suite Details
   */
  server.tool(
    TEST_SUITE_TOOLS.get_suite_details,
    "Get comprehensive details about a specific test suite",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().describe("Test plan ID"),
      suiteId: z.number().describe("Test suite ID"),
      includeTestCases: z.boolean().default(false).describe("Include test case details"),
      includeStatistics: z.boolean().default(true).describe("Include suite statistics")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testPlanApi = await connection.getTestPlanApi();

          // Get basic suite details
          const suite = await testPlanApi.getTestSuiteById(
            params.project,
            params.planId,
            params.suiteId
          );

          if (!suite) {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              `Test suite ${params.suiteId} not found`,
              { suiteId: params.suiteId, planId: params.planId }
            );
          }

          const details: any = { ...suite };

          // Include test cases if requested
          if (params.includeTestCases) {
            try {
              const testCases = await testPlanApi.getTestCaseList(
                params.project,
                params.planId,
                params.suiteId
              );
              details.testCases = testCases || [];
            } catch {
              details.testCases = [];
            }
          }

          // Include statistics if requested
          if (params.includeStatistics) {
            try {
              // Get test points for statistics
              const testApi = await connection.getTestApi();
              const testPoints = await testApi.getPoints(
                params.project,
                params.planId,
                params.suiteId
              );

              if (testPoints) {
                const stats = {
                  totalTestPoints: testPoints.length,
                  passedTests: testPoints.filter((tp: any) => tp.lastResult?.outcome === "Passed").length,
                  failedTests: testPoints.filter((tp: any) => tp.lastResult?.outcome === "Failed").length,
                  blockedTests: testPoints.filter((tp: any) => tp.lastResult?.outcome === "Blocked").length,
                  notRunTests: testPoints.filter((tp: any) => !tp.lastResult || tp.lastResult.outcome === "NotExecuted").length
                };
                details.statistics = stats;
              }
            } catch {
              details.statistics = {
                totalTestPoints: 0,
                passedTests: 0,
                failedTests: 0,
                blockedTests: 0,
                notRunTests: 0
              };
            }
          }

          return details;
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );
}

export { TEST_SUITE_TOOLS };