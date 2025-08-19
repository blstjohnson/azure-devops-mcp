# Testing Tools Schema Definitions

## Overview

This document defines the comprehensive schema specifications for all testing tools in the Azure DevOps MCP server. These schemas provide type safety, validation, and consistent API contracts across all testing modules.

## Core Type Definitions

### Basic Types

```typescript
// Identity Reference
interface IdentityRef {
  id: string;
  displayName: string;
  uniqueName?: string;
  imageUrl?: string;
}

// Date Range
interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

// Pagination Information
interface PaginationInfo {
  continuationToken?: string;
  hasMore: boolean;
  totalCount?: number;
  pageSize: number;
  currentPage: number;
}

// Operation Result
interface OperationResult {
  success: boolean;
  id?: number;
  message?: string;
  errors?: string[];
  warnings?: string[];
}

// Batch Operation Result
interface BatchResult<T> {
  results: OperationResult[];
  successCount: number;
  errorCount: number;
  data?: T[];
  summary: string;
}
```

### Test-Specific Types

```typescript
// Test Step
interface TestStep {
  id?: number;
  stepNumber: number;
  action: string;
  expectedResult: string;
  attachments?: Attachment[];
}

// Test Configuration
interface TestConfiguration {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  state: "Active" | "Inactive";
  variables: ConfigurationVariable[];
}

// Configuration Variable
interface ConfigurationVariable {
  id: number;
  name: string;
  value: string;
  description?: string;
  isSecret: boolean;
}

// Attachment
interface Attachment {
  id: string;
  name: string;
  size: number;
  comment?: string;
  url?: string;
}

// Work Item Link
interface WorkItemLink {
  rel: string;
  url: string;
  attributes: {
    comment?: string;
    isLocked?: boolean;
  };
}

// Suite Assignment
interface SuiteAssignment {
  suiteId: number;
  suiteName: string;
  planId: number;
  planName: string;
  configurations: TestConfiguration[];
}

// Execution Summary
interface ExecutionSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  lastRunDate?: Date;
  averageExecutionTime?: number;
  flakyIndicator?: number;
}
```

## Test Suite Schemas

### Test Suite Object
```typescript
interface TestSuite {
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
  inheritDefaultConfigurations: boolean;
  
  // Type-specific properties
  queryString?: string; // For dynamic suites
  requirementId?: number; // For requirement suites
  
  // Audit information
  createdBy?: IdentityRef;
  createdDate?: Date;
  lastModifiedBy?: IdentityRef;
  lastModifiedDate?: Date;
  
  // Statistics (optional)
  statistics?: {
    passedTests?: number;
    failedTests?: number;
    blockedTests?: number;
    notRunTests?: number;
    lastRunDate?: Date;
    executionTrend?: "Improving" | "Stable" | "Declining";
  };
}
```

### Test Suite Input Schemas

#### Create Test Suite Schema
```typescript
const createTestSuiteSchema = z.object({
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID to create the suite in"),
  name: z.string().min(1).max(256).describe("Name of the test suite"),
  suiteType: z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"])
    .default("StaticTestSuite")
    .describe("Type of test suite to create"),
  parentSuiteId: z.number().optional().describe("Parent suite ID for nested suites"),
  description: z.string().max(4000).optional().describe("Description of the test suite"),
  
  // For Dynamic Test Suites
  queryString: z.string().optional().describe("Query string for dynamic test suites"),
  
  // For Requirement Test Suites
  requirementId: z.number().optional().describe("Requirement work item ID"),
  
  // Configuration
  defaultConfigurations: z.array(z.number()).optional()
    .describe("Default test configuration IDs"),
  inheritDefaultConfigurations: z.boolean().default(true)
    .describe("Whether to inherit default configurations from parent"),
    
  // Additional Properties
  tags: z.array(z.string()).optional().describe("Tags to assign to the suite"),
  areaPath: z.string().optional().describe("Area path for the suite"),
  iterationPath: z.string().optional().describe("Iteration path for the suite")
});
```

#### Update Test Suite Schema
```typescript
const updateTestSuiteSchema = z.object({
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID"),
  suiteId: z.number().describe("Test suite ID to update"),
  name: z.string().min(1).max(256).optional().describe("New name for the test suite"),
  description: z.string().max(4000).optional().describe("New description"),
  
  // Parent relationship updates
  parentSuiteId: z.number().optional().describe("New parent suite ID"),
  moveToRoot: z.boolean().default(false).describe("Move suite to root level"),
  
  // Dynamic suite updates
  queryString: z.string().optional().describe("Updated query string for dynamic suites"),
  
  // Configuration updates
  defaultConfigurations: z.array(z.number()).optional()
    .describe("Updated default configuration IDs"),
  addConfigurations: z.array(z.number()).optional()
    .describe("Configuration IDs to add"),
  removeConfigurations: z.array(z.number()).optional()
    .describe("Configuration IDs to remove"),
    
  // Property updates
  tags: z.array(z.string()).optional().describe("Updated tags"),
  areaPath: z.string().optional().describe("Updated area path"),
  iterationPath: z.string().optional().describe("Updated iteration path"),
  state: z.enum(["Active", "Inactive"]).optional().describe("Suite state")
});
```

#### List Test Suites Schema
```typescript
const listTestSuitesSchema = z.object({
  project: z.string().describe("Project ID or name"),
  planId: z.number().optional().describe("Test plan ID to filter by"),
  parentSuiteId: z.number().optional().describe("Parent suite ID for hierarchical listing"),
  includeChildSuites: z.boolean().default(false)
    .describe("Include child suites in results"),
  
  // Filtering options
  suiteType: z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"])
    .optional().describe("Filter by suite type"),
  nameFilter: z.string().optional().describe("Filter by suite name (partial match)"),
  state: z.enum(["Active", "Inactive", "All"]).default("Active")
    .describe("Filter by suite state"),
  tags: z.array(z.string()).optional().describe("Filter by tags"),
  
  // Date filtering
  createdAfter: z.coerce.date().optional().describe("Filter suites created after date"),
  modifiedAfter: z.coerce.date().optional().describe("Filter suites modified after date"),
  
  // Pagination
  top: z.number().min(1).max(1000).default(100).describe("Maximum number of results"),
  skip: z.number().min(0).default(0).describe("Number of results to skip"),
  continuationToken: z.string().optional().describe("Continuation token for pagination"),
  
  // Output options
  includeDetails: z.boolean().default(false)
    .describe("Include detailed suite information"),
  includeTestCaseCount: z.boolean().default(true)
    .describe("Include test case count in results"),
  includeChildCount: z.boolean().default(true)
    .describe("Include child suite count")
});
```

## Test Case Schemas

### Test Case Object
```typescript
interface TestCase {
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
  
  // Relationships
  links?: WorkItemLink[];
  suiteAssignments?: SuiteAssignment[];
  
  // Attachments
  attachments?: Attachment[];
  
  // Custom fields
  customFields?: Record<string, any>;
  
  // Audit information
  createdBy: IdentityRef;
  createdDate: Date;
  lastModifiedBy: IdentityRef;
  lastModifiedDate: Date;
  revision: number;
  
  // Statistics (optional)
  executionHistory?: ExecutionSummary;
  testResults?: TestResultSummary[];
}

interface TestResultSummary {
  outcome: "Passed" | "Failed" | "Blocked" | "NotExecuted" | "Inconclusive";
  runBy?: IdentityRef;
  runDate?: Date;
  duration?: number;
  configuration?: TestConfiguration;
  comment?: string;
}
```

### Test Case Input Schemas

#### Update Test Case Schema
```typescript
const updateTestCaseSchema = z.object({
  project: z.string().describe("Project ID or name"),
  testCaseId: z.number().describe("Test case ID to update"),
  
  // Basic properties
  title: z.string().min(1).max(512).optional().describe("Updated title"),
  description: z.string().max(4000).optional().describe("Updated description"),
  priority: z.number().min(1).max(4).optional().describe("Priority (1-4)"),
  
  // Test steps
  steps: z.string().optional()
    .describe("Updated test steps (format: '1. Step|Expected result\\n2. Step|Expected')"),
  stepUpdates: z.array(z.object({
    id: z.number().optional().describe("Step ID (for existing steps)"),
    action: z.enum(["add", "update", "delete"]).describe("Action to perform"),
    stepText: z.string().optional().describe("Step action text"),
    expectedResult: z.string().optional().describe("Expected result text"),
    position: z.number().optional().describe("Step position")
  })).optional().describe("Granular step updates"),
  
  // Classification
  areaPath: z.string().optional().describe("Updated area path"),
  iterationPath: z.string().optional().describe("Updated iteration path"),
  tags: z.array(z.string()).optional().describe("Updated tags"),
  
  // Custom fields
  customFields: z.record(z.string(), z.any()).optional()
    .describe("Custom field updates"),
    
  // State management
  state: z.enum(["Design", "Ready", "Closed", "Active"]).optional()
    .describe("Test case state"),
  reason: z.string().optional().describe("Reason for state change"),
  
  // Automation
  automationStatus: z.enum(["Not Automated", "Planned", "Automated"]).optional()
    .describe("Automation status"),
  automatedTestName: z.string().optional().describe("Automated test name"),
  automatedTestStorage: z.string().optional().describe("Automated test storage"),
  automatedTestType: z.string().optional().describe("Automated test type"),
  automatedTestId: z.string().optional().describe("Automated test ID"),
  
  // Attachments
  attachments: z.array(z.object({
    action: z.enum(["add", "remove"]).describe("Attachment action"),
    name: z.string().describe("Attachment name"),
    content: z.string().optional().describe("Base64 encoded content for new attachments"),
    url: z.string().optional().describe("URL for existing attachments")
  })).optional().describe("Attachment updates")
});
```

#### Search Test Cases Schema
```typescript
const searchTestCasesSchema = z.object({
  project: z.string().describe("Project ID or name"),
  
  // Search criteria
  searchText: z.string().optional().describe("Full-text search across title, steps, description"),
  titleFilter: z.string().optional().describe("Filter by title (supports wildcards)"),
  
  // Scope filtering
  planIds: z.array(z.number()).optional().describe("Filter by test plan IDs"),
  suiteIds: z.array(z.number()).optional().describe("Filter by test suite IDs"),
  areaPath: z.string().optional().describe("Filter by area path"),
  iterationPath: z.string().optional().describe("Filter by iteration path"),
  
  // Property filtering
  state: z.array(z.enum(["Design", "Ready", "Closed", "Active"])).optional()
    .describe("Filter by test case states"),
  priority: z.array(z.number().min(1).max(4)).optional()
    .describe("Filter by priority levels"),
  tags: z.array(z.string()).optional().describe("Filter by tags (AND operation)"),
  anyTags: z.array(z.string()).optional().describe("Filter by tags (OR operation)"),
  
  // Automation filtering
  automationStatus: z.array(z.enum(["Not Automated", "Planned", "Automated"])).optional()
    .describe("Filter by automation status"),
  hasAutomation: z.boolean().optional().describe("Filter by presence of automation"),
  
  // Date filtering
  createdAfter: z.coerce.date().optional().describe("Created after date"),
  createdBefore: z.coerce.date().optional().describe("Created before date"),
  modifiedAfter: z.coerce.date().optional().describe("Modified after date"),
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
  fields: z.array(z.string()).optional()
    .describe("Specific fields to return"),
  includeSteps: z.boolean().default(false).describe("Include test steps in results"),
  includeAttachments: z.boolean().default(false).describe("Include attachment info"),
  includeLinks: z.boolean().default(false).describe("Include work item links"),
  
  // Sorting
  sortBy: z.enum(["id", "title", "priority", "state", "createdDate", "modifiedDate"])
    .default("id").describe("Sort field"),
  sortOrder: z.enum(["asc", "desc"]).default("asc").describe("Sort order"),
  
  // Pagination
  top: z.number().min(1).max(1000).default(100).describe("Maximum results"),
  skip: z.number().min(0).default(0).describe("Results to skip"),
  continuationToken: z.string().optional().describe("Continuation token")
});
```

## Response Schemas

### Standard Tool Response
```typescript
interface ToolResponse<T = any> {
  content: [{ type: "text", text: string }];
  data?: T;
  pagination?: PaginationInfo;
  metadata?: ResponseMetadata;
}

interface ResponseMetadata {
  totalCount?: number;
  processedCount?: number;
  errorCount?: number;
  warningCount?: number;
  executionTime?: number;
  apiVersion?: string;
  warnings?: string[];
  deprecationWarnings?: string[];
}
```

### Test Suite Responses
```typescript
interface TestSuiteResponse extends ToolResponse<TestSuite> {
  suite?: TestSuite;
}

interface TestSuiteListResponse extends ToolResponse<TestSuite[]> {
  suites?: TestSuite[];
  hierarchy?: TestSuiteHierarchy;
}

interface TestSuiteHierarchy {
  rootSuites: TestSuiteNode[];
  totalSuites: number;
  maxDepth: number;
}

interface TestSuiteNode {
  suite: TestSuite;
  children: TestSuiteNode[];
  depth: number;
  hasMoreChildren?: boolean;
}
```

### Test Case Responses
```typescript
interface TestCaseResponse extends ToolResponse<TestCase> {
  testCase?: TestCase;
}

interface TestCaseListResponse extends ToolResponse<TestCase[]> {
  testCases?: TestCase[];
  searchMetadata?: SearchMetadata;
}

interface SearchMetadata {
  totalResults: number;
  searchTime: number;
  relevanceThreshold?: number;
  facets?: SearchFacet[];
}

interface SearchFacet {
  name: string;
  values: FacetValue[];
}

interface FacetValue {
  value: string;
  count: number;
  selected?: boolean;
}
```

### Batch Operation Responses
```typescript
interface BatchOperationResponse<T> extends ToolResponse<BatchResult<T>> {
  results: OperationResult[];
  summary: BatchSummary;
}

interface BatchSummary {
  totalRequested: number;
  successful: number;
  failed: number;
  skipped: number;
  duration: number;
  throughput: number;
}
```

## Validation Rules

### Common Validation Patterns
```typescript
// Project validation
const projectValidation = z.string()
  .min(1, "Project name/ID cannot be empty")
  .max(64, "Project name/ID too long");

// ID validation
const idValidation = z.number()
  .int("ID must be an integer")
  .positive("ID must be positive");

// Name validation
const nameValidation = z.string()
  .min(1, "Name cannot be empty")
  .max(256, "Name too long")
  .regex(/^[^<>"|]*$/, "Name contains invalid characters");

// Tag validation
const tagValidation = z.string()
  .min(1, "Tag cannot be empty")
  .max(100, "Tag too long")
  .regex(/^[a-zA-Z0-9\-_\s]+$/, "Tag contains invalid characters");

// Path validation
const pathValidation = z.string()
  .regex(/^[^<>"|*?]+$/, "Path contains invalid characters");

// Priority validation
const priorityValidation = z.number()
  .int("Priority must be an integer")
  .min(1, "Priority must be between 1 and 4")
  .max(4, "Priority must be between 1 and 4");
```

### Custom Validation Functions
```typescript
// Validate suite type specific requirements
function validateSuiteTypeRequirements(data: any): boolean {
  if (data.suiteType === "DynamicTestSuite" && !data.queryString) {
    throw new Error("Query string required for dynamic test suites");
  }
  if (data.suiteType === "RequirementTestSuite" && !data.requirementId) {
    throw new Error("Requirement ID required for requirement test suites");
  }
  return true;
}

// Validate circular dependencies in suite hierarchy
function validateNoCircularDependency(suiteId: number, parentSuiteId: number): boolean {
  // Implementation would check for circular references
  return true;
}

// Validate test step format
function validateTestStepFormat(steps: string): boolean {
  const stepPattern = /^\d+\.\s+.+\|.+$/;
  return steps.split('\n').every(step => 
    step.trim() === '' || stepPattern.test(step.trim())
  );
}
```

## Error Schemas

### Standard Error Response
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
    innerError?: InnerError;
    target?: string;
    timestamp: string;
  };
}

interface ErrorDetails {
  field?: string;
  value?: any;
  constraints?: string[];
  suggestions?: string[];
}

interface InnerError {
  code: string;
  message: string;
  stackTrace?: string;
}
```

### Validation Error Response
```typescript
interface ValidationErrorResponse extends ErrorResponse {
  validationErrors: FieldError[];
}

interface FieldError {
  field: string;
  message: string;
  code: string;
  value?: any;
  constraints?: string[];
}
```

### Common Error Codes
```typescript
enum ErrorCodes {
  // Validation errors
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE",
  
  // Resource errors
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  
  // Permission errors
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCESS_DENIED = "ACCESS_DENIED",
  
  // Operation errors
  OPERATION_FAILED = "OPERATION_FAILED",
  CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",
  DEPENDENCY_VIOLATION = "DEPENDENCY_VIOLATION",
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
}
```

## Schema Composition Patterns

### Reusable Schema Components
```typescript
// Base entity schema
const baseEntitySchema = z.object({
  id: idValidation,
  createdBy: z.object({
    id: z.string(),
    displayName: z.string()
  }).optional(),
  createdDate: z.coerce.date().optional(),
  lastModifiedBy: z.object({
    id: z.string(),
    displayName: z.string()
  }).optional(),
  lastModifiedDate: z.coerce.date().optional()
});

// Pagination schema
const paginationSchema = z.object({
  top: z.number().min(1).max(1000).default(100),
  skip: z.number().min(0).default(0),
  continuationToken: z.string().optional()
});

// Project context schema
const projectContextSchema = z.object({
  project: projectValidation,
  planId: idValidation.optional(),
  suiteId: idValidation.optional()
});

// Filtering schema
const filteringSchema = z.object({
  nameFilter: z.string().optional(),
  tags: z.array(tagValidation).optional(),
  state: z.array(z.string()).optional(),
  createdAfter: z.coerce.date().optional(),
  modifiedAfter: z.coerce.date().optional()
});
```

### Schema Extension Pattern
```typescript
// Extend base schemas for specific use cases
const createTestSuiteSchema = projectContextSchema
  .extend({
    planId: idValidation, // Make required for creation
    name: nameValidation,
    suiteType: z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"])
  })
  .refine(validateSuiteTypeRequirements, {
    message: "Suite type requirements not met"
  });

// Combine schemas for complex operations
const searchWithPaginationSchema = z.intersection(
  searchTestCasesSchema,
  paginationSchema
);
```

This comprehensive schema system provides:

1. **Type Safety**: Strong typing for all API contracts
2. **Validation**: Comprehensive input validation with clear error messages
3. **Consistency**: Standardized patterns across all tools
4. **Extensibility**: Composable schemas for future enhancements
5. **Documentation**: Self-documenting API contracts
6. **Error Handling**: Structured error responses with actionable information

These schemas will serve as the foundation for implementing all testing tools with consistent behavior and robust validation.