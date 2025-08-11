# Test Suite Management Tools Specification

## Overview

This document provides detailed specifications for the test suite management tools that will be implemented in the `testsuites.ts` module. These tools form the core foundation of the comprehensive testing framework.

## Azure DevOps Test Suite API Reference

### Available Operations
- **Test Suites API**: Create, update, delete, and list test suites
- **Test Plans API**: Integration with test plans for suite management
- **Work Item Tracking API**: For requirement-based suites

## Tool Specifications

### 1. Create Test Suite (`testsuite_create_suite`)

**Purpose**: Create new test suites with support for different suite types and configurations.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID to create the suite in"),
  name: z.string().describe("Name of the test suite"),
  suiteType: z.enum(["StaticTestSuite", "DynamicTestSuite", "RequirementTestSuite"])
    .default("StaticTestSuite")
    .describe("Type of test suite to create"),
  parentSuiteId: z.number().optional().describe("Parent suite ID for nested suites"),
  description: z.string().optional().describe("Description of the test suite"),
  
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
}
```

**Implementation Details**:
- Validate suite type and required parameters
- Handle parent-child relationships
- Set up default configurations
- Support for all three suite types with appropriate validation

### 2. Update Test Suite (`testsuite_update_suite`)

**Purpose**: Update existing test suites including properties, configurations, and relationships.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID"),
  suiteId: z.number().describe("Test suite ID to update"),
  name: z.string().optional().describe("New name for the test suite"),
  description: z.string().optional().describe("New description"),
  
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
}
```

**Implementation Details**:
- Partial updates with validation
- Handle relationship changes safely
- Configuration management with add/remove operations
- State transitions with proper validation

### 3. Delete Test Suite (`testsuite_delete_suite`)

**Purpose**: Safely delete test suites with dependency checking and options for handling test cases.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID"),
  suiteId: z.number().describe("Test suite ID to delete"),
  deleteChildSuites: z.boolean().default(false)
    .describe("Whether to delete child suites"),
  preserveTestCases: z.boolean().default(true)
    .describe("Whether to preserve test cases in other suites"),
  forceDelete: z.boolean().default(false)
    .describe("Force deletion even with dependencies")
}
```

**Implementation Details**:
- Dependency checking before deletion
- Recursive deletion for child suites if requested
- Test case preservation logic
- Safety checks and confirmation requirements

### 4. List Test Suites (`testsuite_list_suites`)

**Purpose**: List and search test suites with comprehensive filtering and pagination.

**Input Schema**:
```typescript
{
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
  top: z.number().default(100).describe("Maximum number of results"),
  skip: z.number().default(0).describe("Number of results to skip"),
  continuationToken: z.string().optional().describe("Continuation token for pagination"),
  
  // Output options
  includeDetails: z.boolean().default(false)
    .describe("Include detailed suite information"),
  includeTestCaseCount: z.boolean().default(true)
    .describe("Include test case count in results"),
  includeChildCount: z.boolean().default(true)
    .describe("Include child suite count")
}
```

**Implementation Details**:
- Efficient filtering with proper indexing
- Hierarchical navigation support
- Pagination with continuation tokens
- Rich metadata in responses

### 5. Clone Test Suite (`testsuite_clone_suite`)

**Purpose**: Clone test suites with options for deep copying and cross-project cloning.

**Input Schema**:
```typescript
{
  sourceProject: z.string().describe("Source project ID or name"),
  sourcePlanId: z.number().describe("Source test plan ID"),
  sourceSuiteId: z.number().describe("Source test suite ID"),
  
  targetProject: z.string().describe("Target project ID or name"),
  targetPlanId: z.number().describe("Target test plan ID"),
  targetParentSuiteId: z.number().optional().describe("Target parent suite ID"),
  
  // Clone options
  newName: z.string().optional().describe("New name for cloned suite"),
  cloneTestCases: z.boolean().default(true)
    .describe("Whether to clone test cases"),
  cloneChildSuites: z.boolean().default(true)
    .describe("Whether to clone child suites"),
  cloneConfigurations: z.boolean().default(true)
    .describe("Whether to clone configurations"),
  
  // Mapping options
  configurationMapping: z.record(z.number(), z.number()).optional()
    .describe("Mapping of source to target configuration IDs"),
  areaPathMapping: z.string().optional()
    .describe("Target area path for cloned suite"),
  iterationPathMapping: z.string().optional()
    .describe("Target iteration path for cloned suite"),
    
  // Advanced options
  preserveLinks: z.boolean().default(false)
    .describe("Preserve links to original work items"),
  updateReferences: z.boolean().default(true)
    .describe("Update references to target project context")
}
```

**Implementation Details**:
- Cross-project cloning capabilities
- Deep vs. shallow cloning options
- Configuration and path mapping
- Reference updating logic

### 6. Get Suite Hierarchy (`testsuite_get_hierarchy`)

**Purpose**: Get complete test suite hierarchy for navigation and visualization.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID"),
  rootSuiteId: z.number().optional().describe("Root suite ID (default: plan root)"),
  maxDepth: z.number().default(10).describe("Maximum depth to traverse"),
  includeTestCases: z.boolean().default(false)
    .describe("Include test cases in hierarchy"),
  includeConfigurations: z.boolean().default(false)
    .describe("Include configuration details")
}
```

**Implementation Details**:
- Recursive hierarchy traversal
- Depth limiting for performance
- Rich metadata at each level
- Efficient tree structure response

### 7. Move Test Suite (`testsuite_move_suite`)

**Purpose**: Move test suites within hierarchy or between plans.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Current test plan ID"),
  suiteId: z.number().describe("Test suite ID to move"),
  
  targetPlanId: z.number().optional().describe("Target plan ID (for cross-plan moves)"),
  targetParentSuiteId: z.number().optional().describe("Target parent suite ID"),
  moveToRoot: z.boolean().default(false).describe("Move to plan root"),
  
  // Move options
  preserveConfigurations: z.boolean().default(true)
    .describe("Preserve suite configurations"),
  updateReferences: z.boolean().default(true)
    .describe("Update references after move"),
  position: z.number().optional().describe("Position in target parent")
}
```

**Implementation Details**:
- Cross-plan move capabilities
- Hierarchy validation
- Configuration preservation
- Reference updating

### 8. Get Suite Details (`testsuite_get_suite_details`)

**Purpose**: Get comprehensive details about a specific test suite.

**Input Schema**:
```typescript
{
  project: z.string().describe("Project ID or name"),
  planId: z.number().describe("Test plan ID"),
  suiteId: z.number().describe("Test suite ID"),
  includeTestCases: z.boolean().default(false)
    .describe("Include test case details"),
  includeConfigurations: z.boolean().default(true)
    .describe("Include configuration details"),
  includeHistory: z.boolean().default(false)
    .describe("Include modification history"),
  includeStatistics: z.boolean().default(true)
    .describe("Include suite statistics")
}
```

**Implementation Details**:
- Rich detail retrieval
- Optional expensive operations
- Statistics calculation
- History tracking

## Response Schemas

### Standard Response Format
```typescript
interface TestSuiteResponse {
  content: [{ type: "text", text: string }];
  suite?: TestSuite;
  suites?: TestSuite[];
  pagination?: PaginationInfo;
  metadata?: {
    totalCount?: number;
    executionTime?: number;
    warnings?: string[];
  };
}
```

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
  defaultConfigurations?: Configuration[];
  
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
  };
}
```

## Error Handling

### Common Error Scenarios
1. **Suite Not Found**: Detailed error with suggestions
2. **Permission Denied**: Clear permission requirements
3. **Invalid Parent Relationship**: Circular dependency detection
4. **Configuration Conflicts**: Configuration mapping issues
5. **Cross-Project Constraints**: Project-specific limitations

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
  };
}
```

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load detailed information only when requested
2. **Caching**: Cache frequently accessed suite hierarchies
3. **Batch Operations**: Support bulk operations for efficiency
4. **Pagination**: Implement efficient pagination for large datasets

### Rate Limiting
- Implement rate limiting for expensive operations
- Provide guidance on optimal usage patterns
- Queue management for bulk operations

## Security & Permissions

### Required Permissions
- **Read**: View test plans and test suites
- **Contribute**: Create and update test suites
- **Full Control**: Delete test suites and modify permissions

### Security Considerations
- Validate all input parameters
- Check permissions before operations
- Audit trail for all modifications
- Secure handling of cross-project operations

## Integration Points

### With Existing Tools
- **Test Plans**: Seamless integration with existing test plan tools
- **Test Cases**: Integration with enhanced test case management
- **Work Items**: Link to requirement work items

### External Integrations
- **REST API**: Expose all operations via REST endpoints
- **Webhooks**: Event notifications for suite changes
- **Export/Import**: Standard formats for data exchange

## Implementation Roadmap

### Phase 1.1: Core CRUD Operations
- Create, Read, Update, Delete operations
- Basic hierarchy management
- Essential validation and error handling

### Phase 1.2: Advanced Features
- Clone operations with cross-project support
- Advanced filtering and search
- Bulk operations and optimization

### Phase 1.3: Integration & Polish
- Integration with existing tools
- Performance optimization
- Comprehensive testing and documentation

## Testing Strategy

### Unit Tests
- Individual tool operation testing
- Schema validation testing
- Error handling scenarios
- Permission checking

### Integration Tests
- End-to-end workflow testing
- Cross-project operation testing
- Performance benchmark testing
- Load testing for bulk operations

### Test Data
- Sample test suites for different scenarios
- Performance test datasets
- Error condition test cases
- Cross-project test scenarios

## Documentation Requirements

### API Documentation
- Complete tool reference
- Schema documentation
- Error code reference
- Usage examples

### User Guides
- Common workflow examples
- Best practices
- Troubleshooting guide
- Migration scenarios

This specification provides the detailed foundation needed to implement comprehensive test suite management tools that will serve as the core of our testing framework.