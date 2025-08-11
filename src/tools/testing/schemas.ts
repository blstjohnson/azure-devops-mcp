// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

// Common validation patterns
export const projectValidation = z.string()
  .min(1, "Project name/ID cannot be empty")
  .max(64, "Project name/ID too long");

export const idValidation = z.number()
  .int("ID must be an integer")
  .positive("ID must be positive");

export const nameValidation = z.string()
  .min(1, "Name cannot be empty")
  .max(256, "Name too long")
  .regex(/^[^<>"|]*$/, "Name contains invalid characters");

export const tagValidation = z.string()
  .min(1, "Tag cannot be empty")
  .max(100, "Tag too long")
  .regex(/^[a-zA-Z0-9\-_\s]+$/, "Tag contains invalid characters");

export const pathValidation = z.string()
  .regex(/^[^<>"|*?]+$/, "Path contains invalid characters");

export const priorityValidation = z.number()
  .int("Priority must be an integer")
  .min(1, "Priority must be between 1 and 4")
  .max(4, "Priority must be between 1 and 4");

// Base schemas
export const paginationSchema = z.object({
  top: z.number().min(1).max(1000).default(100).describe("Maximum number of results"),
  skip: z.number().min(0).default(0).describe("Number of results to skip"),
  continuationToken: z.string().optional().describe("Continuation token for pagination")
});

export const projectContextSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  planId: idValidation.optional().describe("Test plan ID"),
  suiteId: idValidation.optional().describe("Test suite ID")
});

export const filteringSchema = z.object({
  nameFilter: z.string().optional().describe("Filter by name (partial match)"),
  tags: z.array(tagValidation).optional().describe("Filter by tags"),
  state: z.array(z.string()).optional().describe("Filter by state"),
  createdAfter: z.coerce.date().optional().describe("Filter items created after date"),
  modifiedAfter: z.coerce.date().optional().describe("Filter items modified after date")
});

// Test Suite Schemas
export const suiteTypeEnum = z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"]);
export const suiteStateEnum = z.enum(["Active", "Inactive"]);

export const createTestSuiteSchema = projectContextSchema
  .extend({
    planId: idValidation.describe("Test plan ID to create the suite in"),
    name: nameValidation.describe("Name of the test suite"),
    suiteType: suiteTypeEnum.default("StaticTestSuite").describe("Type of test suite to create"),
    parentSuiteId: idValidation.optional().describe("Parent suite ID for nested suites"),
    description: z.string().max(4000).optional().describe("Description of the test suite"),
    
    // For Dynamic Test Suites
    queryString: z.string().optional().describe("Query string for dynamic test suites"),
    
    // For Requirement Test Suites
    requirementId: idValidation.optional().describe("Requirement work item ID"),
    
    // Configuration
    defaultConfigurations: z.array(idValidation).optional()
      .describe("Default test configuration IDs"),
    inheritDefaultConfigurations: z.boolean().default(true)
      .describe("Whether to inherit default configurations from parent"),
      
    // Additional Properties
    tags: z.array(tagValidation).optional().describe("Tags to assign to the suite"),
    areaPath: pathValidation.optional().describe("Area path for the suite"),
    iterationPath: pathValidation.optional().describe("Iteration path for the suite")
  })
  .refine((data) => {
    if (data.suiteType === "DynamicTestSuite" && !data.queryString) {
      return false;
    }
    if (data.suiteType === "RequirementTestSuite" && !data.requirementId) {
      return false;
    }
    return true;
  }, {
    message: "Suite type requirements not met: Dynamic suites need queryString, Requirement suites need requirementId"
  });

export const updateTestSuiteSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  planId: idValidation.describe("Test plan ID"),
  suiteId: idValidation.describe("Test suite ID to update"),
  name: nameValidation.optional().describe("New name for the test suite"),
  description: z.string().max(4000).optional().describe("New description"),
  
  // Parent relationship updates
  parentSuiteId: idValidation.optional().describe("New parent suite ID"),
  moveToRoot: z.boolean().default(false).describe("Move suite to root level"),
  
  // Dynamic suite updates
  queryString: z.string().optional().describe("Updated query string for dynamic suites"),
  
  // Configuration updates
  defaultConfigurations: z.array(idValidation).optional()
    .describe("Updated default configuration IDs"),
  addConfigurations: z.array(idValidation).optional()
    .describe("Configuration IDs to add"),
  removeConfigurations: z.array(idValidation).optional()
    .describe("Configuration IDs to remove"),
    
  // Property updates
  tags: z.array(tagValidation).optional().describe("Updated tags"),
  areaPath: pathValidation.optional().describe("Updated area path"),
  iterationPath: pathValidation.optional().describe("Updated iteration path"),
  state: suiteStateEnum.optional().describe("Suite state")
});

export const deleteTestSuiteSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  planId: idValidation.describe("Test plan ID"),
  suiteId: idValidation.describe("Test suite ID to delete"),
  deleteChildSuites: z.boolean().default(false)
    .describe("Whether to delete child suites"),
  preserveTestCases: z.boolean().default(true)
    .describe("Whether to preserve test cases in other suites"),
  forceDelete: z.boolean().default(false)
    .describe("Force deletion even with dependencies")
});

export const listTestSuitesSchema = z.intersection(
  z.object({
    project: projectValidation.describe("Project ID or name"),
    planId: idValidation.optional().describe("Test plan ID to filter by"),
    parentSuiteId: idValidation.optional().describe("Parent suite ID for hierarchical listing"),
    includeChildSuites: z.boolean().default(false)
      .describe("Include child suites in results"),
    
    // Filtering options
    suiteType: suiteTypeEnum.optional().describe("Filter by suite type"),
    state: z.enum(["Active", "Inactive", "All"]).default("Active")
      .describe("Filter by suite state"),
    
    // Output options
    includeDetails: z.boolean().default(false)
      .describe("Include detailed suite information"),
    includeTestCaseCount: z.boolean().default(true)
      .describe("Include test case count in results"),
    includeChildCount: z.boolean().default(true)
      .describe("Include child suite count")
  }),
  z.intersection(filteringSchema, paginationSchema)
);

export const cloneTestSuiteSchema = z.object({
  sourceProject: projectValidation.describe("Source project ID or name"),
  sourcePlanId: idValidation.describe("Source test plan ID"),
  sourceSuiteId: idValidation.describe("Source test suite ID"),
  
  targetProject: projectValidation.describe("Target project ID or name"),
  targetPlanId: idValidation.describe("Target test plan ID"),
  targetParentSuiteId: idValidation.optional().describe("Target parent suite ID"),
  
  // Clone options
  newName: nameValidation.optional().describe("New name for cloned suite"),
  cloneTestCases: z.boolean().default(true)
    .describe("Whether to clone test cases"),
  cloneChildSuites: z.boolean().default(true)
    .describe("Whether to clone child suites"),
  cloneConfigurations: z.boolean().default(true)
    .describe("Whether to clone configurations"),
  
  // Mapping options
  configurationMapping: z.record(z.number(), z.number()).optional()
    .describe("Mapping of source to target configuration IDs"),
  areaPathMapping: pathValidation.optional()
    .describe("Target area path for cloned suite"),
  iterationPathMapping: pathValidation.optional()
    .describe("Target iteration path for cloned suite"),
    
  // Advanced options
  preserveLinks: z.boolean().default(false)
    .describe("Preserve links to original work items"),
  updateReferences: z.boolean().default(true)
    .describe("Update references to target project context")
});

// Test Case Schemas
export const testCaseStateEnum = z.enum(["Design", "Ready", "Closed", "Active"]);
export const automationStatusEnum = z.enum(["Not Automated", "Planned", "Automated"]);

export const stepUpdateSchema = z.object({
  id: idValidation.optional().describe("Step ID (for existing steps)"),
  action: z.enum(["add", "update", "delete"]).describe("Action to perform"),
  stepText: z.string().optional().describe("Step action text"),
  expectedResult: z.string().optional().describe("Expected result text"),
  position: z.number().optional().describe("Step position")
});

export const attachmentUpdateSchema = z.object({
  action: z.enum(["add", "remove"]).describe("Attachment action"),
  name: z.string().describe("Attachment name"),
  content: z.string().optional().describe("Base64 encoded content for new attachments"),
  url: z.string().optional().describe("URL for existing attachments")
});

export const updateTestCaseSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  testCaseId: idValidation.describe("Test case ID to update"),
  
  // Basic properties
  title: z.string().min(1).max(512).optional().describe("Updated title"),
  description: z.string().max(4000).optional().describe("Updated description"),
  priority: priorityValidation.optional().describe("Priority (1-4)"),
  
  // Test steps
  steps: z.string().optional()
    .describe("Updated test steps (format: '1. Step|Expected result\\n2. Step|Expected')"),
  stepUpdates: z.array(stepUpdateSchema).optional().describe("Granular step updates"),
  
  // Classification
  areaPath: pathValidation.optional().describe("Updated area path"),
  iterationPath: pathValidation.optional().describe("Updated iteration path"),
  tags: z.array(tagValidation).optional().describe("Updated tags"),
  
  // Custom fields
  customFields: z.record(z.string(), z.any()).optional()
    .describe("Custom field updates"),
    
  // State management
  state: testCaseStateEnum.optional().describe("Test case state"),
  reason: z.string().optional().describe("Reason for state change"),
  
  // Automation
  automationStatus: automationStatusEnum.optional().describe("Automation status"),
  automatedTestName: z.string().optional().describe("Automated test name"),
  automatedTestStorage: z.string().optional().describe("Automated test storage"),
  automatedTestType: z.string().optional().describe("Automated test type"),
  automatedTestId: z.string().optional().describe("Automated test ID"),
  
  // Attachments
  attachments: z.array(attachmentUpdateSchema).optional().describe("Attachment updates")
});

export const searchTestCasesSchema = z.intersection(
  z.object({
    project: projectValidation.describe("Project ID or name"),
    
    // Search criteria
    searchText: z.string().optional().describe("Full-text search across title, steps, description"),
    titleFilter: z.string().optional().describe("Filter by title (supports wildcards)"),
    
    // Scope filtering
    planIds: z.array(idValidation).optional().describe("Filter by test plan IDs"),
    suiteIds: z.array(idValidation).optional().describe("Filter by test suite IDs"),
    areaPath: pathValidation.optional().describe("Filter by area path"),
    iterationPath: pathValidation.optional().describe("Filter by iteration path"),
    
    // Property filtering
    state: z.array(testCaseStateEnum).optional().describe("Filter by test case states"),
    priority: z.array(priorityValidation).optional().describe("Filter by priority levels"),
    anyTags: z.array(tagValidation).optional().describe("Filter by tags (OR operation)"),
    
    // Automation filtering
    automationStatus: z.array(automationStatusEnum).optional()
      .describe("Filter by automation status"),
    hasAutomation: z.boolean().optional().describe("Filter by presence of automation"),
    
    // Date filtering
    createdBefore: z.coerce.date().optional().describe("Created before date"),
    modifiedBefore: z.coerce.date().optional().describe("Modified before date"),
    
    // People filtering
    createdBy: z.string().optional().describe("Filter by creator"),
    assignedTo: z.string().optional().describe("Filter by assigned person"),
    
    // Advanced filtering
    customFieldFilters: z.record(z.string(), z.any()).optional()
      .describe("Custom field filters"),
    hasAttachments: z.boolean().optional().describe("Filter by attachment presence"),
    hasLinks: z.boolean().optional().describe("Filter by work item links"),
    
    // Search options
    searchInSteps: z.boolean().default(true).describe("Include steps in text search"),
    searchInComments: z.boolean().default(false).describe("Include comments in search"),
    caseSensitive: z.boolean().default(false).describe("Case-sensitive search"),
    useRegex: z.boolean().default(false).describe("Use regex for text search"),
    
    // Output options
    fields: z.array(z.string()).optional().describe("Specific fields to return"),
    includeSteps: z.boolean().default(false).describe("Include test steps in results"),
    includeAttachments: z.boolean().default(false).describe("Include attachment info"),
    includeLinks: z.boolean().default(false).describe("Include work item links"),
    
    // Sorting
    sortBy: z.enum(["id", "title", "priority", "state", "createdDate", "modifiedDate"])
      .default("id").describe("Sort field"),
    sortOrder: z.enum(["asc", "desc"]).default("asc").describe("Sort order")
  }),
  z.intersection(filteringSchema, paginationSchema)
);

// Response Types
export interface IdentityRef {
  id: string;
  displayName: string;
  uniqueName?: string;
  imageUrl?: string;
}

export interface TestStep {
  id?: number;
  stepNumber: number;
  action: string;
  expectedResult: string;
  attachments?: any[];
}

export interface TestConfiguration {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  state: "Active" | "Inactive";
  variables: any[];
}

export interface TestSuite {
  id: number;
  name: string;
  suiteType: "StaticTestSuite" | "DynamicTestSuite" | "RequirementTestSuite";
  state: "Active" | "Inactive";
  plan: { id: number; name: string };
  parentSuite?: { id: number; name: string };
  
  // Metadata
  description?: string;
  areaPath?: string;
  iterationPath?: string;
  tags?: string[];
  
  // Counts
  testCaseCount?: number;
  childSuiteCount?: number;
  
  // Configurations
  defaultConfigurations?: TestConfiguration[];
  inheritDefaultConfigurations?: boolean;
  
  // Type-specific properties
  queryString?: string; // For dynamic suites
  requirementId?: number; // For requirement suites
  
  // Audit information
  createdBy?: IdentityRef;
  createdDate?: Date;
  lastModifiedBy?: IdentityRef;
  lastModifiedDate?: Date;
}

export interface TestCase {
  id: number;
  title: string;
  state: "Design" | "Ready" | "Closed" | "Active";
  priority: 1 | 2 | 3 | 4;
  
  // Content
  description?: string;
  steps?: TestStep[];
  
  // Classification
  areaPath: string;
  iterationPath: string;
  tags?: string[];
  
  // Automation
  automationStatus: "Not Automated" | "Planned" | "Automated";
  automatedTestName?: string;
  automatedTestStorage?: string;
  automatedTestType?: string;
  automatedTestId?: string;
  
  // Audit information
  createdBy: IdentityRef;
  createdDate: Date;
  lastModifiedBy: IdentityRef;
  lastModifiedDate: Date;
  revision: number;
}

export interface OperationResult {
  success: boolean;
  id?: number;
  message?: string;
  errors?: string[];
  warnings?: string[];
}

export interface PaginationInfo {
  continuationToken?: string;
  hasMore: boolean;
  totalCount?: number;
  pageSize: number;
  currentPage: number;
}

export interface ResponseMetadata {
  totalCount?: number;
  processedCount?: number;
  errorCount?: number;
  warningCount?: number;
  executionTime?: number;
  apiVersion?: string;
  warnings?: string[];
}

export interface ToolResponse<T = any> {
  content: [{ type: "text", text: string }];
  data?: T;
  pagination?: PaginationInfo;
  metadata?: ResponseMetadata;
}

// Error Types
export enum ErrorCodes {
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCESS_DENIED = "ACCESS_DENIED",
  OPERATION_FAILED = "OPERATION_FAILED",
  CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",
  DEPENDENCY_VIOLATION = "DEPENDENCY_VIOLATION",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
}

export interface TestingError extends Error {
  code: ErrorCodes;
  details?: any;
  suggestions?: string[];
}