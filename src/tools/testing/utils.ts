// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TestingError, ErrorCodes, ToolResponse, PaginationInfo, ResponseMetadata } from "./schemas.js";

/**
 * Create a testing-specific error with proper structure
 */
export function createTestingError(
  code: ErrorCodes,
  message: string,
  details?: any,
  suggestions?: string[]
): TestingError {
  const error = new Error(message) as TestingError;
  error.code = code;
  error.details = details;
  error.suggestions = suggestions;
  return error;
}

/**
 * Parse Azure DevOps API error responses
 */
export function parseAzureDevOpsError(error: any): TestingError {
  if (error.response?.data) {
    const errorData = error.response.data;
    
    if (errorData.message) {
      return createTestingError(
        ErrorCodes.OPERATION_FAILED,
        errorData.message,
        errorData,
        errorData.typeKey ? [`Check ${errorData.typeKey} documentation`] : undefined
      );
    }
  }

  if (error.message) {
    return createTestingError(
      ErrorCodes.OPERATION_FAILED,
      error.message,
      error
    );
  }

  return createTestingError(
    ErrorCodes.OPERATION_FAILED,
    "Unknown Azure DevOps API error",
    error
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
 */
export function convertStepsToXml(steps: string): string {
  if (!steps || steps.trim() === "") {
    return "";
  }

  const stepsLines = steps.split("\n").filter((line) => line.trim() !== "");
  let xmlSteps = `<steps id="0" last="${stepsLines.length}">`;

  for (let i = 0; i < stepsLines.length; i++) {
    const stepLine = stepsLines[i].trim();
    if (stepLine) {
      // Split step and expected result by '|', fallback to default if not provided
      const [stepPart, expectedPart] = stepLine.split("|").map((s) => s.trim());
      const stepMatch = stepPart.match(/^(\d+)\.\s*(.+)$/);
      const stepText = stepMatch ? stepMatch[2] : stepPart;
      const expectedText = expectedPart || "Verify step completes successfully";

      xmlSteps += `
                <step id="${i + 1}" type="ActionStep">
                    <parameterizedString isformatted="true">${escapeXml(stepText)}</parameterizedString>
                    <parameterizedString isformatted="true">${escapeXml(expectedText)}</parameterizedString>
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