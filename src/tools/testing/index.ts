// Copyright (c) eKassir ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

// Import all testing tool modules
import { configureTestSuiteTools, TEST_SUITE_TOOLS } from "./testsuites.js";
import { configureTestCaseTools, TEST_CASE_TOOLS } from "./testcases.js";
import { configureTestExecutionTools, TEST_EXECUTION_TOOLS } from "./testexecution.js";
import { configureTestConfigurationTools, TEST_CONFIGURATION_TOOLS } from "./testconfigurations.js";
import { configureTestAnalyticsTools, TEST_ANALYTICS_TOOLS } from "./testanalytics.js";
import { configureTestReportingTools, TEST_REPORTING_TOOLS } from "./testreporting.js";

// Export all tool configurations
export { TEST_SUITE_TOOLS, TEST_CASE_TOOLS, TEST_EXECUTION_TOOLS, TEST_CONFIGURATION_TOOLS, TEST_ANALYTICS_TOOLS, TEST_REPORTING_TOOLS };

// Export schemas and utilities
export * from "./schemas.js";
export * from "./utils.js";

/**
 * Configure all testing tools for the MCP server
 *
 * This function registers all testing-related tools including:
 * - Test Suite Management (5 tools): create, update, delete, list, get details
 * - Test Case Management (3 tools): update, search, bulk operations
 * - Test Execution (7 tools): run tests, update results, get run results, schedule runs, batch execution, execution history, test data management
 * - Test Configuration Management (6 tools): create, update, list, delete, clone, validate configurations
 * - Test Analytics & Intelligence (5 tools): flaky test detection, quality metrics, performance analysis, risk assessment, team productivity
 * - Test Reporting & Visualization (4 tools): standard reports, custom reports, data export, dashboard management
 *
 * @param server - The MCP server instance
 * @param tokenProvider - Function to get Azure DevOps access token
 * @param connectionProvider - Function to get Azure DevOps API connection
 */
export function configureTestingTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  // Register test suite management tools
  configureTestSuiteTools(server, tokenProvider, connectionProvider);
  
  // Register test case management tools
  configureTestCaseTools(server, tokenProvider, connectionProvider);
  
  // Register test execution tools
  configureTestExecutionTools(server, tokenProvider, connectionProvider);
  
  // Register test configuration management tools
  configureTestConfigurationTools(server, tokenProvider, connectionProvider);
  
  // Register test analytics & intelligence tools
  configureTestAnalyticsTools(server, tokenProvider, connectionProvider);
  
  // Register test reporting & visualization tools
  configureTestReportingTools(server, tokenProvider, connectionProvider);
}

/**
 * Get a list of all testing tool names for registration tracking
 */
export function getAllTestingToolNames(): string[] {
  return [
    ...Object.values(TEST_SUITE_TOOLS),
    ...Object.values(TEST_CASE_TOOLS),
    ...Object.values(TEST_EXECUTION_TOOLS),
    ...Object.values(TEST_CONFIGURATION_TOOLS),
    ...Object.values(TEST_ANALYTICS_TOOLS),
    ...Object.values(TEST_REPORTING_TOOLS)
  ];
}

/**
 * Get testing tools organized by category
 */
export function getTestingToolsByCategory() {
  return {
    testSuites: {
      tools: TEST_SUITE_TOOLS,
      description: "Tools for managing test suites (create, update, delete, list, get details)"
    },
    testCases: {
      tools: TEST_CASE_TOOLS,
      description: "Tools for managing test cases (update, search, bulk operations)"
    },
    testExecution: {
      tools: TEST_EXECUTION_TOOLS,
      description: "Tools for test execution (run tests, update results, get results, schedule runs, batch execution, execution history, test data management)"
    },
    testConfigurations: {
      tools: TEST_CONFIGURATION_TOOLS,
      description: "Tools for managing test configurations (create, update, list, delete, clone, validate configurations)"
    },
    testAnalytics: {
      tools: TEST_ANALYTICS_TOOLS,
      description: "Tools for test analytics & intelligence (flaky test detection, quality metrics, performance analysis, risk assessment, team productivity)"
    },
    testReporting: {
      tools: TEST_REPORTING_TOOLS,
      description: "Tools for test reporting & visualization (standard reports, custom reports, data export, dashboard management)"
    }
  };
}