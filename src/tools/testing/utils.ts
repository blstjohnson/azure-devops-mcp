// Copyright (c) eKassir ltd.
// Licensed under the MIT License.

import { TestingError, ErrorCodes, ToolResponse, PaginationInfo, ResponseMetadata } from "./schemas.js";

/**
 * Create a testing-specific error with proper structure
 */
/**
 * Custom testing error class that properly implements TestingError interface
 */
class CustomTestingError extends Error implements TestingError {
  code: ErrorCodes;
  details?: any;
  suggestions?: string[];

  constructor(code: ErrorCodes, message: string, details?: any, suggestions?: string[]) {
    // Ensure message is always a safe string for Error constructor
    const safeMessage = message != null ? String(message) : 'Unknown error';
    super(safeMessage);
    this.name = 'TestingError';
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
    
    Object.setPrototypeOf(this, CustomTestingError.prototype);
  }
}

export function createTestingError(
  code: ErrorCodes,
  message: string,
  details?: any,
  suggestions?: string[]
): TestingError {
  return new CustomTestingError(code, message, details, suggestions);
}

/**
 * Parse Azure DevOps API error responses
 */
export function parseAzureDevOpsError(error: any): TestingError {
  // Ensure error is an object
  if (!error) {
    return createTestingError(
      ErrorCodes.OPERATION_FAILED,
      "Unknown error occurred",
      {},
      []
    );
  }

  // Handle string errors
  if (typeof error === 'string') {
    return createTestingError(
      ErrorCodes.OPERATION_FAILED,
      error,
      {},
      []
    );
  }

  // Handle response data errors
  if (error.response?.data) {
    const errorData = error.response.data;
    
    if (errorData.message) {
      return createTestingError(
        ErrorCodes.OPERATION_FAILED,
        String(errorData.message || "API error"),
        errorData,
        errorData.typeKey ? [`Check ${errorData.typeKey} documentation`] : []
      );
    }
  }

  // Handle error message properly with null checks
  let message = "Unknown Azure DevOps API error";
  let details = {};
  let suggestions: string[] = [];
  
  if (error && typeof error === 'object') {
    if (error.message && typeof error.message === 'string') {
      message = error.message;
    } else if (error.message) {
      // Convert non-string message to string
      message = String(error.message);
    }
    details = error;
  }

  return createTestingError(
    ErrorCodes.OPERATION_FAILED,
    message,
    details,
    suggestions
  );
}

/**
 * Measure execution time of async operations
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>
): Promise<{ result: T; executionTime: number }> {
  const startTime = Date.now();
  const result = await operation();
  const executionTime = Date.now() - startTime;

  return { result, executionTime };
}

/**
 * Validate that a suite hierarchy doesn't create circular dependencies
 */
export function validateNoCircularDependency(suiteId: number, parentSuiteId: number, existingHierarchy: Map<number, number>): boolean {
  if (suiteId === parentSuiteId) {
    return false;
  }

  let currentParent = parentSuiteId;
  const visited = new Set<number>();

  while (currentParent && !visited.has(currentParent)) {
    if (currentParent === suiteId) {
      return false; // Circular dependency detected
    }
    visited.add(currentParent);
    currentParent = existingHierarchy.get(currentParent) || 0;
  }

  return true;
}

/**
 * Create a standardized tool response with consistent formatting
 */
export function createToolResponse<T>(
  data: T,
  options: {
    pagination?: PaginationInfo;
    metadata?: Partial<ResponseMetadata>;
    message?: string;
  } = {}
): ToolResponse<T> {
  const { pagination, metadata, message } = options;
  
  const response: ToolResponse<T> = {
    content: [{
      type: "text",
      text: message || JSON.stringify(data, null, 2)
    }],
    data,
    pagination,
    metadata: {
      executionTime: Date.now(),
      apiVersion: "7.0",
      ...metadata
    }
  };

  return response;
}

/**
 * Convert test steps string to XML format required by Azure DevOps
 * This function ensures Azure DevOps Web UI compatibility by:
 * - Always including required isformatted="true" attributes
 * - Enforcing consistent structure with exactly 2 parameterizedString elements per step
 * - Properly escaping XML special characters
 * - Handling missing expected results gracefully
 */
export function convertStepsToXml(steps: string): string {
  if (!steps || steps.trim() === "") {
    return "";
  }

  const stepsLines = steps.split("\n").filter((line) => line.trim() !== "");
  
  if (stepsLines.length === 0) {
    return "";
  }

  let xmlSteps = `<steps id="0" last="${stepsLines.length}">`;

  for (let i = 0; i < stepsLines.length; i++) {
    const stepLine = stepsLines[i].trim();
    if (stepLine) {
      // Split step and expected result by '|', fallback to default if not provided
      const [stepPart, expectedPart] = stepLine.split("|").map((s) => s.trim());
      const stepMatch = stepPart.match(/^(\d+)\.\s*(.+)$/);
      
      let stepText;
      if (stepMatch) {
        // We have a numbered step with content
        stepText = stepMatch[2];
      } else {
        // Check if it's just a number with dot but no content
        const numberOnlyMatch = stepPart.match(/^(\d+)\.\s*$/);
        if (numberOnlyMatch) {
          stepText = ""; // Empty step text, will use fallback
        } else {
          stepText = stepPart; // Use the whole stepPart as step text
        }
      }
      
      const expectedText = expectedPart || "Verify step completes successfully";

      // Ensure both step text and expected result are present and non-empty
      // Handle case where stepText is empty or just whitespace after number parsing
      const finalStepText = (stepText && stepText.trim()) ? stepText.trim() : `Step ${i + 1}`;
      const finalExpectedText = expectedText || "Verify step completes successfully";

      xmlSteps += `
                <step id="${i + 1}" type="ActionStep">
                    <parameterizedString isformatted="true">${escapeXml(finalStepText)}</parameterizedString>
                    <parameterizedString isformatted="true">${escapeXml(finalExpectedText)}</parameterizedString>
                </step>`;
    }
  }

  xmlSteps += "</steps>";
  return xmlSteps;
}

/**
 * Escape XML special characters
 */
export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Validate test step format
 */
export function validateTestStepFormat(steps: string): boolean {
  if (!steps || steps.trim() === "") {
    return true; // Empty steps are valid
  }

  const stepPattern = /^\d+\.\s+.+(\|.+)?$/;
  return steps.split('\n').every(step => 
    step.trim() === '' || stepPattern.test(step.trim())
  );
}

/**
 * Parse and validate test steps from string input
 */
export function parseTestSteps(stepsInput: string): { stepText: string; expectedResult: string }[] {
  if (!stepsInput || stepsInput.trim() === "") {
    return [];
  }

  const stepsLines = stepsInput.split("\n").filter(line => line.trim() !== "");
  const steps: { stepText: string; expectedResult: string }[] = [];

  for (const stepLine of stepsLines) {
    const [stepPart, expectedPart] = stepLine.split("|").map(s => s.trim());
    const stepMatch = stepPart.match(/^(\d+)\.\s*(.+)$/);
    const stepText = stepMatch ? stepMatch[2] : stepPart;
    const expectedResult = expectedPart || "Verify step completes successfully";

    steps.push({
      stepText,
      expectedResult
    });
  }

  return steps;
}

/**
 * Format work item patch document for Azure DevOps API
 */
export function createWorkItemPatchDocument(updates: Record<string, any>): any[] {
  const patchDocument: any[] = [];

  for (const [fieldPath, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      patchDocument.push({
        op: "add",
        path: fieldPath.startsWith("/fields/") ? fieldPath : `/fields/${fieldPath}`,
        value: value
      });
    }
  }

  return patchDocument;
}

/**
 * Build query parameters for Azure DevOps REST API calls
 */
export function buildQueryParams(params: Record<string, any>): string {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        queryParams.append(key, value.join(","));
      } else {
        queryParams.append(key, value.toString());
      }
    }
  }

  return queryParams.toString();
}

/**
 * Handle batch operations with proper error handling and progress tracking
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    continueOnError?: boolean;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{
  results: R[];
  errors: Error[];
  successCount: number;
  totalCount: number;
}> {
  const { batchSize = 10, continueOnError = true, onProgress } = options;
  const results: R[] = [];
  const errors: Error[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await processor(item);
        completed++;
        onProgress?.(completed, items.length);
        return { success: true, result };
      } catch (error) {
        completed++;
        onProgress?.(completed, items.length);
        if (continueOnError) {
          errors.push(error as Error);
          return { success: false, error: error as Error };
        } else {
          throw error;
        }
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    for (const batchResult of batchResults) {
      if (batchResult.success && batchResult.result !== undefined) {
        results.push(batchResult.result);
      }
    }
  }

  return {
    results,
    errors,
    successCount: results.length,
    totalCount: items.length
  };
}

/**
 * Validate Azure DevOps work item field name
 */
export function validateFieldName(fieldName: string): boolean {
  // Azure DevOps field names follow specific patterns
  const validPatterns = [
    /^System\./,           // System fields
    /^Microsoft\.VSTS\./,  // Microsoft VSTS fields
    /^Custom\./,           // Custom fields
    /^[A-Za-z][A-Za-z0-9_.]*$/ // General field pattern
  ];

  return validPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Create a safe field name for Azure DevOps
 */
export function createSafeFieldName(baseName: string, prefix = "Custom"): string {
  // Remove invalid characters and ensure proper format
  const safeName = baseName
    .replace(/[^A-Za-z0-9_.]/g, "")
    .replace(/^[^A-Za-z]+/, "")
    .substring(0, 128); // Azure DevOps field name limit

  return `${prefix}.${safeName}`;
}

/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Validate and normalize tag names
 */
export function normalizeTags(tags: string[]): string[] {
  return tags
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .filter(tag => /^[a-zA-Z0-9\-_\s]+$/.test(tag))
    .map(tag => tag.substring(0, 100)); // Limit tag length
}

/**
 * Generate a unique operation ID for tracking
 */
export function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate project name or ID format
 */
export function validateProjectIdentifier(project: string): boolean {
  if (!project || project.trim().length === 0) {
    return false;
  }

  // Check if it's a GUID (project ID)
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (guidPattern.test(project)) {
    return true;
  }

  // Check if it's a valid project name
  const namePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-_.]*[a-zA-Z0-9])?$/;
  return namePattern.test(project) && project.length <= 64;
}

/**
 * Create pagination info from Azure DevOps response
 */
export function createPaginationInfo(
  currentResults: any[],
  requestedTop: number,
  skip: number = 0,
  continuationToken?: string
): PaginationInfo {
  const hasMore = currentResults.length === requestedTop;
  const currentPage = Math.floor(skip / requestedTop) + 1;

  return {
    continuationToken: hasMore ? continuationToken : undefined,
    hasMore,
    totalCount: undefined, // Azure DevOps doesn't always provide total count
    pageSize: requestedTop,
    currentPage
  };
}

/**
 * Safe JSON stringify with proper error handling
 */
export function safeStringify(obj: any, space?: number): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      return value;
    }, space);
  } catch (error) {
    return `[Error stringifying object: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

/**
 * Configuration-specific utilities for test configuration management
 */
  
  /**
   * Validate configuration variable name format
   */
  export function validateConfigurationVariableName(name: string): boolean {
    if (!name || name.trim().length === 0) {
      return false;
    }
    // Must start with letter, contain only letters, numbers, and underscores
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
  }
  
  /**
   * Encrypt configuration value (simplified implementation)
   */
  export function encryptConfigurationValue(value: string): string {
    // In a real implementation, this would use proper encryption
    return `encrypted:${Buffer.from(value).toString('base64')}`;
  }
  
  /**
   * Decrypt configuration value (simplified implementation)
   */
  export function decryptConfigurationValue(encryptedValue: string): string {
    if (encryptedValue.startsWith('encrypted:')) {
      return Buffer.from(encryptedValue.substring(10), 'base64').toString();
    }
    return encryptedValue;
  }
  
  /**
   * Validate environment type
   */
  export function validateEnvironmentType(environment: string): boolean {
    const validEnvironments = ["Development", "Test", "Staging", "Production", "Integration", "QA"];
    return validEnvironments.includes(environment);
  }
  
  /**
   * Create configuration backup object
   */
  export function createConfigurationBackup(configuration: any): any {
    return {
      configuration: { ...configuration },
      backupDate: new Date().toISOString(),
      backupVersion: "1.0",
      backupSource: "Azure DevOps MCP Server"
    };
  }
  
  /**
   * Validate cron expression format
   */
  export function validateCronExpression(cronExpression: string): boolean {
    if (!cronExpression || cronExpression.trim().length === 0) {
      return false;
    }
    
    // Basic cron validation - 5 or 6 fields
    const parts = cronExpression.trim().split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }
  
  /**
   * Calculate execution time estimate based on historical data
   */
  export function estimateExecutionTime(
    testCount: number,
    averageTestDuration: number = 30000, // 30 seconds default
    parallelism: number = 1
  ): number {
    const totalTime = (testCount * averageTestDuration) / parallelism;
    // Add 20% buffer for overhead
    return Math.ceil(totalTime * 1.2);
  }
  
  /**
   * Parse test execution schedule from cron expression
   */
  export function parseScheduleDescription(cronExpression: string): string {
    // Simplified schedule description parser
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length < 5) {
      return "Invalid schedule format";
    }
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Handle common patterns
    if (cronExpression === "0 2 * * 1-5") {
      return "Daily at 2:00 AM, Monday through Friday";
    }
    
    if (cronExpression === "0 0 * * 0") {
      return "Weekly on Sunday at midnight";
    }
    
    if (cronExpression === "0 0 1 * *") {
      return "Monthly on the 1st at midnight";
    }
    
    return `Custom schedule: ${cronExpression}`;
  }
  
  /**
   * Validate test data operation parameters
   */
  export function validateTestDataOperation(operation: string, params: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    switch (operation) {
      case "generate":
        if (!params.recordCount || params.recordCount < 1) {
          errors.push("Record count must be at least 1 for generation");
        }
        if (params.recordCount > 100000) {
          errors.push("Record count cannot exceed 100,000 for generation");
        }
        break;
        
      case "cleanup":
        if (params.retentionDays < 0) {
          errors.push("Retention days cannot be negative");
        }
        break;
        
      case "mask":
        if (!params.maskingRules || params.maskingRules.length === 0) {
          errors.push("Masking rules are required for masking operation");
        }
        break;
        
      case "version":
      case "backup":
        if (!params.versionName || params.versionName.trim().length === 0) {
          errors.push("Version name is required for versioning/backup operations");
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calculate test execution statistics
   */
  export function calculateExecutionStatistics(results: any[]): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
    averageDuration: number;
  } {
    if (!results || results.length === 0) {
      return {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        passRate: 0,
        averageDuration: 0
      };
    }
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.outcome === "Passed").length;
    const failedTests = results.filter(r => r.outcome === "Failed").length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    const validDurations = results
      .map(r => r.durationInMs)
      .filter(d => d != null && d > 0);
    
    const averageDuration = validDurations.length > 0 ?
      validDurations.reduce((a, b) => a + b, 0) / validDurations.length : 0;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      passRate,
      averageDuration
    };
  }
  
  /**
   * Format execution duration for display
   */
  export function formatExecutionDuration(durationMs: number): string {
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    }
    
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  /**
   * Generate unique test run identifier
   */
  export function generateTestRunId(prefix: string = "run"): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  /**
   * Validate batch execution dependencies
   */
  export function validateBatchDependencies(runs: any[]): { valid: boolean; errors: string[]; dependencyOrder: string[] } {
    const errors: string[] = [];
    const runNames = new Set(runs.map(r => r.runName));
    const dependencyGraph = new Map<string, string[]>();
    
    // Build dependency graph
    for (const run of runs) {
      dependencyGraph.set(run.runName, run.dependsOn || []);
      
      // Validate dependencies exist
      if (run.dependsOn) {
        for (const dependency of run.dependsOn) {
          if (!runNames.has(dependency)) {
            errors.push(`Run '${run.runName}' depends on '${dependency}' which is not in the batch`);
          }
        }
      }
    }
    
    // Check for circular dependencies using topological sort
    const dependencyOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    function visit(runName: string): boolean {
      if (visiting.has(runName)) {
        errors.push(`Circular dependency detected involving '${runName}'`);
        return false;
      }
      
      if (visited.has(runName)) {
        return true;
      }
      
      visiting.add(runName);
      
      const dependencies = dependencyGraph.get(runName) || [];
      for (const dependency of dependencies) {
        if (!visit(dependency)) {
          return false;
        }
      }
      
      visiting.delete(runName);
      visited.add(runName);
      dependencyOrder.unshift(runName); // Add to front for correct order
      
      return true;
    }
    
    // Visit all runs
    for (const runName of runNames) {
      if (!visited.has(runName)) {
        if (!visit(runName)) {
          break;
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      dependencyOrder
    };
  }

/**
 * Analytics and Reporting Utilities
 */

/**
 * Calculate flakiness score for a test case based on execution history
 */
export function calculateFlakinessScore(
  executions: Array<{ outcome: string; date: Date }>,
  confidenceLevel: number = 0.85
): {
  score: number;
  confidence: number;
  isFlaky: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
} {
  if (executions.length < 3) {
    return {
      score: 0,
      confidence: 0,
      isFlaky: false,
      trend: 'stable'
    };
  }

  const totalExecutions = executions.length;
  const failures = executions.filter(e => e.outcome === 'Failed').length;
  const failureRate = failures / totalExecutions;

  // Calculate confidence using binomial confidence interval
  const z = confidenceLevel === 0.85 ? 1.44 : 1.96; // Z-score for 85% or 95%
  const marginOfError = z * Math.sqrt((failureRate * (1 - failureRate)) / totalExecutions);
  const confidence = Math.max(0, 1 - (2 * marginOfError));

  // Calculate trend over time (recent vs older executions)
  const midPoint = Math.floor(totalExecutions / 2);
  const recentExecutions = executions.slice(midPoint);
  const olderExecutions = executions.slice(0, midPoint);
  
  const recentFailureRate = recentExecutions.filter(e => e.outcome === 'Failed').length / recentExecutions.length;
  const olderFailureRate = olderExecutions.filter(e => e.outcome === 'Failed').length / olderExecutions.length;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  const trendThreshold = 0.1;
  if (recentFailureRate - olderFailureRate > trendThreshold) {
    trend = 'increasing';
  } else if (olderFailureRate - recentFailureRate > trendThreshold) {
    trend = 'decreasing';
  }

  const score = failureRate;
  const isFlaky = score > 0.1 && score < 0.9 && confidence > confidenceLevel;

  return {
    score,
    confidence,
    isFlaky,
    trend
  };
}

/**
 * Calculate quality metrics for a test suite
 */
export function calculateQualityMetrics(
  testResults: Array<{
    testId: number;
    outcome: string;
    duration: number;
    isAutomated: boolean;
    defectsFound: number;
  }>,
  testCoverage?: number
): {
  passRate: number;
  automationRate: number;
  testEfficiency: number;
  defectDensity: number;
  testCoverage?: number;
} {
  if (testResults.length === 0) {
    return {
      passRate: 0,
      automationRate: 0,
      testEfficiency: 0,
      defectDensity: 0,
      testCoverage
    };
  }

  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.outcome === 'Passed').length;
  const automatedTests = testResults.filter(t => t.isAutomated).length;
  const totalDefects = testResults.reduce((sum, t) => sum + t.defectsFound, 0);
  const totalDuration = testResults.reduce((sum, t) => sum + t.duration, 0);
  const averageDuration = totalDuration / totalTests;

  return {
    passRate: (passedTests / totalTests) * 100,
    automationRate: (automatedTests / totalTests) * 100,
    testEfficiency: totalDefects > 0 ? (totalDefects / (totalDuration / 1000 / 60)) : 0, // defects per minute
    defectDensity: totalDefects / totalTests,
    testCoverage
  };
}

/**
 * Analyze performance trends and detect regressions
 */
export function analyzePerformanceTrends(
  performanceData: Array<{
    date: Date;
    executionTime: number;
    throughput: number;
    resourceUsage?: number;
  }>,
  regressionSensitivity: number = 0.1
): {
  trends: {
    executionTimeTrend: number;
    throughputTrend: number;
    resourceUsageTrend?: number;
  };
  regressions: Array<{
    date: Date;
    metric: string;
    change: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
} {
  if (performanceData.length < 2) {
    return {
      trends: { executionTimeTrend: 0, throughputTrend: 0 },
      regressions: [],
      recommendations: []
    };
  }

  // Sort by date
  const sortedData = performanceData.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Calculate trends using linear regression
  const executionTimeTrend = calculateTrend(sortedData.map(d => d.executionTime));
  const throughputTrend = calculateTrend(sortedData.map(d => d.throughput));
  const resourceUsageTrend = sortedData[0].resourceUsage !== undefined
    ? calculateTrend(sortedData.map(d => d.resourceUsage!).filter(r => r !== undefined))
    : undefined;

  // Detect regressions
  const regressions: Array<{
    date: Date;
    metric: string;
    change: number;
    severity: 'low' | 'medium' | 'high';
  }> = [];

  for (let i = 1; i < sortedData.length; i++) {
    const prev = sortedData[i - 1];
    const curr = sortedData[i];

    // Check execution time regression
    const executionTimeChange = (curr.executionTime - prev.executionTime) / prev.executionTime;
    if (executionTimeChange > regressionSensitivity) {
      regressions.push({
        date: curr.date,
        metric: 'executionTime',
        change: executionTimeChange,
        severity: executionTimeChange > 0.3 ? 'high' : executionTimeChange > 0.15 ? 'medium' : 'low'
      });
    }

    // Check throughput regression
    const throughputChange = (prev.throughput - curr.throughput) / prev.throughput;
    if (throughputChange > regressionSensitivity) {
      regressions.push({
        date: curr.date,
        metric: 'throughput',
        change: throughputChange,
        severity: throughputChange > 0.3 ? 'high' : throughputChange > 0.15 ? 'medium' : 'low'
      });
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (executionTimeTrend > 0.1) {
    recommendations.push("Execution times are trending upward. Consider optimizing test logic or reviewing test environment performance.");
  }
  if (throughputTrend < -0.1) {
    recommendations.push("Test throughput is declining. Review test parallelization and resource allocation.");
  }
  if (regressions.filter(r => r.severity === 'high').length > 0) {
    recommendations.push("High-severity performance regressions detected. Immediate investigation recommended.");
  }

  return {
    trends: {
      executionTimeTrend,
      throughputTrend,
      resourceUsageTrend
    },
    regressions,
    recommendations
  };
}

/**
 * Calculate linear trend using least squares method
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
}

/**
 * Assess risk factors for test execution
 */
export function assessRiskFactors(
  testData: {
    testCoverage: number;
    codeComplexity: number;
    changeFrequency: number;
    defectHistory: number;
    teamExperience: number;
    dependencies: number;
  },
  riskThresholds: {
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
  } = { lowThreshold: 0.2, mediumThreshold: 0.5, highThreshold: 0.8 }
): {
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    factor: string;
    score: number;
    weight: number;
    contribution: number;
  }>;
  recommendations: string[];
} {
  // Define weights for each risk factor
  const weights = {
    testCoverage: 0.25,      // Higher coverage = lower risk
    codeComplexity: 0.20,    // Higher complexity = higher risk
    changeFrequency: 0.15,   // Higher frequency = higher risk
    defectHistory: 0.20,     // More defects = higher risk
    teamExperience: 0.10,    // More experience = lower risk
    dependencies: 0.10       // More dependencies = higher risk
  };

  // Normalize scores (0-1, where 1 is highest risk)
  const normalizedScores = {
    testCoverage: 1 - Math.min(testData.testCoverage / 100, 1), // Invert for risk
    codeComplexity: Math.min(testData.codeComplexity / 100, 1),
    changeFrequency: Math.min(testData.changeFrequency / 100, 1),
    defectHistory: Math.min(testData.defectHistory / 100, 1),
    teamExperience: 1 - Math.min(testData.teamExperience / 100, 1), // Invert for risk
    dependencies: Math.min(testData.dependencies / 100, 1)
  };

  // Calculate weighted risk score
  const riskFactors = Object.entries(normalizedScores).map(([factor, score]) => ({
    factor,
    score,
    weight: weights[factor as keyof typeof weights],
    contribution: score * weights[factor as keyof typeof weights]
  }));

  const overallRiskScore = riskFactors.reduce((sum, rf) => sum + rf.contribution, 0);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallRiskScore <= riskThresholds.lowThreshold) {
    riskLevel = 'low';
  } else if (overallRiskScore <= riskThresholds.mediumThreshold) {
    riskLevel = 'medium';
  } else if (overallRiskScore <= riskThresholds.highThreshold) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (normalizedScores.testCoverage > 0.6) {
    recommendations.push("Increase test coverage to reduce risk of undetected issues.");
  }
  if (normalizedScores.codeComplexity > 0.7) {
    recommendations.push("Consider refactoring complex code areas and adding focused tests.");
  }
  if (normalizedScores.defectHistory > 0.5) {
    recommendations.push("Focus additional testing on areas with high defect history.");
  }
  if (normalizedScores.teamExperience > 0.6) {
    recommendations.push("Consider additional training or mentoring for the team.");
  }

  return {
    overallRiskScore,
    riskLevel,
    riskFactors,
    recommendations
  };
}

/**
 * Calculate team productivity metrics
 */
export function calculateTeamProductivity(
  teamData: {
    testsCreated: number;
    testsExecuted: number;
    defectsFound: number;
    automationContributions: number;
    codeReviewParticipation: number;
    timeSpent: number; // in hours
  },
  benchmarkData?: {
    testsCreatedPerHour: number;
    defectsFoundPerHour: number;
    automationRate: number;
  }
): {
  testCreationRate: number;
  executionEfficiency: number;
  defectDetectionRate: number;
  automationProgress: number;
  velocity: number;
  benchmarkComparison?: {
    testCreationVsBenchmark: number;
    defectDetectionVsBenchmark: number;
    automationVsBenchmark: number;
  };
} {
  const timeSpentHours = teamData.timeSpent;

  const metrics = {
    testCreationRate: timeSpentHours > 0 ? teamData.testsCreated / timeSpentHours : 0,
    executionEfficiency: teamData.testsCreated > 0 ? teamData.testsExecuted / teamData.testsCreated : 0,
    defectDetectionRate: timeSpentHours > 0 ? teamData.defectsFound / timeSpentHours : 0,
    automationProgress: teamData.testsCreated > 0 ? teamData.automationContributions / teamData.testsCreated : 0,
    velocity: timeSpentHours > 0 ? (teamData.testsCreated + teamData.testsExecuted + teamData.defectsFound) / timeSpentHours : 0
  };

  let benchmarkComparison;
  if (benchmarkData) {
    benchmarkComparison = {
      testCreationVsBenchmark: benchmarkData.testsCreatedPerHour > 0 ?
        (metrics.testCreationRate / benchmarkData.testsCreatedPerHour) * 100 : 0,
      defectDetectionVsBenchmark: benchmarkData.defectsFoundPerHour > 0 ?
        (metrics.defectDetectionRate / benchmarkData.defectsFoundPerHour) * 100 : 0,
      automationVsBenchmark: benchmarkData.automationRate > 0 ?
        (metrics.automationProgress / benchmarkData.automationRate) * 100 : 0
    };
  }

  return {
    ...metrics,
    benchmarkComparison
  };
}

/**
 * Generate report data in specified format
 */
export function formatReportData(
  data: any,
  format: 'pdf' | 'excel' | 'html' | 'json' | 'csv'
): {
  formattedData: any;
  mimeType: string;
  fileExtension: string;
} {
  switch (format) {
    case 'json':
      return {
        formattedData: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
        fileExtension: '.json'
      };
    
    case 'csv':
      return {
        formattedData: convertToCSV(data),
        mimeType: 'text/csv',
        fileExtension: '.csv'
      };
    
    case 'html':
      return {
        formattedData: convertToHTML(data),
        mimeType: 'text/html',
        fileExtension: '.html'
      };
    
    case 'excel':
      return {
        formattedData: data, // Would need actual Excel formatting library
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileExtension: '.xlsx'
      };
    
    case 'pdf':
      return {
        formattedData: data, // Would need actual PDF generation library
        mimeType: 'application/pdf',
        fileExtension: '.pdf'
      };
    
    default:
      return {
        formattedData: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
        fileExtension: '.json'
      };
  }
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any): string {
  if (!Array.isArray(data)) {
    data = [data];
  }

  if (data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');

  // Convert rows
  const csvRows = data.map((row: any) =>
    headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Convert data to HTML table format
 */
function convertToHTML(data: any): string {
  if (!Array.isArray(data)) {
    data = [data];
  }

  if (data.length === 0) {
    return '<p>No data available</p>';
  }

  const headers = Object.keys(data[0]);
  
  const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const dataRows = data.map((row: any) =>
    `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`
  ).join('');

  return `
    <table border="1" style="border-collapse: collapse;">
      <thead>${headerRow}</thead>
      <tbody>${dataRows}</tbody>
    </table>
  `;
}

/**
 * Create dashboard widget configuration
 */
export function createDashboardWidget(
  widgetType: 'chart' | 'table' | 'metric' | 'gauge' | 'trend' | 'heatmap',
  title: string,
  dataQuery: string,
  position: { x: number; y: number; width: number; height: number },
  options: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    colors?: string[];
    refreshInterval?: number;
    thresholds?: { low: number; medium: number; high: number };
  } = {}
): any {
  const baseWidget = {
    widgetId: generateOperationId(),
    widgetType,
    title,
    position,
    dataSource: {
      query: dataQuery,
      refreshInterval: options.refreshInterval || 300,
      parameters: {}
    }
  };

  if (widgetType === 'chart') {
    return {
      ...baseWidget,
      visualization: {
        chartType: options.chartType || 'line',
        colors: options.colors || ['#0078D4', '#106EBE', '#FFB900'],
        formatting: {
          showLegend: true,
          showDataLabels: false
        }
      }
    };
  }

  if (widgetType === 'gauge' || widgetType === 'metric') {
    return {
      ...baseWidget,
      visualization: {
        thresholds: options.thresholds || { low: 30, medium: 70, high: 90 },
        colors: options.colors || ['#D13438', '#FFB900', '#107C10'],
        formatting: {
          showValue: true,
          showPercentage: widgetType === 'gauge'
        }
      }
    };
  }

  return baseWidget;
}

/**
 * Validate dashboard layout configuration
 */
export function validateDashboardLayout(
  widgets: Array<{
    position: { x: number; y: number; width: number; height: number };
  }>,
  gridSize: { columns: number; rows: number }
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for overlapping widgets
  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      const widget1 = widgets[i];
      const widget2 = widgets[j];

      if (isOverlapping(widget1.position, widget2.position)) {
        errors.push(`Widget at position (${widget1.position.x}, ${widget1.position.y}) overlaps with widget at (${widget2.position.x}, ${widget2.position.y})`);
      }
    }
  }

  // Check widgets fit within grid
  for (const widget of widgets) {
    if (widget.position.x + widget.position.width > gridSize.columns) {
      errors.push(`Widget extends beyond grid width at position (${widget.position.x}, ${widget.position.y})`);
    }
    if (widget.position.y + widget.position.height > gridSize.rows) {
      errors.push(`Widget extends beyond grid height at position (${widget.position.x}, ${widget.position.y})`);
    }
  }

  // Check for optimal layout
  const totalWidgetArea = widgets.reduce((sum, w) => sum + (w.position.width * w.position.height), 0);
  const totalGridArea = gridSize.columns * gridSize.rows;
  const utilizationRate = totalWidgetArea / totalGridArea;

  if (utilizationRate < 0.3) {
    warnings.push('Dashboard has low space utilization. Consider resizing widgets or reducing grid size.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if two rectangles overlap
 */
function isOverlapping(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    rect1.x + rect1.width <= rect2.x ||
    rect2.x + rect2.width <= rect1.x ||
    rect1.y + rect1.height <= rect2.y ||
    rect2.y + rect2.height <= rect1.y
  );
}

/**
 * Generate alert condition based on metric thresholds
 */
export function generateAlertCondition(
  metric: string,
  threshold: number,
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
): string {
  const operatorMap = {
    'gt': '>',
    'lt': '<',
    'eq': '==',
    'gte': '>=',
    'lte': '<='
  };

  return `${metric} ${operatorMap[operator]} ${threshold}`;
}

/**
 * Calculate data transformation statistics
 */
export function calculateTransformationStats(
  originalData: any[],
  transformedData: any[],
  transformations: Array<{ type: string; fieldsAffected: string[] }>
): {
  recordsProcessed: number;
  recordsFiltered: number;
  fieldsMapped: number;
  transformationsSummary: Array<{
    type: string;
    fieldsAffected: number;
    recordsAffected: number;
  }>;
} {
  const recordsProcessed = originalData.length;
  const recordsFiltered = originalData.length - transformedData.length;
  
  const allFields = new Set<string>();
  originalData.forEach(record => {
    Object.keys(record).forEach(field => allFields.add(field));
  });
  transformedData.forEach(record => {
    Object.keys(record).forEach(field => allFields.add(field));
  });

  const fieldsMapped = allFields.size;

  const transformationsSummary = transformations.map(transformation => ({
    type: transformation.type,
    fieldsAffected: transformation.fieldsAffected.length,
    recordsAffected: transformedData.filter(record =>
      transformation.fieldsAffected.some(field => record[field] !== undefined)
    ).length
  }));

  return {
    recordsProcessed,
    recordsFiltered,
    fieldsMapped,
    transformationsSummary
  };
}