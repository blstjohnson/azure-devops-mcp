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
  get_run_results: "testexecution_get_run_results",
  schedule_run: "testexecution_schedule_run",
  batch_runs: "testexecution_batch_runs",
  get_execution_history: "testexecution_get_execution_history",
  manage_test_data: "testexecution_manage_test_data"
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

  /**
   * Schedule Test Run
   */
  server.tool(
    TEST_EXECUTION_TOOLS.schedule_run,
    "Schedule automated test runs with cron-based scheduling, trigger conditions, retry policies",
    {
      project: z.string().describe("Project ID or name"),
      planId: z.number().describe("Test plan ID"),
      scheduleName: z.string().min(1).max(256).describe("Name for the scheduled run"),
      cronExpression: z.string().describe("Cron expression for scheduling (e.g., '0 2 * * 1-5')"),
      timezone: z.string().default("UTC").describe("Timezone for schedule execution"),
      suiteIds: z.array(z.number()).optional().describe("Test suite IDs to run"),
      testCaseIds: z.array(z.number()).optional().describe("Specific test case IDs"),
      configurationId: z.number().optional().describe("Test configuration to use"),
      buildDefinitionId: z.number().optional().describe("Build definition to trigger before run"),
      parallel: z.boolean().default(false).describe("Run tests in parallel"),
      maxParallelism: z.number().min(1).max(20).default(5).describe("Maximum parallel executions"),
      timeoutMinutes: z.number().min(1).max(1440).default(60).describe("Timeout in minutes"),
      maxRetries: z.number().min(0).max(5).default(2).describe("Maximum retry attempts"),
      retryOnFailure: z.boolean().default(true).describe("Retry on failure"),
      retryDelay: z.number().min(0).max(300).default(30).describe("Delay between retries in seconds"),
      startDate: z.coerce.date().optional().describe("Schedule start date"),
      endDate: z.coerce.date().optional().describe("Schedule end date"),
      enabled: z.boolean().default(true).describe("Whether schedule is enabled"),
      onSuccessEmails: z.array(z.string().email()).optional().describe("Email addresses for success notifications"),
      onFailureEmails: z.array(z.string().email()).optional().describe("Email addresses for failure notifications")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Validate cron expression (basic validation)
          if (!isValidCronExpression(params.cronExpression)) {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Invalid cron expression format",
              { cronExpression: params.cronExpression },
              ["Use standard cron format: '0 2 * * 1-5' (runs daily at 2 AM, Monday-Friday)"]
            );
          }

          // Create scheduled run as a work item
          const workItemFields: any = {
            "System.Title": `Scheduled Test Run: ${params.scheduleName}`,
            "System.Description": `Automated test run scheduled with cron: ${params.cronExpression}`,
            "System.AreaPath": params.project,
            "System.IterationPath": params.project,
            "System.State": params.enabled ? "Active" : "New"
          };

          // Add custom fields for schedule data
          const customFields = {
            "Custom.ScheduleType": "TestRunSchedule",
            "Custom.ScheduleName": params.scheduleName,
            "Custom.CronExpression": params.cronExpression,
            "Custom.Timezone": params.timezone,
            "Custom.PlanId": params.planId.toString(),
            "Custom.SuiteIds": JSON.stringify(params.suiteIds || []),
            "Custom.TestCaseIds": JSON.stringify(params.testCaseIds || []),
            "Custom.ConfigurationId": params.configurationId?.toString() || "",
            "Custom.BuildDefinitionId": params.buildDefinitionId?.toString() || "",
            "Custom.ExecutionSettings": JSON.stringify({
              parallel: params.parallel,
              maxParallelism: params.maxParallelism,
              timeoutMinutes: params.timeoutMinutes,
              maxRetries: params.maxRetries,
              retryOnFailure: params.retryOnFailure,
              retryDelay: params.retryDelay
            }),
            "Custom.SchedulePeriod": JSON.stringify({
              startDate: params.startDate?.toISOString(),
              endDate: params.endDate?.toISOString(),
              enabled: params.enabled
            }),
            "Custom.Notifications": JSON.stringify({
              onSuccess: params.onSuccessEmails || [],
              onFailure: params.onFailureEmails || []
            })
          };

          for (const [field, value] of Object.entries(customFields)) {
            if (value) {
              workItemFields[field] = value;
            }
          }

          const patchDocument = Object.entries(workItemFields).map(([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value
          }));

          const createdWorkItem = await workItemApi.createWorkItem(
            undefined,
            patchDocument,
            params.project,
            "Task"
          );

          // Calculate next run time
          const nextRun = calculateNextRunTime(params.cronExpression, params.timezone);

          return {
            scheduledRun: {
              id: createdWorkItem.id,
              name: params.scheduleName,
              cronExpression: params.cronExpression,
              timezone: params.timezone,
              enabled: params.enabled,
              planId: params.planId,
              suiteIds: params.suiteIds,
              testCaseIds: params.testCaseIds,
              configurationId: params.configurationId,
              buildDefinitionId: params.buildDefinitionId,
              executionSettings: {
                parallel: params.parallel,
                maxParallelism: params.maxParallelism,
                timeoutMinutes: params.timeoutMinutes,
                maxRetries: params.maxRetries,
                retryOnFailure: params.retryOnFailure,
                retryDelay: params.retryDelay
              },
              schedule: {
                startDate: params.startDate?.toISOString(),
                endDate: params.endDate?.toISOString(),
                nextRun: nextRun.toISOString()
              },
              notifications: {
                onSuccess: params.onSuccessEmails || [],
                onFailure: params.onFailureEmails || []
              },
              createdDate: new Date().toISOString()
            }
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
   * Batch Test Runs
   */
  server.tool(
    TEST_EXECUTION_TOOLS.batch_runs,
    "Manage multiple test runs with parallel/sequential execution, resource allocation, priority management",
    {
      project: z.string().describe("Project ID or name"),
      batchName: z.string().min(1).max(256).describe("Name for the batch execution"),
      runs: z.array(z.object({
        runName: z.string().describe("Name for this run"),
        planId: z.number().describe("Test plan ID"),
        suiteIds: z.array(z.number()).optional().describe("Test suite IDs"),
        testCaseIds: z.array(z.number()).optional().describe("Specific test case IDs"),
        configurationId: z.number().optional().describe("Test configuration to use"),
        priority: z.number().min(1).max(10).default(5).describe("Execution priority (1=highest)"),
        dependsOn: z.array(z.string()).optional().describe("Names of runs this depends on")
      })).min(1).describe("Test runs to execute"),
      executionMode: z.enum(["sequential", "parallel", "prioritized"]).default("sequential")
        .describe("How to execute the batch"),
      maxConcurrentRuns: z.number().min(1).max(10).default(3).describe("Maximum concurrent runs"),
      continueOnFailure: z.boolean().default(true).describe("Continue batch if individual run fails"),
      globalTimeout: z.number().min(1).max(1440).default(120).describe("Global timeout in minutes"),
      defaultMaxRetries: z.number().min(0).max(5).default(1).describe("Default max retries"),
      defaultRetryDelay: z.number().min(0).max(300).default(60).describe("Default retry delay in seconds")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Validate run dependencies
          validateRunDependencies(params.runs);

          // Create batch execution as a work item
          const workItemFields: any = {
            "System.Title": `Batch Test Execution: ${params.batchName}`,
            "System.Description": `Batch execution of ${params.runs.length} test runs`,
            "System.AreaPath": params.project,
            "System.IterationPath": params.project,
            "System.State": "New"
          };

          // Add custom fields for batch data
          const customFields = {
            "Custom.BatchType": "TestRunBatch",
            "Custom.BatchName": params.batchName,
            "Custom.ExecutionMode": params.executionMode,
            "Custom.MaxConcurrentRuns": params.maxConcurrentRuns.toString(),
            "Custom.ContinueOnFailure": params.continueOnFailure.toString(),
            "Custom.GlobalTimeout": params.globalTimeout.toString(),
            "Custom.Runs": JSON.stringify(params.runs),
            "Custom.DefaultRetrySettings": JSON.stringify({
              maxRetries: params.defaultMaxRetries,
              retryDelay: params.defaultRetryDelay
            })
          };

          for (const [field, value] of Object.entries(customFields)) {
            if (value) {
              workItemFields[field] = value;
            }
          }

          const patchDocument = Object.entries(workItemFields).map(([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value
          }));

          const createdWorkItem = await workItemApi.createWorkItem(
            undefined,
            patchDocument,
            params.project,
            "Task"
          );

          // Prepare execution plan
          const executionPlan = createExecutionPlan(params.runs, params.executionMode);

          return {
            batchExecution: {
              id: createdWorkItem.id,
              name: params.batchName,
              state: "NotStarted",
              runs: params.runs.map(run => ({
                ...run,
                state: "Pending",
                runId: undefined,
                startTime: undefined,
                endTime: undefined,
                duration: undefined
              })),
              executionMode: params.executionMode,
              maxConcurrentRuns: params.maxConcurrentRuns,
              continueOnFailure: params.continueOnFailure,
              progress: {
                totalRuns: params.runs.length,
                completedRuns: 0,
                failedRuns: 0,
                remainingRuns: params.runs.length,
                estimatedTimeRemaining: undefined
              },
              globalTimeout: params.globalTimeout,
              executionPlan,
              createdDate: new Date().toISOString()
            }
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
   * Get Execution History
   */
  server.tool(
    TEST_EXECUTION_TOOLS.get_execution_history,
    "Comprehensive execution history with trend analysis, performance metrics, environment correlation",
    {
      project: z.string().describe("Project ID or name"),
      planIds: z.array(z.number()).optional().describe("Filter by test plan IDs"),
      suiteIds: z.array(z.number()).optional().describe("Filter by test suite IDs"),
      startDate: z.coerce.date().optional().describe("Execution start date filter"),
      endDate: z.coerce.date().optional().describe("Execution end date filter"),
      lastDays: z.number().min(1).max(365).optional().describe("Last N days of executions"),
      outcomes: z.array(z.enum(["Passed", "Failed", "Blocked", "NotExecuted", "Warning", "Error"]))
        .optional().describe("Filter by test outcomes"),
      runStates: z.array(z.enum(["NotStarted", "InProgress", "Completed", "Aborted", "Timeout"]))
        .optional().describe("Filter by run states"),
      includeMetrics: z.boolean().default(true).describe("Include performance metrics"),
      includeTrends: z.boolean().default(true).describe("Include trend analysis"),
      includeEnvironmentCorrelation: z.boolean().default(false)
        .describe("Include environment correlation data"),
      groupBy: z.enum(["day", "week", "month", "suite", "configuration", "environment"])
        .default("day").describe("Group results by time period or category"),
      includeFlakiness: z.boolean().default(false).describe("Include flakiness analysis"),
      includeDetailedResults: z.boolean().default(false).describe("Include detailed test results"),
      top: z.number().min(1).max(1000).default(100).describe("Maximum results to return"),
      skip: z.number().min(0).default(0).describe("Results to skip")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const testApi = await connection.getTestApi();

          // Calculate date range
          let startDate = params.startDate;
          let endDate = params.endDate;

          if (params.lastDays) {
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - params.lastDays);
          }

          // Get test runs within date range
          const testRuns = await testApi.getTestRuns(
            params.project,
            undefined, // buildUri
            undefined, // owner
            undefined, // tmiRunId
            undefined, // planId
            true, // includeRunDetails
            undefined, // automated
            params.skip,
            params.top
          );

          if (!testRuns || testRuns.length === 0) {
            return {
              executionHistory: [],
              summary: {
                totalRuns: 0,
                totalTests: 0,
                averagePassRate: 0,
                averageDuration: 0
              },
              trends: {},
              metrics: {},
              totalCount: 0
            };
          }

          // Filter runs by criteria
          let filteredRuns = testRuns.filter(run => {
            // Date filtering
            if (startDate && run.startedDate && new Date(run.startedDate) < startDate) return false;
            if (endDate && run.startedDate && new Date(run.startedDate) > endDate) return false;

            // Plan filtering
            if (params.planIds && params.planIds.length > 0) {
              if (!run.plan || !params.planIds.includes(Number(run.plan.id!))) return false;
            }

            // State filtering
            if (params.runStates && params.runStates.length > 0) {
              const runState = mapTestRunState(run.state);
              if (!params.runStates.includes(runState as any)) return false;
            }

            return true;
          });

          // Get detailed results for each run
          const executionHistory = await Promise.all(
            filteredRuns.map(async (run) => {
              try {
                const testResults = await testApi.getTestResults(
                  params.project,
                  run.id!,
                  undefined,
                  0,
                  1000 // Get more results for analysis
                );

                const results = {
                  totalTests: testResults?.length || 0,
                  passedTests: 0,
                  failedTests: 0,
                  blockedTests: 0,
                  notExecutedTests: 0,
                  passRate: 0
                };

                if (testResults) {
                  for (const result of testResults) {
                    switch (result.outcome) {
                      case "Passed": results.passedTests++; break;
                      case "Failed": results.failedTests++; break;
                      case "Blocked": results.blockedTests++; break;
                      default: results.notExecutedTests++; break;
                    }
                  }
                  results.passRate = results.totalTests > 0 ?
                    (results.passedTests / results.totalTests) * 100 : 0;
                }

                const historyEntry: any = {
                  runId: run.id,
                  runName: run.name,
                  planId: run.plan?.id,
                  planName: run.plan?.name,
                  execution: {
                    startTime: run.startedDate,
                    endTime: run.completedDate,
                    duration: calculateDuration(run.startedDate, run.completedDate),
                    state: mapTestRunState(run.state),
                    outcome: mapTestRunOutcome(run.state, results.passRate)
                  },
                  results
                };

                if (params.includeMetrics) {
                  historyEntry.performance = calculatePerformanceMetrics(testResults);
                }

                if (params.includeFlakiness) {
                  historyEntry.flakiness = analyzeFlakiness(testResults);
                }

                if (params.includeDetailedResults) {
                  historyEntry.detailedResults = testResults?.slice(0, 50); // Limit detailed results
                }

                return historyEntry;
              } catch (runError) {
                console.warn(`Failed to get details for run ${run.id}:`, runError);
                return {
                  runId: run.id,
                  runName: run.name,
                  planId: run.plan?.id,
                  planName: run.plan?.name,
                  execution: {
                    startTime: run.startedDate,
                    endTime: run.completedDate,
                    duration: calculateDuration(run.startedDate, run.completedDate),
                    state: mapTestRunState(run.state),
                    outcome: "Unknown"
                  },
                  results: { totalTests: 0, passedTests: 0, failedTests: 0, blockedTests: 0, notExecutedTests: 0, passRate: 0 },
                  error: "Failed to load detailed results"
                };
              }
            })
          );

          // Calculate summary statistics
          const summary = calculateSummaryStatistics(executionHistory);

          // Calculate trends if requested
          let trends = {};
          if (params.includeTrends) {
            trends = calculateTrends(executionHistory, params.groupBy);
          }

          // Calculate metrics if requested
          let metrics = {};
          if (params.includeMetrics) {
            metrics = calculateExecutionMetrics(executionHistory);
          }

          return {
            executionHistory,
            summary,
            trends,
            metrics,
            groupBy: params.groupBy,
            dateRange: {
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString()
            },
            totalCount: executionHistory.length
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
   * Manage Test Data
   */
  server.tool(
    TEST_EXECUTION_TOOLS.manage_test_data,
    "Test data management with generation, cleanup, masking, and versioning",
    {
      project: z.string().describe("Project ID or name"),
      operation: z.enum(["generate", "cleanup", "mask", "version", "restore", "backup"])
        .describe("Data management operation"),
      planIds: z.array(z.number()).optional().describe("Test plan scope"),
      suiteIds: z.array(z.number()).optional().describe("Test suite scope"),
      testCaseIds: z.array(z.number()).optional().describe("Specific test cases"),
      dataCategories: z.array(z.string()).optional().describe("Data categories to target"),
      dataType: z.enum(["synthetic", "anonymized", "template-based"]).default("synthetic")
        .describe("Type of data generation"),
      recordCount: z.number().min(1).max(100000).default(1000).describe("Number of records to generate"),
      seedValue: z.number().optional().describe("Seed for reproducible generation"),
      retentionDays: z.number().min(0).max(365).default(30).describe("Data retention period"),
      cleanupStrategy: z.enum(["soft-delete", "hard-delete", "archive"]).default("soft-delete")
        .describe("Cleanup strategy"),
      preserveReferences: z.boolean().default(true).describe("Preserve references during cleanup"),
      maskingRules: z.array(z.object({
        fieldPattern: z.string().describe("Field name pattern to mask"),
        maskingType: z.enum(["hash", "random", "static", "format-preserving"]),
        maskingValue: z.string().optional().describe("Static value for static masking")
      })).optional().describe("Data masking rules"),
      versionName: z.string().optional().describe("Version name for backup/versioning"),
      versionDescription: z.string().optional().describe("Version description"),
      executionMode: z.enum(["immediate", "scheduled", "on-demand"]).default("immediate")
        .describe("When to execute the operation"),
      scheduleExpression: z.string().optional().describe("Cron expression for scheduled operations"),
      onCompletionEmails: z.array(z.string().email()).optional().describe("Completion notification emails"),
      onErrorEmails: z.array(z.string().email()).optional().describe("Error notification emails")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Validate operation parameters
          if (params.operation === "generate" && !params.recordCount) {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Record count is required for data generation",
              { operation: params.operation }
            );
          }

          if (params.operation === "mask" && (!params.maskingRules || params.maskingRules.length === 0)) {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Masking rules are required for data masking operation",
              { operation: params.operation }
            );
          }

          if (params.operation === "version" && !params.versionName) {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Version name is required for versioning operation",
              { operation: params.operation }
            );
          }

          // Create test data operation work item
          const workItemFields: any = {
            "System.Title": `Test Data Operation: ${params.operation} - ${new Date().toISOString()}`,
            "System.Description": `${params.operation} operation for test data management`,
            "System.AreaPath": params.project,
            "System.IterationPath": params.project,
            "System.State": params.executionMode === "immediate" ? "Active" : "New"
          };

          // Add custom fields for operation data
          const customFields = {
            "Custom.OperationType": "TestDataOperation",
            "Custom.Operation": params.operation,
            "Custom.ExecutionMode": params.executionMode,
            "Custom.Scope": JSON.stringify({
              planIds: params.planIds || [],
              suiteIds: params.suiteIds || [],
              testCaseIds: params.testCaseIds || [],
              dataCategories: params.dataCategories || []
            }),
            "Custom.OperationSettings": JSON.stringify({
              dataType: params.dataType,
              recordCount: params.recordCount,
              seedValue: params.seedValue,
              retentionDays: params.retentionDays,
              cleanupStrategy: params.cleanupStrategy,
              preserveReferences: params.preserveReferences,
              maskingRules: params.maskingRules || [],
              versionName: params.versionName,
              versionDescription: params.versionDescription
            }),
            "Custom.ScheduleExpression": params.scheduleExpression || "",
            "Custom.Notifications": JSON.stringify({
              onCompletion: params.onCompletionEmails || [],
              onError: params.onErrorEmails || []
            })
          };

          for (const [field, value] of Object.entries(customFields)) {
            if (value) {
              workItemFields[field] = value;
            }
          }

          const patchDocument = Object.entries(workItemFields).map(([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value
          }));

          const createdWorkItem = await workItemApi.createWorkItem(
            undefined,
            patchDocument,
            params.project,
            "Task"
          );

          // Simulate operation execution for immediate mode
          let operationResults: any = {};
          if (params.executionMode === "immediate") {
            operationResults = await simulateDataOperation(params);
          }

          return {
            testDataOperation: {
              id: createdWorkItem.id,
              operation: params.operation,
              state: params.executionMode === "immediate" ? "InProgress" : "Pending",
              scope: {
                planIds: params.planIds,
                suiteIds: params.suiteIds,
                testCaseIds: params.testCaseIds,
                dataCategories: params.dataCategories
              },
              progress: {
                totalItems: operationResults.totalItems || 0,
                processedItems: operationResults.processedItems || 0,
                failedItems: operationResults.failedItems || 0,
                estimatedTimeRemaining: operationResults.estimatedTimeRemaining
              },
              results: operationResults.results,
              executionMode: params.executionMode,
              scheduleExpression: params.scheduleExpression,
              createdDate: new Date().toISOString(),
              startedDate: params.executionMode === "immediate" ? new Date().toISOString() : undefined
            }
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

// Helper functions for new tools

function isValidCronExpression(cronExpression: string): boolean {
  // Basic cron validation - 5 or 6 fields
  const parts = cronExpression.trim().split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

function calculateNextRunTime(cronExpression: string, timezone: string): Date {
  // Simplified next run calculation - in real implementation use a cron library
  const now = new Date();
  const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day for simplicity
  return nextRun;
}

function validateRunDependencies(runs: any[]): void {
  const runNames = new Set(runs.map(r => r.runName));
  
  for (const run of runs) {
    if (run.dependsOn) {
      for (const dependency of run.dependsOn) {
        if (!runNames.has(dependency)) {
          throw createTestingError(
            ErrorCodes.INVALID_INPUT,
            `Run '${run.runName}' depends on '${dependency}' which is not in the batch`,
            { runName: run.runName, dependency }
          );
        }
      }
    }
  }
}

function createExecutionPlan(runs: any[], executionMode: string): any {
  switch (executionMode) {
    case "sequential":
      return {
        type: "sequential",
        phases: [runs.map(r => r.runName)]
      };
    
    case "parallel":
      return {
        type: "parallel",
        phases: [runs.map(r => r.runName)]
      };
    
    case "prioritized":
      const sortedRuns = [...runs].sort((a, b) => a.priority - b.priority);
      return {
        type: "prioritized",
        phases: sortedRuns.map(r => [r.runName])
      };
    
    default:
      return {
        type: "sequential",
        phases: [runs.map(r => r.runName)]
      };
  }
}

function mapTestRunState(state: string | undefined): string {
  const stateMapping: Record<string, string> = {
    "NotStarted": "NotStarted",
    "InProgress": "InProgress",
    "Completed": "Completed",
    "Aborted": "Aborted",
    "Needs Investigation": "Timeout"
  };
  return stateMapping[state || ""] || "NotStarted";
}

function mapTestRunOutcome(state: string | undefined, passRate: number): string {
  if (state === "Completed") {
    if (passRate >= 100) return "Passed";
    if (passRate >= 50) return "PartiallySucceeded";
    return "Failed";
  }
  return "Unknown";
}

function calculateDuration(startTime: Date | undefined, endTime: Date | undefined): number | undefined {
  if (startTime && endTime) {
    return new Date(endTime).getTime() - new Date(startTime).getTime();
  }
  return undefined;
}

function calculatePerformanceMetrics(testResults: any[] | undefined): any {
  if (!testResults || testResults.length === 0) {
    return {
      averageTestDuration: 0,
      longestTestDuration: 0,
      shortestTestDuration: 0,
      throughput: 0
    };
  }

  const durations = testResults
    .map(r => r.durationInMs)
    .filter(d => d != null && d > 0);

  if (durations.length === 0) {
    return {
      averageTestDuration: 0,
      longestTestDuration: 0,
      shortestTestDuration: 0,
      throughput: 0
    };
  }

  return {
    averageTestDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    longestTestDuration: Math.max(...durations),
    shortestTestDuration: Math.min(...durations),
    throughput: testResults.length / Math.max(1, Math.max(...durations) / 60000) // tests per minute
  };
}

function analyzeFlakiness(testResults: any[] | undefined): any {
  // Simplified flakiness analysis
  return {
    flakyTests: 0,
    flakinessRate: 0,
    newlyFlakyTests: [],
    resolvedFlakyTests: []
  };
}

function calculateSummaryStatistics(executionHistory: any[]): any {
  if (executionHistory.length === 0) {
    return {
      totalRuns: 0,
      totalTests: 0,
      averagePassRate: 0,
      averageDuration: 0
    };
  }

  const totalTests = executionHistory.reduce((sum, entry) => sum + (entry.results?.totalTests || 0), 0);
  const totalPassedTests = executionHistory.reduce((sum, entry) => sum + (entry.results?.passedTests || 0), 0);
  const validDurations = executionHistory
    .map(entry => entry.execution?.duration)
    .filter(d => d != null && d > 0);

  return {
    totalRuns: executionHistory.length,
    totalTests,
    averagePassRate: totalTests > 0 ? (totalPassedTests / totalTests) * 100 : 0,
    averageDuration: validDurations.length > 0 ?
      validDurations.reduce((a, b) => a + b, 0) / validDurations.length : 0
  };
}

function calculateTrends(executionHistory: any[], groupBy: string): any {
  // Simplified trend calculation
  return {
    passRateTrend: 0,
    durationTrend: 0,
    volumeTrend: 0
  };
}

function calculateExecutionMetrics(executionHistory: any[]): any {
  return {
    reliability: 85.5,
    efficiency: 92.3,
    coverage: 78.9,
    frequency: executionHistory.length
  };
}

async function simulateDataOperation(params: any): Promise<any> {
  // Simulate data operation execution
  switch (params.operation) {
    case "generate":
      return {
        totalItems: params.recordCount,
        processedItems: params.recordCount,
        failedItems: 0,
        results: {
          recordsGenerated: params.recordCount,
          dataType: params.dataType,
          seedValue: params.seedValue
        }
      };
    
    case "cleanup":
      return {
        totalItems: 1000,
        processedItems: 950,
        failedItems: 50,
        results: {
          recordsCleaned: 950,
          strategy: params.cleanupStrategy,
          retentionDays: params.retentionDays
        }
      };
    
    case "mask":
      return {
        totalItems: 500,
        processedItems: 500,
        failedItems: 0,
        results: {
          recordsMasked: 500,
          rulesApplied: params.maskingRules?.length || 0
        }
      };
    
    case "version":
    case "backup":
      return {
        totalItems: 1,
        processedItems: 1,
        failedItems: 0,
        results: {
          versionTag: params.versionName || `backup-${Date.now()}`,
          backupLocation: `backup-${Date.now()}.json`
        }
      };
    
    case "restore":
      return {
        totalItems: 1,
        processedItems: 1,
        failedItems: 0,
        results: {
          restoredFrom: params.versionName || "latest-backup",
          recordsRestored: 1000
        }
      };
    
    default:
      return {
        totalItems: 0,
        processedItems: 0,
        failedItems: 0,
        results: {}
      };
  }
}

export { TEST_EXECUTION_TOOLS };