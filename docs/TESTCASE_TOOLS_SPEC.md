# Advanced Test Case Management Tools Specification

## Overview

This document provides detailed specifications for the advanced test case management tools that will be implemented in the `testcases.ts` module. These tools extend the existing basic test case functionality with comprehensive CRUD operations, bulk operations, search capabilities, and advanced management features.

## Current State Analysis

### Existing Test Case Tools (in testplans.ts)
- `testplan_create_test_case` - Basic test case creation
- `testplan_list_test_cases` - List test cases in a plan/suite

### Enhancement Requirements
- Full CRUD operations for test cases
- Bulk operations for efficiency
- Advanced search and filtering
- Test case templates and cloning
- Relationship management
- Import/export capabilities

## Tool Specifications

### 1. Update Test Case (`testcase_update_case`)

**Purpose**: Update existing test cases with comprehensive field modification support.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  testCaseId: z.number().describe("Test case ID to update"),
  
  // Basic properties
  title: z.string().optional().describe("Updated title"),
  description: z.string().optional().describe("Updated description"),
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
  
  // Attachments
  attachments: z.array(z.object({
    action: z.enum(["add", "remove"]).describe("Attachment action"),
    name: z.string().describe("Attachment name"),
    content: z.string().optional().describe("Base64 encoded content for new attachments"),
    url: z.string().optional().describe("URL for existing attachments")
  })).optional().describe("Attachment updates")
}
```

**Implementation Details**:
- Support both bulk field updates and granular step modifications
- Validate state transitions according to Azure DevOps rules
- Handle custom fields with proper type conversion
- Manage attachments with proper encoding

### 2. Clone Test Case (`testcase_clone_case`)

**Purpose**: Clone test cases with options for bulk cloning and cross-project operations.

**Input Schema**:
```typescript
{
  sourceProject: z.string().describe("Source project ID or name"),
  sourceTestCaseId: z.number().describe("Source test case ID"),
  
  targetProject: z.string().describe("Target project ID or name"),
  targetPlanId: z.number().optional().describe("Target test plan ID"),
  targetSuiteId: z.number().optional().describe("Target test suite ID"),
  
  // Clone options
  newTitle: z.string().optional().describe("New title for cloned test case"),
  titlePrefix: z.string().optional().describe("Prefix to add to cloned title"),
  titleSuffix: z.string().optional().describe("Suffix to add to cloned title"),
  
  // Property mapping
  areaPathMapping: z.string().optional().describe("Target area path"),
  iterationPathMapping: z.string().optional().describe("Target iteration path"),
  
  // Content options
  preserveAttachments: z.boolean().default(true).describe("Preserve attachments"),
  preserveLinks: z.boolean().default(false).describe("Preserve work item links"),
  preserveHistory: z.boolean().default(false).describe("Preserve history comments"),
  
  // Automation mapping
  updateAutomation: z.boolean().default(false).describe("Update automation references"),
  automationMapping: z.object({
    testName: z.string().optional(),
    testStorage: z.string().optional()
  }).optional().describe("New automation mapping"),
  
  // Bulk clone options
  cloneCount: z.number().min(1).max(100).default(1)
    .describe("Number of clones to create"),
  numberingPattern: z.string().optional()
    .describe("Pattern for numbering multiple clones (e.g., '_Copy_{n}')")
}
```

**Implementation Details**:
- Support single and bulk cloning operations
- Cross-project cloning with proper mapping
- Content preservation options
- Automation reference updating

### 3. Delete Test Case (`testcase_delete_case`)

**Purpose**: Safely delete test cases with dependency checking and bulk operations.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  testCaseIds: z.union([z.number(), z.array(z.number())])
    .describe("Test case ID(s) to delete"),
  
  // Safety options
  checkDependencies: z.boolean().default(true)
    .describe("Check for dependencies before deletion"),
  removeFromSuites: z.boolean().default(true)
    .describe("Remove from all test suites"),
  preserveResults: z.boolean().default(false)
    .describe("Preserve test results in history"),
  
  // Bulk operation options
  batchSize: z.number().min(1).max(100).default(10)
    .describe("Batch size for bulk deletions"),
  continueOnError: z.boolean().default(false)
    .describe("Continue bulk operation on individual errors"),
    
  // Force options
  forceDelete: z.boolean().default(false)
    .describe("Force deletion even with dependencies"),
  deleteLinkedItems: z.boolean().default(false)
    .describe("Delete related work items if orphaned")
}
```

**Implementation Details**:
- Comprehensive dependency checking
- Batch processing for bulk operations
- Error handling and rollback capabilities
- Audit trail for deletions

### 4. Search Test Cases (`testcase_search_cases`)

**Purpose**: Advanced search capabilities across test cases with full-text search and filtering.

**Input Schema**:
```typescript
{
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
}
```

**Implementation Details**:
- Full-text search with relevance scoring
- Complex filtering with multiple criteria
- Efficient querying with proper indexing
- Flexible output formatting

### 5. Bulk Update Test Cases (`testcase_bulk_update`)

**Purpose**: Perform bulk updates on multiple test cases efficiently.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  
  // Target selection
  testCaseIds: z.array(z.number()).optional().describe("Specific test case IDs"),
  searchCriteria: z.object({
    // Reuse search parameters from testcase_search_cases
    searchText: z.string().optional(),
    planIds: z.array(z.number()).optional(),
    suiteIds: z.array(z.number()).optional(),
    state: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).optional().describe("Search criteria to select test cases"),
  
  // Updates to apply
  updates: z.object({
    // Field updates
    priority: z.number().min(1).max(4).optional().describe("New priority"),
    state: z.enum(["Design", "Ready", "Closed", "Active"]).optional()
      .describe("New state"),
    areaPath: z.string().optional().describe("New area path"),
    iterationPath: z.string().optional().describe("New iteration path"),
    
    // Tag operations
    addTags: z.array(z.string()).optional().describe("Tags to add"),
    removeTags: z.array(z.string()).optional().describe("Tags to remove"),
    replaceTags: z.array(z.string()).optional().describe("Replace all tags"),
    
    // Automation updates
    automationStatus: z.enum(["Not Automated", "Planned", "Automated"]).optional(),
    
    // Custom field updates
    customFields: z.record(z.string(), z.any()).optional(),
    
    // Prefix/suffix operations
    titlePrefix: z.string().optional().describe("Prefix to add to titles"),
    titleSuffix: z.string().optional().describe("Suffix to add to titles")
  }),
  
  // Operation options
  batchSize: z.number().min(1).max(100).default(25)
    .describe("Batch size for processing"),
  continueOnError: z.boolean().default(true)
    .describe("Continue on individual failures"),
  validateOnly: z.boolean().default(false)
    .describe("Validate updates without applying"),
  
  // Preview options
  previewChanges: z.boolean().default(false)
    .describe("Return preview of changes before applying"),
  maxPreviewCount: z.number().min(1).max(100).default(10)
    .describe("Maximum items to include in preview")
}
```

**Implementation Details**:
- Efficient batch processing
- Preview capabilities before applying changes
- Error handling and rollback support
- Progress tracking for large operations

### 6. Link Test Cases (`testcase_link_cases`)

**Purpose**: Manage relationships between test cases and other work items.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  sourceTestCaseId: z.number().describe("Source test case ID"),
  
  // Link operations
  links: z.array(z.object({
    action: z.enum(["add", "remove"]).describe("Link action"),
    targetId: z.number().describe("Target work item ID"),
    linkType: z.enum([
      "Related", "Parent", "Child", "Predecessor", "Successor",
      "Tested By", "Tests", "Duplicate", "Duplicate Of"
    ]).describe("Type of link"),
    comment: z.string().optional().describe("Link comment")
  })),
  
  // Batch options
  continueOnError: z.boolean().default(true).describe("Continue on link errors"),
  validateTargets: z.boolean().default(true).describe("Validate target work items exist")
}
```

**Implementation Details**:
- Support all standard Azure DevOps link types
- Validation of link relationships
- Batch link operations
- Comment support for links

### 7. Get Test Case Dependencies (`testcase_get_dependencies`)

**Purpose**: Analyze test case dependencies and relationships.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  testCaseId: z.number().describe("Test case ID"),
  
  // Analysis options
  includeIncomingLinks: z.boolean().default(true).describe("Include incoming links"),
  includeOutgoingLinks: z.boolean().default(true).describe("Include outgoing links"),
  includeSuiteAssignments: z.boolean().default(true).describe("Include suite assignments"),
  includeTestResults: z.boolean().default(false).describe("Include recent test results"),
  
  // Depth analysis
  linkDepth: z.number().min(1).max(3).default(1)
    .describe("Depth of link analysis"),
  includeTransitiveDependencies: z.boolean().default(false)
    .describe("Include transitive dependencies")
}
```

**Implementation Details**:
- Comprehensive dependency analysis
- Performance-optimized depth traversal
- Rich relationship mapping
- Impact analysis capabilities

### 8. Create Test Case Template (`testcase_create_template`)

**Purpose**: Create reusable test case templates for standardization.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  name: z.string().describe("Template name"),
  description: z.string().optional().describe("Template description"),
  category: z.string().optional().describe("Template category"),
  
  // Template content
  template: z.object({
    titlePattern: z.string().describe("Title pattern with placeholders"),
    defaultPriority: z.number().min(1).max(4).default(2),
    defaultTags: z.array(z.string()).optional(),
    
    // Step template
    stepTemplates: z.array(z.object({
      stepText: z.string().describe("Step template text"),
      expectedResult: z.string().describe("Expected result template"),
      placeholders: z.array(z.string()).optional().describe("Placeholder variables")
    })),
    
    // Field templates
    customFieldDefaults: z.record(z.string(), z.any()).optional(),
    areaPathPattern: z.string().optional(),
    iterationPathPattern: z.string().optional()
  }),
  
  // Template metadata
  tags: z.array(z.string()).optional().describe("Template tags"),
  isPublic: z.boolean().default(false).describe("Make template public"),
  allowModification: z.boolean().default(true).describe("Allow template modification")
}
```

**Implementation Details**:
- Template engine with placeholder support
- Category-based organization
- Public/private template management
- Version control for templates

### 9. Apply Test Case Template (`testcase_apply_template`)

**Purpose**: Create test cases from templates with variable substitution.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  templateId: z.number().describe("Template ID"),
  
  // Target location
  planId: z.number().optional().describe("Target test plan ID"),
  suiteId: z.number().optional().describe("Target test suite ID"),
  
  // Variable substitution
  variables: z.record(z.string(), z.string()).optional()
    .describe("Variable values for template placeholders"),
  
  // Override options
  overrides: z.object({
    title: z.string().optional(),
    priority: z.number().min(1).max(4).optional(),
    areaPath: z.string().optional(),
    iterationPath: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional().describe("Template field overrides"),
  
  // Creation options
  createCount: z.number().min(1).max(50).default(1)
    .describe("Number of test cases to create"),
  numberingPattern: z.string().optional()
    .describe("Pattern for numbering multiple cases")
}
```

**Implementation Details**:
- Advanced template processing
- Variable substitution engine
- Bulk creation from templates
- Override and customization support

### 10. Import Test Cases (`testcase_import_cases`)

**Purpose**: Import test cases from external formats and sources.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().optional().describe("Target test plan ID"),
  suiteId: z.number().optional().describe("Target test suite ID"),
  
  // Import source
  format: z.enum(["csv", "excel", "xml", "json"]).describe("Import format"),
  content: z.string().describe("Import content (base64 encoded or direct)"),
  
  // Mapping configuration
  fieldMapping: z.record(z.string(), z.string()).optional()
    .describe("Mapping of import fields to Azure DevOps fields"),
  
  // Import options
  createMissingAreas: z.boolean().default(false)
    .describe("Create missing area paths"),
  createMissingIterations: z.boolean().default(false)
    .describe("Create missing iteration paths"),
  skipDuplicates: z.boolean().default(true)
    .describe("Skip duplicate test cases"),
  duplicateDetection: z.enum(["title", "id", "hash"]).default("title")
    .describe("Method for duplicate detection"),
  
  // Error handling
  continueOnError: z.boolean().default(true)
    .describe("Continue import on individual errors"),
  maxErrors: z.number().min(1).max(100).default(10)
    .describe("Maximum errors before stopping"),
  
  // Validation
  validateOnly: z.boolean().default(false)
    .describe("Validate import without creating test cases"),
  showPreview: z.boolean().default(false)
    .describe("Show preview of imported data")
}
```

**Implementation Details**:
- Multiple format support
- Flexible field mapping
- Comprehensive validation
- Error recovery and reporting

### 11. Export Test Cases (`testcase_export_cases`)

**Purpose**: Export test cases to various formats for external use.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  
  // Selection criteria
  testCaseIds: z.array(z.number()).optional().describe("Specific test case IDs"),
  planIds: z.array(z.number()).optional().describe("Export from specific plans"),
  suiteIds: z.array(z.number()).optional().describe("Export from specific suites"),
  searchCriteria: z.object({
    // Reuse search parameters
  }).optional().describe("Search criteria for selection"),
  
  // Export format
  format: z.enum(["csv", "excel", "xml", "json", "pdf"]).describe("Export format"),
  
  // Export options
  includeSteps: z.boolean().default(true).describe("Include test steps"),
  includeAttachments: z.boolean().default(false).describe("Include attachments"),
  includeHistory: z.boolean().default(false).describe("Include change history"),
  includeLinks: z.boolean().default(false).describe("Include work item links"),
  includeResults: z.boolean().default(false).describe("Include test results"),
  
  // Formatting options
  template: z.string().optional().describe("Custom export template"),
  customFields: z.array(z.string()).optional()
    .describe("Additional custom fields to include"),
  
  // Output options
  fileName: z.string().optional().describe("Output file name"),
  compression: z.enum(["none", "zip", "gzip"]).default("none")
    .describe("Output compression")
}
```

**Implementation Details**:
- Multiple export formats
- Customizable content inclusion
- Template-based formatting
- Compression support for large exports

## Response Schemas & Error Handling

### Standard Response Format
```typescript
interface TestCaseResponse {
  content: [{ type: "text", text: string }];
  testCase?: TestCase;
  testCases?: TestCase[];
  results?: OperationResult[];
  pagination?: PaginationInfo;
  preview?: PreviewInfo;
  metadata?: {
    totalCount?: number;
    processedCount?: number;
    errorCount?: number;
    executionTime?: number;
    warnings?: string[];
  };
}
```

### Enhanced Test Case Object
```typescript
interface TestCase {
  id: number;
  title: string;
  state: "Design" | "Ready" | "Closed" | "Active";
  priority: number;
  
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
  
  // Statistics (optional)
  executionHistory?: ExecutionSummary;
}
```

## Performance & Scalability

### Optimization Strategies
1. **Batch Processing**: All bulk operations use configurable batch sizes
2. **Lazy Loading**: Optional expensive data (steps, attachments, history)
3. **Search Optimization**: Indexed full-text search with relevance scoring
4. **Caching**: Template and metadata caching for frequently accessed data

### Rate Limiting & Throttling
- Implement progressive backoff for bulk operations
- Queue management for concurrent operations
- Resource usage monitoring and alerting

## Integration & Extensibility

### Template System
- Plugin architecture for custom templates
- Variable substitution engine
- Template versioning and inheritance

### Custom Field Support
- Dynamic schema detection
- Type-safe custom field operations
- Validation rule support

### External Integrations
- REST API exposure for all operations
- Webhook support for real-time updates
- Standard export formats for popular tools

This comprehensive specification provides the foundation for implementing advanced test case management capabilities that will significantly enhance the testing workflow efficiency and provide powerful automation and integration opportunities.