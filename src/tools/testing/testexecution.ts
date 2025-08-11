// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import {
  createTestingError,
  measureExecutionTime,
  parseAzureDevOpsError
} from "./utils.js";
import { ErrorCodes } from "./schemas.js";

const TEST_EXECUTION_TOOLS = {
  run_test: "testexecution_run_test",
  update_result: "testexecution_update_result",
  get_run_results: "testexecution_get_run_results"
};

export function configureTestExecutionTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  
  /**
   * Run Test
   */
  server.tool(
    TEST_EXECUTION_TOOLS.run_test,
    "Create and execute a test run for specified test cases",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().describe("Test plan ID"),
      suiteId: z.number().optional().describe("Optional test suite ID"),
      testCaseIds: z.array(z.number()).optional().describe("Specific test case IDs to run"),
      runTitle: z.string().min(1).max(256).describe("Title for the test run"),
      buildId: z.number().optional().describe("Build ID to associate with the run"),
      iterationPath: z.string().optional().describe("Iteration path for the run"),
      owner: z.string().optional().describe("Owner of the test run"),
      configuration: z.string().optional().describe("Test configuration"),
      comment: z.string().optional().describe("Comment for the test run"),
      automated: z.boolean().default(false).describe("Whether this is an automated test run")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testApi = await connection.getTestApi();

          // Create the test run
          const runCreateModel: any = {
            name: params.runTitle,
            plan: { id: params.planId.toString() },
            automated: params.automated,
            pointIds: [] // Will be populated based on test cases/suites
          };

          if (params.buildId) {
            runCreateModel.build = { id: params.buildId.toString() };
          }

          if (params.iterationPath) {
            runCreateModel.iteration = params.iterationPath;
          }

          if (params.owner) {
            runCreateModel.owner = { displayName: params.owner };
          }

          if (params.comment) {
            runCreateModel.comment = params.comment;
          }

          if (params.configuration) {
            runCreateModel.configurationIds = [parseInt(params.configuration)];
          }

          // Get test points for the specified test cases or suite
          let testPoints: any[] = [];
          
          if (params.testCaseIds && params.testCaseIds.length > 0) {
            // Get test points for specific test cases
            if (!params.suiteId) {
              throw createTestingError(
                ErrorCodes.INVALID_INPUT,
                "suiteId is required when specifying testCaseIds",
                { planId: params.planId, testCaseIds: params.testCaseIds }
              );
            }
            
            for (const testCaseId of params.testCaseIds) {
              const points = await testApi.getPoints(
                params.project,
                params.planId,
                params.suiteId,
                undefined,
                testCaseId.toString()
              );
              if (points) {
                testPoints.push(...points);
              }
            }
          } else if (params.suiteId) {
            // Get all test points from the suite
            const points = await testApi.getPoints(
              params.project,
              params.planId,
              params.suiteId
            );
            if (points) {
              testPoints = points;
            }
          } else {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Either testCaseIds or suiteId must be specified",
              { planId: params.planId }
            );
          }

          if (testPoints.length === 0) {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              "No test points found for the specified criteria",
              { planId: params.planId, suiteId: params.suiteId, testCaseIds: params.testCaseIds }
            );
          }

          // Set the point IDs in the run model
          runCreateModel.pointIds = testPoints.map(point => point.id!);

          // Create the test run
          const createdRun = await testApi.createTestRun(runCreateModel, params.project);

          return {
            testRun: createdRun,
            testPointsCount: testPoints.length,
            testPoints: testPoints.map(point => ({
              id: point.id,
              testCaseId: point.testCase?.id,
              state: point.state
            }))
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
   * Update Test Result
   */
  server.tool(
    TEST_EXECUTION_TOOLS.update_result,
    "Update the result of a specific test case in a test run",
    {
      project: z.string().describe("Project ID or name"),
      runId: z.number().describe("Test run ID"),
      testCaseResultId: z.number().describe("Test case result ID"),
      outcome: z.enum(["Passed", "Failed", "Blocked", "NotExecuted", "Warning", "Error", "NotApplicable", "Paused", "InProgress", "NotImpacted"])
        .describe("Test outcome"),
      comment: z.string().optional().describe("Comment for the result"),
      durationInMs: z.number().optional().describe("Test execution duration in milliseconds"),
      errorMessage: z.string().optional().describe("Error message if test failed"),
      stackTrace: z.string().optional().describe("Stack trace if test failed"),
      attachments: z.array(z.object({
        fileName: z.string(),
        stream: z.string().describe("Base64 encoded file content")
      })).optional().describe("Attachments for the test result")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testApi = await connection.getTestApi();

          // Build the result update model
          const resultUpdateModel = {
            id: params.testCaseResultId,
            outcome: params.outcome,
            comment: params.comment,
            durationInMs: params.durationInMs,
            errorMessage: params.errorMessage,
            stackTrace: params.stackTrace,
            state: "Completed"
          };

          // Update the test result
          const updatedResults = await testApi.updateTestResults(
            [resultUpdateModel],
            params.project,
            params.runId
          );

          // Handle attachments if provided
          if (params.attachments && params.attachments.length > 0) {
            for (const attachment of params.attachments) {
              try {
                const attachmentModel = {
                  fileName: attachment.fileName,
                  stream: attachment.stream // Keep as base64 string
                };

                await testApi.createTestResultAttachment(
                  attachmentModel,
                  params.project,
                  params.runId,
                  params.testCaseResultId
                );
              } catch (attachmentError) {
                // Log attachment error but don't fail the entire operation
                console.warn(`Failed to attach file ${attachment.fileName}:`, attachmentError);
              }
            }
          }

          return {
            updatedResult: updatedResults?.[0],
            attachmentsUploaded: params.attachments?.length || 0
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
   * Get Test Run Results
   */
  server.tool(
    TEST_EXECUTION_TOOLS.get_run_results,
    "Retrieve detailed results for a test run",
    {
      project: z.string().describe("Project ID or name"),
      runId: z.number().describe("Test run ID"),
      includeDetails: z.boolean().default(true).describe("Include detailed test results"),
      includeAttachments: z.boolean().default(false).describe("Include attachment information"),
      top: z.number().min(1).max(1000).default(100).describe("Maximum results to return"),
      skip: z.number().min(0).default(0).describe("Results to skip")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testApi = await connection.getTestApi();

          // Get the test run details
          const testRun = await testApi.getTestRunById(params.project, params.runId);

          // Get test results for the run
          const testResults = await testApi.getTestResults(
            params.project,
            params.runId,
            undefined,
            params.skip,
            params.top
          );

          let detailedResults = testResults;

          if (params.includeDetails && testResults) {
            // Get detailed information for each result
            const detailPromises = testResults.map(async (result) => {
              try {
                const iterations = await testApi.getTestIterations(
                  params.project,
                  params.runId,
                  result.id!
                );

                let attachments = undefined;
                if (params.includeAttachments) {
                  attachments = await testApi.getTestResultAttachments(
                    params.project,
                    params.runId,
                    result.id!
                  );
                }

                return {
                  ...result,
                  iterations,
                  attachments
                };
              } catch (detailError) {
                // Return basic result if detail fetch fails
                return result;
              }
            });

            detailedResults = await Promise.all(detailPromises);
          }

          // Calculate summary statistics
          const summary = testResults?.reduce((acc, result) => {
            const outcome = result.outcome || 'NotExecuted';
            acc.total++;
            acc.outcomes[outcome] = (acc.outcomes[outcome] || 0) + 1;
            if (result.durationInMs) {
              acc.totalDuration += result.durationInMs;
            }
            return acc;
          }, {
            total: 0,
            totalDuration: 0,
            outcomes: {} as Record<string, number>
          });

          return {
            testRun,
            results: detailedResults,
            summary,
            totalResults: testResults?.length || 0
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
}

export { TEST_EXECUTION_TOOLS };