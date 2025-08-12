// Copyright (c) eKassir ltd.
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
  z.intersection(filteringSchema.omit({ state: true }), paginationSchema)
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
  configurationMapping: z.record(z.string(), z.number()).optional()
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

// Test Configuration Schemas
export const environmentTypeEnum = z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"]);
export const variableTypeEnum = z.enum(["string", "number", "boolean", "json", "password", "url"]);
export const configurationStateEnum = z.enum(["Active", "Inactive", "Draft", "Archived"]);

export const configurationVariableSchema = z.object({
  name: z.string()
    .min(1, "Variable name cannot be empty")
    .max(128, "Variable name too long")
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Variable name must start with letter and contain only letters, numbers, and underscores"),
  value: z.string().describe("Variable value (encrypted for secrets)"),
  type: variableTypeEnum.default("string").describe("Variable data type"),
  isSecret: z.boolean().default(false).describe("Whether this is a secret variable"),
  description: z.string().max(500).optional().describe("Variable description"),
  defaultValue: z.string().optional().describe("Default value if not specified"),
  validation: z.object({
    required: z.boolean().default(false),
    pattern: z.string().optional().describe("Regex pattern for validation"),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    allowedValues: z.array(z.string()).optional().describe("List of allowed values")
  }).optional().describe("Validation rules for the variable")
});

export const configurationSettingsSchema = z.object({
  timeout: z.number().min(1).max(3600).default(300).describe("Default timeout in seconds"),
  retryAttempts: z.number().min(0).max(10).default(3).describe("Default retry attempts"),
  parallelExecution: z.boolean().default(false).describe("Allow parallel test execution"),
  captureScreenshots: z.boolean().default(true).describe("Capture screenshots on failure"),
  generateReports: z.boolean().default(true).describe("Generate test reports"),
  cleanupAfterRun: z.boolean().default(true).describe("Cleanup test data after run"),
  
  // Browser/Environment settings
  browserSettings: z.object({
    browser: z.enum(["chrome", "firefox", "edge", "safari"]).default("chrome"),
    headless: z.boolean().default(true),
    windowSize: z.string().default("1920x1080")
  }).optional(),
  
  // Database settings
  databaseSettings: z.object({
    connectionString: z.string().optional(),
    schema: z.string().optional(),
    isolationLevel: z.enum(["ReadCommitted", "ReadUncommitted", "RepeatableRead", "Serializable"]).optional()
  }).optional(),
  
  // API settings
  apiSettings: z.object({
    baseUrl: z.string().url().optional(),
    defaultHeaders: z.record(z.string(), z.string()).optional(),
    authentication: z.object({
      type: z.enum(["none", "basic", "bearer", "apikey", "oauth2"]).default("none"),
      credentials: z.record(z.string(), z.string()).optional()
    }).optional()
  }).optional(),
  
  // Custom settings
  customSettings: z.record(z.string(), z.any()).optional().describe("Custom configuration settings")
});

export const createTestConfigurationSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  name: nameValidation.describe("Configuration name"),
  description: z.string().max(2000).optional().describe("Configuration description"),
  environment: environmentTypeEnum.describe("Target environment type"),
  
  // Variable definitions
  variables: z.array(configurationVariableSchema).optional().describe("Configuration variables"),
  
  // Settings
  settings: configurationSettingsSchema.optional().describe("Configuration settings"),
  
  // Inheritance and templates
  parentConfigurationId: idValidation.optional().describe("Parent configuration to inherit from"),
  templateId: idValidation.optional().describe("Configuration template to use"),
  
  // Organization and tagging
  tags: z.array(tagValidation).optional().describe("Configuration tags"),
  category: z.string().max(100).optional().describe("Configuration category"),
  
  // Validation rules
  validationRules: z.object({
    validateConnectivity: z.boolean().default(true).describe("Validate network connectivity"),
    validateDependencies: z.boolean().default(true).describe("Validate required dependencies"),
    validatePermissions: z.boolean().default(false).describe("Validate required permissions"),
    customValidators: z.array(z.string()).optional().describe("Custom validation scripts")
  }).optional(),
  
  // Access control
  accessControl: z.object({
    isPublic: z.boolean().default(false).describe("Whether configuration is publicly accessible"),
    allowedProjects: z.array(projectValidation).optional().describe("Projects allowed to use this configuration"),
    allowedTeams: z.array(z.string()).optional().describe("Teams allowed to use this configuration")
  }).optional()
});

export const updateTestConfigurationSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  configurationId: idValidation.describe("Configuration ID to update"),
  name: nameValidation.optional().describe("Updated configuration name"),
  description: z.string().max(2000).optional().describe("Updated description"),
  environment: environmentTypeEnum.optional().describe("Updated environment type"),
  
  // Variable updates
  variables: z.array(configurationVariableSchema).optional().describe("Updated variables (replaces all)"),
  addVariables: z.array(configurationVariableSchema).optional().describe("Variables to add"),
  removeVariables: z.array(z.string()).optional().describe("Variable names to remove"),
  updateVariables: z.array(z.object({
    name: z.string().describe("Variable name to update"),
    updates: configurationVariableSchema.partial().describe("Variable updates")
  })).optional().describe("Specific variable updates"),
  
  // Settings updates
  settings: configurationSettingsSchema.optional().describe("Updated settings (replaces all)"),
  updateSettings: configurationSettingsSchema.partial().optional().describe("Partial settings updates"),
  
  // Tag updates
  tags: z.array(tagValidation).optional().describe("Updated tags (replaces all)"),
  addTags: z.array(tagValidation).optional().describe("Tags to add"),
  removeTags: z.array(tagValidation).optional().describe("Tags to remove"),
  
  // State management
  state: configurationStateEnum.optional().describe("Configuration state"),
  
  // Access control updates
  accessControl: z.object({
    isPublic: z.boolean().optional(),
    allowedProjects: z.array(projectValidation).optional(),
    allowedTeams: z.array(z.string()).optional()
  }).optional().describe("Updated access control settings")
});

export const listTestConfigurationsSchema = z.intersection(
  z.object({
    project: projectValidation.optional().describe("Project ID or name to filter by"),
    environment: z.array(environmentTypeEnum).optional().describe("Filter by environment types"),
    state: z.array(configurationStateEnum).optional().describe("Filter by configuration states"),
    category: z.string().optional().describe("Filter by category"),
    
    // Search and filtering
    nameFilter: z.string().optional().describe("Filter by name (partial match)"),
    tags: z.array(tagValidation).optional().describe("Filter by tags"),
    
    // Access filtering
    accessibleOnly: z.boolean().default(true).describe("Only show configurations accessible to current user"),
    includeInherited: z.boolean().default(true).describe("Include inherited configurations"),
    
    // Output options
    includeVariables: z.boolean().default(false).describe("Include variable definitions"),
    includeSettings: z.boolean().default(false).describe("Include configuration settings"),
    includeUsageStats: z.boolean().default(false).describe("Include usage statistics"),
    
    // Sorting
    sortBy: z.enum(["name", "environment", "createdDate", "modifiedDate", "usage"])
      .default("name").describe("Sort field"),
    sortOrder: z.enum(["asc", "desc"]).default("asc").describe("Sort order")
  }),
  paginationSchema
);

export const deleteTestConfigurationSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  configurationId: idValidation.describe("Configuration ID to delete"),
  forceDelete: z.boolean().default(false).describe("Force deletion even if in use"),
  createBackup: z.boolean().default(true).describe("Create backup before deletion"),
  checkDependencies: z.boolean().default(true).describe("Check for dependencies before deletion")
});

export const cloneTestConfigurationSchema = z.object({
  sourceProject: projectValidation.describe("Source project ID or name"),
  sourceConfigurationId: idValidation.describe("Source configuration ID"),
  
  targetProject: projectValidation.describe("Target project ID or name"),
  newName: nameValidation.describe("Name for cloned configuration"),
  newDescription: z.string().max(2000).optional().describe("Description for cloned configuration"),
  
  // Clone options
  cloneVariables: z.boolean().default(true).describe("Clone variable definitions"),
  cloneSettings: z.boolean().default(true).describe("Clone configuration settings"),
  cloneTags: z.boolean().default(true).describe("Clone tags"),
  cloneAccessControl: z.boolean().default(false).describe("Clone access control settings"),
  
  // Environment mapping
  targetEnvironment: environmentTypeEnum.optional().describe("Target environment type"),
  
  // Variable transformations
  variableTransformations: z.array(z.object({
    sourceVariableName: z.string().describe("Source variable name"),
    targetVariableName: z.string().describe("Target variable name"),
    newValue: z.string().optional().describe("New value for target variable")
  })).optional().describe("Variable name/value transformations"),
  
  // Cross-project considerations
  updateReferences: z.boolean().default(true).describe("Update project-specific references"),
  preserveSecrets: z.boolean().default(false).describe("Preserve secret variables (requires permissions)")
});

export const validateTestConfigurationSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  configurationId: idValidation.optional().describe("Configuration ID to validate (omit to validate definition)"),
  
  // Inline configuration for validation
  configurationDefinition: createTestConfigurationSchema.optional()
    .describe("Configuration definition to validate"),
  
  // Validation options
  validationTypes: z.array(z.enum([
    "schema", "connectivity", "dependencies", "permissions", "variables", "settings", "compatibility"
  ])).default(["schema", "connectivity", "dependencies"])
    .describe("Types of validation to perform"),
  
  // Environment-specific validation
  targetEnvironments: z.array(environmentTypeEnum).optional()
    .describe("Validate against specific environments"),
  
  // Validation settings
  strictValidation: z.boolean().default(false).describe("Use strict validation rules"),
  includeWarnings: z.boolean().default(true).describe("Include warnings in validation results"),
  validateReferences: z.boolean().default(true).describe("Validate referenced resources")
});

// Advanced Test Execution Schemas
export const scheduleTestRunSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  planId: idValidation.describe("Test plan ID"),
  
  // Schedule definition
  scheduleName: z.string().min(1).max(256).describe("Name for the scheduled run"),
  cronExpression: z.string().describe("Cron expression for scheduling (e.g., '0 2 * * 1-5')"),
  timezone: z.string().default("UTC").describe("Timezone for schedule execution"),
  
  // Run configuration
  runConfiguration: z.object({
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs to run"),
    testCaseIds: z.array(idValidation).optional().describe("Specific test case IDs"),
    configurationId: idValidation.optional().describe("Test configuration to use"),
    buildDefinitionId: idValidation.optional().describe("Build definition to trigger before run"),
    
    // Execution settings
    parallel: z.boolean().default(false).describe("Run tests in parallel"),
    maxParallelism: z.number().min(1).max(20).default(5).describe("Maximum parallel executions"),
    timeoutMinutes: z.number().min(1).max(1440).default(60).describe("Timeout in minutes"),
    
    // Retry settings
    retryPolicy: z.object({
      maxRetries: z.number().min(0).max(5).default(2),
      retryOnFailure: z.boolean().default(true),
      retryDelay: z.number().min(0).max(300).default(30).describe("Delay between retries in seconds")
    }).optional(),
    
    // Trigger conditions
    triggerConditions: z.object({
      onBuildCompletion: z.boolean().default(false),
      onlyIfBuildSuccessful: z.boolean().default(true),
      minimumChanges: z.number().default(0).describe("Minimum code changes to trigger"),
      skipIfNoChanges: z.boolean().default(false)
    }).optional()
  }),
  
  // Schedule settings
  startDate: z.coerce.date().optional().describe("Schedule start date"),
  endDate: z.coerce.date().optional().describe("Schedule end date"),
  enabled: z.boolean().default(true).describe("Whether schedule is enabled"),
  
  // Notification settings
  notifications: z.object({
    onSuccess: z.array(z.string().email()).optional().describe("Email addresses for success notifications"),
    onFailure: z.array(z.string().email()).optional().describe("Email addresses for failure notifications"),
    onTimeout: z.array(z.string().email()).optional().describe("Email addresses for timeout notifications"),
    includeReport: z.boolean().default(true).describe("Include test report in notifications")
  }).optional()
});

export const batchTestRunsSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  batchName: z.string().min(1).max(256).describe("Name for the batch execution"),
  
  // Execution runs
  runs: z.array(z.object({
    runName: z.string().describe("Name for this run"),
    planId: idValidation.describe("Test plan ID"),
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs"),
    testCaseIds: z.array(idValidation).optional().describe("Specific test case IDs"),
    configurationId: idValidation.optional().describe("Test configuration to use"),
    priority: z.number().min(1).max(10).default(5).describe("Execution priority (1=highest)"),
    dependsOn: z.array(z.string()).optional().describe("Names of runs this depends on")
  })).min(1).describe("Test runs to execute"),
  
  // Batch execution settings
  executionMode: z.enum(["sequential", "parallel", "prioritized"]).default("sequential")
    .describe("How to execute the batch"),
  maxConcurrentRuns: z.number().min(1).max(10).default(3).describe("Maximum concurrent runs"),
  continueOnFailure: z.boolean().default(true).describe("Continue batch if individual run fails"),
  
  // Resource allocation
  resourceAllocation: z.object({
    cpuLimit: z.number().min(0.1).max(4.0).optional().describe("CPU limit per run"),
    memoryLimit: z.number().min(256).max(8192).optional().describe("Memory limit in MB"),
    diskSpace: z.number().min(1).max(100).optional().describe("Disk space in GB"),
    networkBandwidth: z.number().optional().describe("Network bandwidth limit in Mbps")
  }).optional(),
  
  // Timeout and retry settings
  globalTimeout: z.number().min(1).max(1440).default(120).describe("Global timeout in minutes"),
  defaultRetryPolicy: z.object({
    maxRetries: z.number().min(0).max(5).default(1),
    retryDelay: z.number().min(0).max(300).default(60)
  }).optional()
});

export const executionHistorySchema = z.intersection(
  z.object({
    project: projectValidation.describe("Project ID or name"),
    planIds: z.array(idValidation).optional().describe("Filter by test plan IDs"),
    suiteIds: z.array(idValidation).optional().describe("Filter by test suite IDs"),
    
    // Time range filtering
    startDate: z.coerce.date().optional().describe("Execution start date filter"),
    endDate: z.coerce.date().optional().describe("Execution end date filter"),
    lastDays: z.number().min(1).max(365).optional().describe("Last N days of executions"),
    
    // Status filtering
    outcomes: z.array(z.enum(["Passed", "Failed", "Blocked", "NotExecuted", "Warning", "Error"]))
      .optional().describe("Filter by test outcomes"),
    runStates: z.array(z.enum(["NotStarted", "InProgress", "Completed", "Aborted", "Timeout"]))
      .optional().describe("Filter by run states"),
    
    // Analysis options
    includeMetrics: z.boolean().default(true).describe("Include performance metrics"),
    includeTrends: z.boolean().default(true).describe("Include trend analysis"),
    includeEnvironmentCorrelation: z.boolean().default(false)
      .describe("Include environment correlation data"),
    
    // Aggregation settings
    groupBy: z.enum(["day", "week", "month", "suite", "configuration", "environment"])
      .default("day").describe("Group results by time period or category"),
    includeFlakiness: z.boolean().default(false).describe("Include flakiness analysis"),
    
    // Output format
    includeDetailedResults: z.boolean().default(false).describe("Include detailed test results"),
    includeAttachments: z.boolean().default(false).describe("Include attachment information")
  }),
  paginationSchema
);

export const testDataManagementSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  operation: z.enum(["generate", "cleanup", "mask", "version", "restore", "backup"])
    .describe("Data management operation"),
  
  // Target specification
  scope: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan scope"),
    suiteIds: z.array(idValidation).optional().describe("Test suite scope"),
    testCaseIds: z.array(idValidation).optional().describe("Specific test cases"),
    dataCategories: z.array(z.string()).optional().describe("Data categories to target")
  }),
  
  // Operation-specific settings
  generateSettings: z.object({
    dataType: z.enum(["synthetic", "anonymized", "template-based"]).default("synthetic"),
    recordCount: z.number().min(1).max(100000).default(1000),
    seedValue: z.number().optional().describe("Seed for reproducible generation"),
    dataSchema: z.record(z.string(), z.any()).optional().describe("Data schema definition"),
    relationships: z.array(z.object({
      parentTable: z.string(),
      childTable: z.string(),
      relationship: z.enum(["one-to-one", "one-to-many", "many-to-many"])
    })).optional()
  }).optional(),
  
  cleanupSettings: z.object({
    retentionDays: z.number().min(0).max(365).default(30),
    cleanupStrategy: z.enum(["soft-delete", "hard-delete", "archive"]).default("soft-delete"),
    preserveReferences: z.boolean().default(true),
    cleanupCategories: z.array(z.string()).optional()
  }).optional(),
  
  maskingSettings: z.object({
    maskingRules: z.array(z.object({
      fieldPattern: z.string().describe("Field name pattern to mask"),
      maskingType: z.enum(["hash", "random", "static", "format-preserving"]),
      maskingValue: z.string().optional().describe("Static value for static masking")
    })),
    preserveFormat: z.boolean().default(true),
    consistentMasking: z.boolean().default(true).describe("Same input produces same masked output")
  }).optional(),
  
  versioningSettings: z.object({
    versionName: z.string().describe("Version name or tag"),
    description: z.string().optional().describe("Version description"),
    includeSchema: z.boolean().default(true),
    compression: z.boolean().default(true)
  }).optional(),
  
  // Execution settings
  executionMode: z.enum(["immediate", "scheduled", "on-demand"]).default("immediate"),
  scheduleExpression: z.string().optional().describe("Cron expression for scheduled operations"),
  notifications: z.object({
    onCompletion: z.array(z.string().email()).optional(),
    onError: z.array(z.string().email()).optional()
  }).optional()
});

// Updated Configuration Interface
export interface TestConfigurationDetailed {
  id: number;
  name: string;
  description?: string;
  environment: string;
  state: "Active" | "Inactive" | "Draft" | "Archived";
  
  // Configuration content
  variables: ConfigurationVariable[];
  settings: ConfigurationSettings;
  
  // Organization
  category?: string;
  tags?: string[];
  
  // Inheritance
  parentConfiguration?: { id: number; name: string };
  childConfigurations?: { id: number; name: string }[];
  
  // Access control
  isPublic: boolean;
  allowedProjects?: string[];
  allowedTeams?: string[];
  
  // Usage tracking
  usageCount?: number;
  lastUsed?: Date;
  
  // Validation status
  validationStatus?: {
    isValid: boolean;
    lastValidated: Date;
    errors?: string[];
    warnings?: string[];
  };
  
  // Audit information
  createdBy: IdentityRef;
  createdDate: Date;
  lastModifiedBy: IdentityRef;
  lastModifiedDate: Date;
  version: number;
}

export interface ConfigurationVariable {
  name: string;
  value: string;
  type: "string" | "number" | "boolean" | "json" | "password" | "url";
  isSecret: boolean;
  description?: string;
  defaultValue?: string;
  validation?: {
    required: boolean;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    allowedValues?: string[];
  };
}

export interface ConfigurationSettings {
  timeout: number;
  retryAttempts: number;
  parallelExecution: boolean;
  captureScreenshots: boolean;
  generateReports: boolean;
  cleanupAfterRun: boolean;
  
  browserSettings?: {
    browser: "chrome" | "firefox" | "edge" | "safari";
    headless: boolean;
    windowSize: string;
  };
  
  databaseSettings?: {
    connectionString?: string;
    schema?: string;
    isolationLevel?: "ReadCommitted" | "ReadUncommitted" | "RepeatableRead" | "Serializable";
  };
  
  apiSettings?: {
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
    authentication?: {
      type: "none" | "basic" | "bearer" | "apikey" | "oauth2";
      credentials?: Record<string, string>;
    };
  };
  
  customSettings?: Record<string, any>;
}

// Advanced Execution Interfaces
export interface ScheduledTestRun {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  
  runConfiguration: {
    planId: number;
    suiteIds?: number[];
    testCaseIds?: number[];
    configurationId?: number;
    buildDefinitionId?: number;
    
    parallel: boolean;
    maxParallelism: number;
    timeoutMinutes: number;
    
    retryPolicy?: {
      maxRetries: number;
      retryOnFailure: boolean;
      retryDelay: number;
    };
    
    triggerConditions?: {
      onBuildCompletion: boolean;
      onlyIfBuildSuccessful: boolean;
      minimumChanges: number;
      skipIfNoChanges: boolean;
    };
  };
  
  schedule: {
    startDate?: Date;
    endDate?: Date;
    nextRun?: Date;
    lastRun?: Date;
  };
  
  notifications?: {
    onSuccess?: string[];
    onFailure?: string[];
    onTimeout?: string[];
    includeReport: boolean;
  };
  
  statistics: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageDuration: number;
  };
  
  createdBy: IdentityRef;
  createdDate: Date;
  lastModifiedBy: IdentityRef;
  lastModifiedDate: Date;
}

export interface BatchTestExecution {
  id: string;
  name: string;
  state: "NotStarted" | "InProgress" | "Completed" | "Failed" | "Cancelled";
  
  runs: {
    runName: string;
    planId: number;
    suiteIds?: number[];
    testCaseIds?: number[];
    configurationId?: number;
    priority: number;
    dependsOn?: string[];
    
    state: "Pending" | "Running" | "Completed" | "Failed" | "Skipped";
    runId?: number;
    startTime?: Date;
    endTime?: Date;
    duration?: number;
  }[];
  
  executionMode: "sequential" | "parallel" | "prioritized";
  maxConcurrentRuns: number;
  continueOnFailure: boolean;
  
  resourceAllocation?: {
    cpuLimit?: number;
    memoryLimit?: number;
    diskSpace?: number;
    networkBandwidth?: number;
  };
  
  progress: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    remainingRuns: number;
    estimatedTimeRemaining?: number;
  };
  
  globalTimeout: number;
  
  createdBy: IdentityRef;
  createdDate: Date;
  startedDate?: Date;
  completedDate?: Date;
}

export interface ExecutionHistoryEntry {
  runId: number;
  runName: string;
  planId: number;
  planName: string;
  
  execution: {
    startTime: Date;
    endTime?: Date;
    duration?: number;
    state: "NotStarted" | "InProgress" | "Completed" | "Aborted" | "Timeout";
    outcome?: "Passed" | "Failed" | "Blocked" | "PartiallySucceeded";
  };
  
  results: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    blockedTests: number;
    notExecutedTests: number;
    passRate: number;
  };
  
  environment?: {
    configuration?: string;
    buildId?: number;
    buildNumber?: string;
    releaseId?: number;
  };
  
  performance?: {
    averageTestDuration: number;
    longestTestDuration: number;
    shortestTestDuration: number;
    throughput: number; // tests per minute
  };
  
  flakiness?: {
    flakyTests: number;
    flakinessRate: number;
    newlyFlakyTests: string[];
    resolvedFlakyTests: string[];
  };
  
  trends?: {
    passRateTrend: number; // percentage change
    durationTrend: number; // percentage change
    comparedToPrevious: boolean;
  };
}

export interface TestDataOperation {
  id: string;
  operation: "generate" | "cleanup" | "mask" | "version" | "restore" | "backup";
  state: "Pending" | "InProgress" | "Completed" | "Failed" | "Cancelled";
  
  scope: {
    planIds?: number[];
    suiteIds?: number[];
    testCaseIds?: number[];
    dataCategories?: string[];
  };
  
  progress: {
    totalItems: number;
    processedItems: number;
    failedItems: number;
    estimatedTimeRemaining?: number;
  };
  
  results?: {
    recordsProcessed: number;
    recordsGenerated?: number;
    recordsCleaned?: number;
    recordsMasked?: number;
    backupLocation?: string;
    versionTag?: string;
  };
  
  executionMode: "immediate" | "scheduled" | "on-demand";
  scheduleExpression?: string;
  
  createdBy: IdentityRef;
  createdDate: Date;
  startedDate?: Date;
  completedDate?: Date;
  
  errors?: string[];
  warnings?: string[];
}