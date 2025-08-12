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

// Test Analytics Schemas
export const detectFlakyTestsSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  planIds: z.array(idValidation).optional().describe("Test plan IDs to analyze"),
  suiteIds: z.array(idValidation).optional().describe("Test suite IDs to analyze"),
  timeframe: z.object({
    startDate: z.coerce.date().describe("Analysis start date"),
    endDate: z.coerce.date().describe("Analysis end date")
  }).describe("Time period for flaky test analysis"),
  minExecutions: z.number().int().min(3).max(1000).default(5)
    .describe("Minimum executions required for flakiness analysis"),
  flakinessThreshold: z.number().min(0.1).max(0.9).default(0.3)
    .describe("Flakiness threshold (0.3 = 30% failure rate)"),
  confidenceLevel: z.number().min(0.8).max(0.99).default(0.85)
    .describe("Statistical confidence level for analysis"),
  includeEnvironmentCorrelation: z.boolean().default(true)
    .describe("Include environment correlation in analysis"),
  groupBy: z.enum(["testCase", "suite", "configuration", "environment"]).default("testCase")
    .describe("Group flaky tests by category"),
  outputFormat: z.enum(["summary", "detailed", "statistical"]).default("detailed")
    .describe("Analysis output format")
});

export const qualityMetricsSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  scope: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan IDs to analyze"),
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs to analyze"),
    testCaseIds: z.array(idValidation).optional().describe("Specific test case IDs")
  }).describe("Analysis scope definition"),
  timeframe: z.object({
    startDate: z.coerce.date().describe("Metrics calculation start date"),
    endDate: z.coerce.date().describe("Metrics calculation end date")
  }).describe("Time period for quality metrics"),
  metrics: z.array(z.enum([
    "passRate", "testCoverage", "defectDensity", "automationRate",
    "testEfficiency", "reliabilityIndex", "maintainabilityScore"
  ])).default(["passRate", "testCoverage", "automationRate"])
    .describe("Quality metrics to calculate"),
  includeComparison: z.boolean().default(true)
    .describe("Include comparison with previous period"),
  comparisonPeriod: z.enum(["previousWeek", "previousMonth", "previousQuarter", "yearOverYear"])
    .default("previousMonth").describe("Comparison period reference"),
  benchmarkData: z.boolean().default(false)
    .describe("Include industry benchmark data"),
  includeRecommendations: z.boolean().default(true)
    .describe("Include improvement recommendations"),
  aggregationLevel: z.enum(["daily", "weekly", "monthly"]).default("weekly")
    .describe("Data aggregation level")
});

export const performanceAnalysisSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  scope: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan IDs to analyze"),
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs to analyze"),
    configurationIds: z.array(idValidation).optional().describe("Configuration IDs to analyze")
  }).describe("Performance analysis scope"),
  timeframe: z.object({
    startDate: z.coerce.date().describe("Analysis start date"),
    endDate: z.coerce.date().describe("Analysis end date")
  }).describe("Time period for performance analysis"),
  analysisTypes: z.array(z.enum([
    "executionTime", "throughput", "resourceUsage", "bottlenecks",
    "trends", "regressions", "optimization"
  ])).default(["executionTime", "throughput", "trends"])
    .describe("Types of performance analysis to perform"),
  performanceThresholds: z.object({
    maxExecutionTime: z.number().min(1).optional().describe("Maximum acceptable execution time in seconds"),
    minThroughput: z.number().min(0.1).optional().describe("Minimum acceptable tests per minute"),
    maxResourceUsage: z.number().min(1).max(100).optional().describe("Maximum resource usage percentage")
  }).optional().describe("Performance threshold definitions"),
  includeRegression: z.boolean().default(true)
    .describe("Include regression analysis"),
  regressionSensitivity: z.number().min(0.05).max(0.5).default(0.1)
    .describe("Regression detection sensitivity (0.1 = 10% change)"),
  includeOptimizationSuggestions: z.boolean().default(true)
    .describe("Include performance optimization suggestions"),
  statisticalAnalysis: z.boolean().default(true)
    .describe("Include statistical performance analysis")
});

export const riskAssessmentSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  scope: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan IDs to assess"),
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs to assess"),
    areaPath: pathValidation.optional().describe("Area path to focus assessment on")
  }).describe("Risk assessment scope"),
  riskFactors: z.array(z.enum([
    "testCoverage", "codeComplexity", "changeFrequency", "defectHistory",
    "teamExperience", "dependencies", "criticalPath", "performance"
  ])).default(["testCoverage", "defectHistory", "dependencies"])
    .describe("Risk factors to analyze"),
  assessmentPeriod: z.object({
    startDate: z.coerce.date().describe("Assessment period start date"),
    endDate: z.coerce.date().describe("Assessment period end date")
  }).describe("Time period for historical risk data"),
  riskLevels: z.object({
    lowThreshold: z.number().min(0).max(0.5).default(0.2).describe("Low risk threshold"),
    mediumThreshold: z.number().min(0.2).max(0.7).default(0.5).describe("Medium risk threshold"),
    highThreshold: z.number().min(0.5).max(1.0).default(0.8).describe("High risk threshold")
  }).optional().describe("Risk level threshold definitions"),
  includePredictiveAnalysis: z.boolean().default(true)
    .describe("Include predictive failure analysis"),
  predictionHorizon: z.number().min(1).max(365).default(30)
    .describe("Prediction horizon in days"),
  includeRecommendations: z.boolean().default(true)
    .describe("Include risk mitigation recommendations"),
  prioritizeByImpact: z.boolean().default(true)
    .describe("Prioritize risks by business impact")
});

export const teamProductivitySchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  teamScope: z.object({
    teamIds: z.array(z.string()).optional().describe("Specific team IDs to analyze"),
    userIds: z.array(z.string()).optional().describe("Specific user IDs to analyze"),
    includeAllContributors: z.boolean().default(true).describe("Include all test contributors")
  }).describe("Team scope for productivity analysis"),
  timeframe: z.object({
    startDate: z.coerce.date().describe("Analysis start date"),
    endDate: z.coerce.date().describe("Analysis end date")
  }).describe("Time period for productivity analysis"),
  productivityMetrics: z.array(z.enum([
    "testCreationRate", "executionEfficiency", "defectDetectionRate",
    "automationProgress", "codeQuality", "collaboration", "velocity"
  ])).default(["testCreationRate", "executionEfficiency", "automationProgress"])
    .describe("Productivity metrics to calculate"),
  benchmarkType: z.enum(["team", "project", "organization", "industry"]).default("team")
    .describe("Benchmark comparison type"),
  includeIndividualMetrics: z.boolean().default(false)
    .describe("Include individual contributor metrics"),
  anonymizeResults: z.boolean().default(true)
    .describe("Anonymize individual results in reports"),
  includeRecommendations: z.boolean().default(true)
    .describe("Include productivity improvement recommendations"),
  aggregationLevel: z.enum(["daily", "weekly", "monthly"]).default("weekly")
    .describe("Data aggregation level"),
  includeCapacityPlanning: z.boolean().default(true)
    .describe("Include capacity planning insights")
});

// Test Reporting Schemas
export const generateStandardReportsSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  reportTypes: z.array(z.enum([
    "testExecution", "testCoverage", "defectSummary", "automationProgress",
    "qualityMetrics", "performanceSummary", "teamProductivity", "riskAssessment"
  ])).min(1).describe("Types of standard reports to generate"),
  scope: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan IDs to include"),
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs to include"),
    configurationIds: z.array(idValidation).optional().describe("Configuration IDs to include")
  }).describe("Report scope definition"),
  timeframe: z.object({
    startDate: z.coerce.date().describe("Report start date"),
    endDate: z.coerce.date().describe("Report end date"),
    comparisonPeriod: z.enum(["none", "previousWeek", "previousMonth", "previousQuarter"])
      .default("previousMonth").describe("Comparison period for trends")
  }).describe("Report time period"),
  outputFormats: z.array(z.enum(["pdf", "excel", "html", "json", "csv"]))
    .default(["pdf", "html"]).describe("Output formats for reports"),
  customization: z.object({
    includeCharts: z.boolean().default(true).describe("Include charts and visualizations"),
    includeTables: z.boolean().default(true).describe("Include data tables"),
    includeExecutiveSummary: z.boolean().default(true).describe("Include executive summary"),
    includeDetailedAnalysis: z.boolean().default(false).describe("Include detailed analysis sections"),
    brandingTemplate: z.string().optional().describe("Custom branding template ID")
  }).optional().describe("Report customization options"),
  distribution: z.object({
    recipients: z.array(z.string().email()).optional().describe("Email recipients for reports"),
    shareLocation: z.string().optional().describe("Shared location for report storage"),
    scheduledDelivery: z.boolean().default(false).describe("Enable scheduled report delivery"),
    retentionDays: z.number().min(1).max(365).default(90).describe("Report retention period")
  }).optional().describe("Report distribution settings")
});

export const createCustomReportsSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  reportDefinition: z.object({
    name: nameValidation.describe("Custom report name"),
    description: z.string().max(1000).optional().describe("Report description"),
    category: z.string().max(100).optional().describe("Report category"),
    template: z.enum(["blank", "executive", "technical", "comparison", "trend"])
      .default("blank").describe("Base template to use")
  }).describe("Custom report definition"),
  dataSource: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan data sources"),
    suiteIds: z.array(idValidation).optional().describe("Test suite data sources"),
    customQueries: z.array(z.object({
      queryName: z.string().describe("Query identifier"),
      queryString: z.string().describe("Data query string"),
      parameters: z.record(z.string(), z.any()).optional().describe("Query parameters")
    })).optional().describe("Custom data queries")
  }).describe("Report data sources"),
  layout: z.object({
    sections: z.array(z.object({
      sectionId: z.string().describe("Section identifier"),
      sectionType: z.enum(["header", "summary", "chart", "table", "text", "image"]),
      title: z.string().optional().describe("Section title"),
      content: z.any().describe("Section content definition"),
      position: z.object({
        page: z.number().min(1).default(1),
        order: z.number().min(1).default(1)
      }).describe("Section position")
    })).min(1).describe("Report sections")
  }).describe("Report layout configuration"),
  formatting: z.object({
    pageSize: z.enum(["A4", "A3", "Letter", "Legal"]).default("A4"),
    orientation: z.enum(["portrait", "landscape"]).default("portrait"),
    margins: z.object({
      top: z.number().default(25),
      bottom: z.number().default(25),
      left: z.number().default(25),
      right: z.number().default(25)
    }).optional(),
    fonts: z.object({
      headerFont: z.string().default("Arial"),
      bodyFont: z.string().default("Arial"),
      fontSize: z.number().min(8).max(24).default(12)
    }).optional(),
    colors: z.object({
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#0078D4"),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#106EBE"),
      accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFB900")
    }).optional()
  }).optional().describe("Report formatting options"),
  outputOptions: z.object({
    formats: z.array(z.enum(["pdf", "excel", "html", "powerpoint", "word"]))
      .default(["pdf"]).describe("Output formats"),
    quality: z.enum(["draft", "standard", "high"]).default("standard")
      .describe("Output quality level"),
    compression: z.boolean().default(true).describe("Enable output compression")
  }).optional().describe("Output generation options"),
  saveAsTemplate: z.boolean().default(false)
    .describe("Save this report as a reusable template")
});

export const exportDataSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  dataScope: z.object({
    planIds: z.array(idValidation).optional().describe("Test plan IDs to export"),
    suiteIds: z.array(idValidation).optional().describe("Test suite IDs to export"),
    testCaseIds: z.array(idValidation).optional().describe("Specific test case IDs to export"),
    runIds: z.array(idValidation).optional().describe("Test run IDs to export")
  }).describe("Data scope for export"),
  timeframe: z.object({
    startDate: z.coerce.date().describe("Export start date"),
    endDate: z.coerce.date().describe("Export end date"),
    includeHistorical: z.boolean().default(false).describe("Include historical data beyond timeframe")
  }).describe("Export time period"),
  dataTypes: z.array(z.enum([
    "testCases", "testRuns", "testResults", "defects", "requirements",
    "configurations", "metrics", "attachments", "comments", "links"
  ])).min(1).describe("Types of data to export"),
  exportFormat: z.enum(["excel", "csv", "json", "xml", "sql", "powerbi", "tableau"])
    .describe("Export file format"),
  exportOptions: z.object({
    includeMetadata: z.boolean().default(true).describe("Include metadata in export"),
    includeRelationships: z.boolean().default(true).describe("Include data relationships"),
    flattenHierarchy: z.boolean().default(false).describe("Flatten hierarchical data"),
    includeCalculatedFields: z.boolean().default(true).describe("Include calculated fields"),
    compression: z.enum(["none", "zip", "gzip"]).default("zip").describe("Export compression"),
    encoding: z.enum(["utf8", "utf16", "ascii"]).default("utf8").describe("Text encoding")
  }).optional().describe("Export formatting options"),
  transformation: z.object({
    anonymize: z.boolean().default(false).describe("Anonymize personal data"),
    aggregateData: z.boolean().default(false).describe("Aggregate detailed data"),
    filterCriteria: z.record(z.string(), z.any()).optional().describe("Data filtering criteria"),
    customMappings: z.array(z.object({
      sourceField: z.string(),
      targetField: z.string(),
      transformation: z.string().optional()
    })).optional().describe("Custom field mappings")
  }).optional().describe("Data transformation options"),
  destination: z.object({
    deliveryMethod: z.enum(["download", "email", "ftp", "cloud", "api"]).default("download"),
    targetLocation: z.string().optional().describe("Target location for delivery"),
    credentials: z.record(z.string(), z.string()).optional().describe("Delivery credentials"),
    notificationEmail: z.string().email().optional().describe("Completion notification email")
  }).optional().describe("Export destination settings")
});

export const manageDashboardsSchema = z.object({
  project: projectValidation.describe("Project ID or name"),
  operation: z.enum(["create", "update", "delete", "list", "share", "configure"])
    .describe("Dashboard management operation"),
  dashboardId: z.string().optional().describe("Dashboard ID for update/delete/configure operations"),
  dashboardDefinition: z.object({
    name: nameValidation.describe("Dashboard name"),
    description: z.string().max(1000).optional().describe("Dashboard description"),
    category: z.string().max(100).optional().describe("Dashboard category"),
    isPublic: z.boolean().default(false).describe("Whether dashboard is publicly accessible"),
    tags: z.array(tagValidation).optional().describe("Dashboard tags")
  }).optional().describe("Dashboard definition for create/update operations"),
  layout: z.object({
    gridSize: z.object({
      columns: z.number().min(1).max(12).default(12),
      rows: z.number().min(1).max(20).default(8)
    }).optional(),
    widgets: z.array(z.object({
      widgetId: z.string().describe("Widget identifier"),
      widgetType: z.enum([
        "chart", "table", "metric", "gauge", "trend", "heatmap", "text", "image"
      ]).describe("Widget type"),
      title: z.string().optional().describe("Widget title"),
      position: z.object({
        x: z.number().min(0),
        y: z.number().min(0),
        width: z.number().min(1),
        height: z.number().min(1)
      }).describe("Widget position and size"),
      dataSource: z.object({
        query: z.string().describe("Data query for widget"),
        refreshInterval: z.number().min(0).default(300).describe("Refresh interval in seconds"),
        parameters: z.record(z.string(), z.any()).optional().describe("Query parameters")
      }).describe("Widget data source"),
      visualization: z.object({
        chartType: z.enum(["line", "bar", "pie", "area", "scatter", "table"]).optional(),
        colors: z.array(z.string()).optional().describe("Custom color scheme"),
        formatting: z.record(z.string(), z.any()).optional().describe("Visualization formatting")
      }).optional().describe("Widget visualization settings")
    })).optional().describe("Dashboard widgets")
  }).optional().describe("Dashboard layout configuration"),
  sharing: z.object({
    shareWith: z.array(z.object({
      type: z.enum(["user", "team", "group", "public"]),
      identifier: z.string().describe("User/team/group identifier"),
      permissions: z.enum(["view", "edit", "admin"]).default("view")
    })).optional().describe("Sharing configuration"),
    accessLink: z.boolean().default(false).describe("Generate public access link"),
    embedCode: z.boolean().default(false).describe("Generate embed code")
  }).optional().describe("Dashboard sharing settings"),
  alerts: z.object({
    enableAlerts: z.boolean().default(false).describe("Enable dashboard alerts"),
    alertRules: z.array(z.object({
      ruleName: z.string().describe("Alert rule name"),
      condition: z.string().describe("Alert condition expression"),
      threshold: z.number().describe("Alert threshold value"),
      recipients: z.array(z.string().email()).describe("Alert recipients"),
      frequency: z.enum(["immediate", "hourly", "daily", "weekly"]).default("immediate")
    })).optional().describe("Alert rule definitions")
  }).optional().describe("Dashboard alerting configuration"),
  automation: z.object({
    autoRefresh: z.boolean().default(true).describe("Enable automatic refresh"),
    refreshInterval: z.number().min(60).default(300).describe("Global refresh interval in seconds"),
    scheduleReports: z.boolean().default(false).describe("Enable scheduled report generation"),
    reportSchedule: z.string().optional().describe("Cron expression for report schedule"),
    exportFormats: z.array(z.enum(["pdf", "excel", "png"])).optional()
      .describe("Formats for scheduled reports")
  }).optional().describe("Dashboard automation settings")
});

// Response interfaces for analytics and reporting
export interface FlakyTestResult {
  testCaseId: number;
  testCaseName: string;
  flakinessScore: number;
  totalExecutions: number;
  failureCount: number;
  successCount: number;
  failureRate: number;
  confidenceLevel: number;
  environmentCorrelation?: {
    environment: string;
    flakinessInEnvironment: number;
  }[];
  recommendations: string[];
  statisticalData: {
    standardDeviation: number;
    variance: number;
    trendDirection: "increasing" | "decreasing" | "stable";
  };
}

export interface QualityMetricsResult {
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    passRate: number;
    testCoverage?: number;
    defectDensity?: number;
    automationRate: number;
    testEfficiency?: number;
    reliabilityIndex?: number;
    maintainabilityScore?: number;
  };
  comparison?: {
    previousPeriod: {
      passRate: number;
      automationRate: number;
      [key: string]: number;
    };
    trends: {
      passRateTrend: number;
      automationTrend: number;
      [key: string]: number;
    };
  };
  recommendations: string[];
  benchmarkData?: {
    industryAverage: Record<string, number>;
    topPerformers: Record<string, number>;
  };
}

export interface PerformanceAnalysisResult {
  period: {
    startDate: Date;
    endDate: Date;
  };
  performanceMetrics: {
    averageExecutionTime: number;
    medianExecutionTime: number;
    throughput: number;
    resourceUtilization?: {
      cpu: number;
      memory: number;
      network?: number;
    };
  };
  regressionAnalysis?: {
    hasRegression: boolean;
    regressionPoints: {
      date: Date;
      metric: string;
      change: number;
    }[];
  };
  bottlenecks: {
    type: string;
    description: string;
    impact: "low" | "medium" | "high";
    suggestions: string[];
  }[];
  optimizationSuggestions: string[];
  trends: {
    executionTimeTrend: number;
    throughputTrend: number;
  };
}

export interface RiskAssessmentResult {
  assessmentDate: Date;
  overallRiskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: {
    factor: string;
    score: number;
    weight: number;
    contribution: number;
    description: string;
  }[];
  criticalAreas: {
    area: string;
    riskScore: number;
    issues: string[];
    recommendations: string[];
  }[];
  predictiveAnalysis?: {
    failureProbability: number;
    predictionHorizon: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  };
  mitigationStrategies: {
    priority: "high" | "medium" | "low";
    strategy: string;
    estimatedImpact: number;
    effort: "low" | "medium" | "high";
  }[];
}

export interface TeamProductivityResult {
  period: {
    startDate: Date;
    endDate: Date;
  };
  teamMetrics: {
    testCreationRate: number;
    executionEfficiency: number;
    defectDetectionRate: number;
    automationProgress: number;
    velocity: number;
  };
  individualMetrics?: {
    userId: string;
    displayName?: string;
    metrics: {
      testCreationRate: number;
      executionEfficiency: number;
      automationContribution: number;
    };
  }[];
  benchmarkComparison: {
    teamVsProject: Record<string, number>;
    teamVsOrganization?: Record<string, number>;
  };
  recommendations: string[];
  capacityPlanning?: {
    currentCapacity: number;
    optimalCapacity: number;
    bottlenecks: string[];
    suggestions: string[];
  };
}

export interface StandardReportResult {
  reportId: string;
  reportType: string;
  generatedDate: Date;
  scope: {
    project: string;
    plans?: number[];
    suites?: number[];
  };
  outputFiles: {
    format: string;
    fileUrl: string;
    fileSize: number;
  }[];
  summary: {
    totalTests: number;
    passRate: number;
    executionTime: number;
    keyFindings: string[];
  };
  distributionStatus?: {
    emailsSent: number;
    deliveryStatus: "pending" | "completed" | "failed";
    errors?: string[];
  };
}

export interface CustomReportResult {
  reportId: string;
  reportName: string;
  generatedDate: Date;
  template: string;
  outputFiles: {
    format: string;
    fileUrl: string;
    fileSize: number;
  }[];
  processingStats: {
    processingTime: number;
    dataPoints: number;
    sectionsGenerated: number;
  };
  templateSaved?: boolean;
}

export interface ExportDataResult {
  exportId: string;
  exportDate: Date;
  scope: {
    project: string;
    dataTypes: string[];
    recordCount: number;
  };
  exportFiles: {
    format: string;
    fileUrl: string;
    fileSize: number;
    recordCount: number;
  }[];
  transformationSummary?: {
    recordsProcessed: number;
    recordsFiltered: number;
    fieldsMapped: number;
    anonymizedFields?: string[];
  };
  deliveryStatus?: {
    method: string;
    status: "pending" | "completed" | "failed";
    deliveredAt?: Date;
    errors?: string[];
  };
}

export interface DashboardResult {
  dashboardId: string;
  operation: string;
  status: "success" | "error" | "partial";
  dashboard?: {
    id: string;
    name: string;
    url: string;
    widgets: number;
    lastUpdated: Date;
  };
  sharing?: {
    shareUrl?: string;
    embedCode?: string;
    sharedWith: {
      type: string;
      identifier: string;
      permissions: string;
    }[];
  };
  alerts?: {
    alertsConfigured: number;
    activeAlerts: number;
  };
  errors?: string[];
  warnings?: string[];
}