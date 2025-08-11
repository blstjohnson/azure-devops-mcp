import { describe, expect, it } from "@jest/globals";
import { z } from "zod";
import {
  projectValidation,
  idValidation,
  nameValidation,
  tagValidation,
  pathValidation,
  priorityValidation,
  paginationSchema,
  projectContextSchema,
  filteringSchema,
  suiteTypeEnum,
  suiteStateEnum,
  createTestSuiteSchema,
  updateTestSuiteSchema,
  deleteTestSuiteSchema,
  listTestSuitesSchema,
  cloneTestSuiteSchema,
  testCaseStateEnum,
  automationStatusEnum,
  stepUpdateSchema,
  attachmentUpdateSchema,
  updateTestCaseSchema,
  searchTestCasesSchema,
  ErrorCodes,
  TestingError,
  IdentityRef,
  TestStep,
  TestConfiguration,
  TestSuite,
  TestCase,
  OperationResult,
  PaginationInfo,
  ResponseMetadata,
  ToolResponse
} from "../../../../src/tools/testing/schemas.js";

describe("Testing Schemas", () => {
  describe("Common validation patterns", () => {
    describe("projectValidation", () => {
      it("should validate valid project names", () => {
        expect(() => projectValidation.parse("MyProject")).not.toThrow();
        expect(() => projectValidation.parse("Project-123")).not.toThrow();
        expect(() => projectValidation.parse("a")).not.toThrow();
      });

      it("should reject invalid project names", () => {
        expect(() => projectValidation.parse("")).toThrow();
        expect(() => projectValidation.parse("A".repeat(70))).toThrow();
      });
    });

    describe("idValidation", () => {
      it("should validate positive integers", () => {
        expect(() => idValidation.parse(1)).not.toThrow();
        expect(() => idValidation.parse(123456)).not.toThrow();
      });

      it("should reject invalid IDs", () => {
        expect(() => idValidation.parse(0)).toThrow();
        expect(() => idValidation.parse(-1)).toThrow();
        expect(() => idValidation.parse(1.5)).toThrow();
        expect(() => idValidation.parse("123")).toThrow();
      });
    });

    describe("nameValidation", () => {
      it("should validate valid names", () => {
        expect(() => nameValidation.parse("Valid Name")).not.toThrow();
        expect(() => nameValidation.parse("Test-123")).not.toThrow();
        expect(() => nameValidation.parse("a")).not.toThrow();
      });

      it("should reject invalid names", () => {
        expect(() => nameValidation.parse("")).toThrow();
        expect(() => nameValidation.parse("Name<with>invalid")).toThrow();
        expect(() => nameValidation.parse("Name|with|pipes")).toThrow();
        expect(() => nameValidation.parse("A".repeat(300))).toThrow();
      });
    });

    describe("tagValidation", () => {
      it("should validate valid tags", () => {
        expect(() => tagValidation.parse("tag")).not.toThrow();
        expect(() => tagValidation.parse("tag-123")).not.toThrow();
        expect(() => tagValidation.parse("tag_name")).not.toThrow();
        expect(() => tagValidation.parse("tag with spaces")).not.toThrow();
      });

      it("should reject invalid tags", () => {
        expect(() => tagValidation.parse("")).toThrow();
        expect(() => tagValidation.parse("tag@invalid")).toThrow();
        expect(() => tagValidation.parse("A".repeat(150))).toThrow();
      });
    });

    describe("pathValidation", () => {
      it("should validate valid paths", () => {
        expect(() => pathValidation.parse("Project\\Area")).not.toThrow();
        expect(() => pathValidation.parse("Project/Area/SubArea")).not.toThrow();
      });

      it("should reject invalid paths", () => {
        expect(() => pathValidation.parse("Path<invalid>")).toThrow();
        expect(() => pathValidation.parse("Path|invalid")).toThrow();
        expect(() => pathValidation.parse("Path*invalid")).toThrow();
      });
    });

    describe("priorityValidation", () => {
      it("should validate valid priorities", () => {
        expect(() => priorityValidation.parse(1)).not.toThrow();
        expect(() => priorityValidation.parse(2)).not.toThrow();
        expect(() => priorityValidation.parse(3)).not.toThrow();
        expect(() => priorityValidation.parse(4)).not.toThrow();
      });

      it("should reject invalid priorities", () => {
        expect(() => priorityValidation.parse(0)).toThrow();
        expect(() => priorityValidation.parse(5)).toThrow();
        expect(() => priorityValidation.parse(1.5)).toThrow();
      });
    });
  });

  describe("Base schemas", () => {
    describe("paginationSchema", () => {
      it("should validate with default values", () => {
        const result = paginationSchema.parse({});
        expect(result.top).toBe(100);
        expect(result.skip).toBe(0);
      });

      it("should validate with custom values", () => {
        const input = { top: 50, skip: 10, continuationToken: "token123" };
        const result = paginationSchema.parse(input);
        expect(result.top).toBe(50);
        expect(result.skip).toBe(10);
        expect(result.continuationToken).toBe("token123");
      });

      it("should reject invalid values", () => {
        expect(() => paginationSchema.parse({ top: 0 })).toThrow();
        expect(() => paginationSchema.parse({ top: 1001 })).toThrow();
        expect(() => paginationSchema.parse({ skip: -1 })).toThrow();
      });
    });

    describe("projectContextSchema", () => {
      it("should validate minimal context", () => {
        const input = { project: "TestProject" };
        const result = projectContextSchema.parse(input);
        expect(result.project).toBe("TestProject");
      });

      it("should validate full context", () => {
        const input = { project: "TestProject", planId: 123, suiteId: 456 };
        const result = projectContextSchema.parse(input);
        expect(result.project).toBe("TestProject");
        expect(result.planId).toBe(123);
        expect(result.suiteId).toBe(456);
      });
    });

    describe("filteringSchema", () => {
      it("should validate with optional filters", () => {
        const input = {
          nameFilter: "test",
          tags: ["tag1", "tag2"],
          createdAfter: new Date("2023-01-01")
        };
        const result = filteringSchema.parse(input);
        expect(result.nameFilter).toBe("test");
        expect(result.tags).toEqual(["tag1", "tag2"]);
        expect(result.createdAfter).toBeInstanceOf(Date);
      });

      it("should coerce date strings", () => {
        const input = { createdAfter: "2023-01-01" };
        const result = filteringSchema.parse(input);
        expect(result.createdAfter).toBeInstanceOf(Date);
      });
    });
  });

  describe("Test Suite Schemas", () => {
    describe("suiteTypeEnum", () => {
      it("should validate valid suite types", () => {
        expect(() => suiteTypeEnum.parse("StaticTestSuite")).not.toThrow();
        expect(() => suiteTypeEnum.parse("DynamicTestSuite")).not.toThrow();
        expect(() => suiteTypeEnum.parse("RequirementTestSuite")).not.toThrow();
      });

      it("should reject invalid suite types", () => {
        expect(() => suiteTypeEnum.parse("InvalidSuite")).toThrow();
      });
    });

    describe("createTestSuiteSchema", () => {
      it("should validate static test suite creation", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          name: "Test Suite",
          suiteType: "StaticTestSuite" as const
        };
        const result = createTestSuiteSchema.parse(input);
        expect(result.suiteType).toBe("StaticTestSuite");
      });

      it("should validate dynamic test suite with query", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          name: "Dynamic Suite",
          suiteType: "DynamicTestSuite" as const,
          queryString: "[System.WorkItemType] = 'Test Case'"
        };
        const result = createTestSuiteSchema.parse(input);
        expect(result.suiteType).toBe("DynamicTestSuite");
        expect(result.queryString).toBeDefined();
      });

      it("should validate requirement test suite with requirement ID", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          name: "Requirement Suite",
          suiteType: "RequirementTestSuite" as const,
          requirementId: 789
        };
        const result = createTestSuiteSchema.parse(input);
        expect(result.suiteType).toBe("RequirementTestSuite");
        expect(result.requirementId).toBe(789);
      });

      it("should reject dynamic suite without query string", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          name: "Dynamic Suite",
          suiteType: "DynamicTestSuite" as const
        };
        expect(() => createTestSuiteSchema.parse(input)).toThrow();
      });

      it("should reject requirement suite without requirement ID", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          name: "Requirement Suite",
          suiteType: "RequirementTestSuite" as const
        };
        expect(() => createTestSuiteSchema.parse(input)).toThrow();
      });

      it("should validate with optional properties", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          name: "Test Suite",
          description: "Suite description",
          parentSuiteId: 456,
          tags: ["tag1", "tag2"],
          areaPath: "Project\\Area",
          iterationPath: "Project\\Iteration"
        };
        const result = createTestSuiteSchema.parse(input);
        expect(result.description).toBe("Suite description");
        expect(result.tags).toEqual(["tag1", "tag2"]);
      });
    });

    describe("updateTestSuiteSchema", () => {
      it("should validate minimal update", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          suiteId: 456
        };
        const result = updateTestSuiteSchema.parse(input);
        expect(result.moveToRoot).toBe(false);
      });

      it("should validate full update", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          suiteId: 456,
          name: "Updated Suite",
          description: "Updated description",
          parentSuiteId: 789,
          queryString: "Updated query",
          tags: ["updated-tag"],
          state: "Active" as const
        };
        const result = updateTestSuiteSchema.parse(input);
        expect(result.name).toBe("Updated Suite");
        expect(result.state).toBe("Active");
      });
    });

    describe("deleteTestSuiteSchema", () => {
      it("should validate with defaults", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          suiteId: 456
        };
        const result = deleteTestSuiteSchema.parse(input);
        expect(result.deleteChildSuites).toBe(false);
        expect(result.preserveTestCases).toBe(true);
        expect(result.forceDelete).toBe(false);
      });

      it("should validate with options", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          suiteId: 456,
          deleteChildSuites: true,
          preserveTestCases: false,
          forceDelete: true
        };
        const result = deleteTestSuiteSchema.parse(input);
        expect(result.deleteChildSuites).toBe(true);
        expect(result.preserveTestCases).toBe(false);
        expect(result.forceDelete).toBe(true);
      });
    });

    describe("listTestSuitesSchema", () => {
      it("should validate with defaults", () => {
        const input = { project: "TestProject" };
        const result = listTestSuitesSchema.parse(input);
        expect(result.includeChildSuites).toBe(false);
        expect(result.state).toBe("Active");
        expect(result.includeDetails).toBe(false);
        expect(result.top).toBe(100);
        expect(result.skip).toBe(0);
      });

      it("should validate with filters", () => {
        const input = {
          project: "TestProject",
          planId: 123,
          suiteType: "StaticTestSuite" as const,
          state: "All" as const,
          nameFilter: "test",
          top: 50
        };
        const result = listTestSuitesSchema.parse(input);
        expect(result.planId).toBe(123);
        expect(result.suiteType).toBe("StaticTestSuite");
        expect(result.state).toBe("All");
      });
    });

    describe("cloneTestSuiteSchema", () => {
      it("should validate minimal clone", () => {
        const input = {
          sourceProject: "SourceProject",
          sourcePlanId: 123,
          sourceSuiteId: 456,
          targetProject: "TargetProject",
          targetPlanId: 789
        };
        const result = cloneTestSuiteSchema.parse(input);
        expect(result.cloneTestCases).toBe(true);
        expect(result.cloneChildSuites).toBe(true);
        expect(result.preserveLinks).toBe(false);
      });

      it("should validate with options", () => {
        const input = {
          sourceProject: "SourceProject",
          sourcePlanId: 123,
          sourceSuiteId: 456,
          targetProject: "TargetProject",
          targetPlanId: 789,
          newName: "Cloned Suite",
          cloneTestCases: false,
          preserveLinks: true,
          configurationMapping: { 1: 2, 3: 4 }
        };
        const result = cloneTestSuiteSchema.parse(input);
        expect(result.newName).toBe("Cloned Suite");
        expect(result.cloneTestCases).toBe(false);
        expect(result.preserveLinks).toBe(true);
        expect(result.configurationMapping).toEqual({ 1: 2, 3: 4 });
      });
    });
  });

  describe("Test Case Schemas", () => {
    describe("testCaseStateEnum", () => {
      it("should validate valid test case states", () => {
        expect(() => testCaseStateEnum.parse("Design")).not.toThrow();
        expect(() => testCaseStateEnum.parse("Ready")).not.toThrow();
        expect(() => testCaseStateEnum.parse("Closed")).not.toThrow();
        expect(() => testCaseStateEnum.parse("Active")).not.toThrow();
      });

      it("should reject invalid states", () => {
        expect(() => testCaseStateEnum.parse("Invalid")).toThrow();
      });
    });

    describe("automationStatusEnum", () => {
      it("should validate valid automation statuses", () => {
        expect(() => automationStatusEnum.parse("Not Automated")).not.toThrow();
        expect(() => automationStatusEnum.parse("Planned")).not.toThrow();
        expect(() => automationStatusEnum.parse("Automated")).not.toThrow();
      });

      it("should reject invalid statuses", () => {
        expect(() => automationStatusEnum.parse("Invalid")).toThrow();
      });
    });

    describe("stepUpdateSchema", () => {
      it("should validate step update", () => {
        const input = {
          action: "add" as const,
          stepText: "New step",
          expectedResult: "Expected result",
          position: 1
        };
        const result = stepUpdateSchema.parse(input);
        expect(result.action).toBe("add");
        expect(result.stepText).toBe("New step");
      });

      it("should validate delete action", () => {
        const input = {
          id: 123,
          action: "delete" as const
        };
        const result = stepUpdateSchema.parse(input);
        expect(result.action).toBe("delete");
        expect(result.id).toBe(123);
      });
    });

    describe("attachmentUpdateSchema", () => {
      it("should validate add attachment", () => {
        const input = {
          action: "add" as const,
          name: "screenshot.png",
          content: "base64content"
        };
        const result = attachmentUpdateSchema.parse(input);
        expect(result.action).toBe("add");
        expect(result.name).toBe("screenshot.png");
      });

      it("should validate remove attachment", () => {
        const input = {
          action: "remove" as const,
          name: "old-file.pdf",
          url: "http://example.com/file.pdf"
        };
        const result = attachmentUpdateSchema.parse(input);
        expect(result.action).toBe("remove");
        expect(result.name).toBe("old-file.pdf");
      });
    });

    describe("updateTestCaseSchema", () => {
      it("should validate minimal update", () => {
        const input = {
          project: "TestProject",
          testCaseId: 123
        };
        const result = updateTestCaseSchema.parse(input);
        expect(result.project).toBe("TestProject");
        expect(result.testCaseId).toBe(123);
      });

      it("should validate full update", () => {
        const input = {
          project: "TestProject",
          testCaseId: 123,
          title: "Updated Title",
          description: "Updated description",
          priority: 2,
          steps: "1. Step one|Expected one\n2. Step two|Expected two",
          areaPath: "Project\\Area",
          iterationPath: "Project\\Iteration",
          tags: ["tag1", "tag2"],
          state: "Ready" as const,
          automationStatus: "Automated" as const,
          automatedTestName: "TestMethod",
          customFields: { "Custom.Field": "value" }
        };
        const result = updateTestCaseSchema.parse(input);
        expect(result.title).toBe("Updated Title");
        expect(result.priority).toBe(2);
        expect(result.state).toBe("Ready");
        expect(result.automationStatus).toBe("Automated");
      });
    });

    describe("searchTestCasesSchema", () => {
      it("should validate basic search", () => {
        const input = {
          project: "TestProject",
          searchText: "test search"
        };
        const result = searchTestCasesSchema.parse(input);
        expect(result.searchText).toBe("test search");
        expect(result.top).toBe(100);
        expect(result.skip).toBe(0);
        expect(result.searchInSteps).toBe(true);
        expect(result.sortBy).toBe("id");
        expect(result.sortOrder).toBe("asc");
      });

      it("should validate advanced search", () => {
        const input = {
          project: "TestProject",
          titleFilter: "Login*",
          planIds: [1, 2, 3],
          state: ["Active", "Ready"],
          priority: [1, 2],
          tags: ["smoke", "regression"],
          automationStatus: ["Automated"],
          includeSteps: true,
          sortBy: "priority" as const,
          sortOrder: "desc" as const,
          top: 50
        };
        const result = searchTestCasesSchema.parse(input);
        expect(result.titleFilter).toBe("Login*");
        expect(result.planIds).toEqual([1, 2, 3]);
        expect(result.state).toEqual(["Active", "Ready"]);
        expect(result.sortBy).toBe("priority");
        expect(result.sortOrder).toBe("desc");
      });
    });
  });

  describe("Error Types", () => {
    describe("ErrorCodes", () => {
      it("should contain all expected error codes", () => {
        expect(ErrorCodes.INVALID_INPUT).toBe("INVALID_INPUT");
        expect(ErrorCodes.MISSING_REQUIRED_FIELD).toBe("MISSING_REQUIRED_FIELD");
        expect(ErrorCodes.RESOURCE_NOT_FOUND).toBe("RESOURCE_NOT_FOUND");
        expect(ErrorCodes.OPERATION_FAILED).toBe("OPERATION_FAILED");
        expect(ErrorCodes.CIRCULAR_DEPENDENCY).toBe("CIRCULAR_DEPENDENCY");
        expect(ErrorCodes.ACCESS_DENIED).toBe("ACCESS_DENIED");
      });
    });
  });

  describe("Interface Types", () => {
    describe("IdentityRef", () => {
      it("should define identity reference structure", () => {
        const identity: IdentityRef = {
          id: "user-id",
          displayName: "John Doe",
          uniqueName: "john.doe@example.com",
          imageUrl: "http://example.com/avatar.jpg"
        };
        expect(identity.id).toBe("user-id");
        expect(identity.displayName).toBe("John Doe");
      });
    });

    describe("TestStep", () => {
      it("should define test step structure", () => {
        const step: TestStep = {
          stepNumber: 1,
          action: "Click login button",
          expectedResult: "Login form appears"
        };
        expect(step.stepNumber).toBe(1);
        expect(step.action).toBe("Click login button");
      });
    });

    describe("TestConfiguration", () => {
      it("should define test configuration structure", () => {
        const config: TestConfiguration = {
          id: 1,
          name: "Windows 10 Chrome",
          isDefault: true,
          state: "Active",
          variables: []
        };
        expect(config.id).toBe(1);
        expect(config.state).toBe("Active");
      });
    });

    describe("TestSuite", () => {
      it("should define test suite structure", () => {
        const suite: TestSuite = {
          id: 1,
          name: "Login Tests",
          suiteType: "StaticTestSuite",
          state: "Active",
          plan: { id: 123, name: "Test Plan" }
        };
        expect(suite.id).toBe(1);
        expect(suite.suiteType).toBe("StaticTestSuite");
      });
    });

    describe("TestCase", () => {
      it("should define test case structure", () => {
        const testCase: TestCase = {
          id: 1,
          title: "Login Test",
          state: "Active",
          priority: 1,
          areaPath: "Project\\Area",
          iterationPath: "Project\\Iteration",
          automationStatus: "Not Automated",
          createdBy: { id: "user1", displayName: "User 1" },
          createdDate: new Date(),
          lastModifiedBy: { id: "user2", displayName: "User 2" },
          lastModifiedDate: new Date(),
          revision: 1
        };
        expect(testCase.id).toBe(1);
        expect(testCase.state).toBe("Active");
        expect(testCase.priority).toBe(1);
      });
    });

    describe("OperationResult", () => {
      it("should define operation result structure", () => {
        const result: OperationResult = {
          success: true,
          id: 123,
          message: "Operation completed successfully"
        };
        expect(result.success).toBe(true);
        expect(result.id).toBe(123);
      });
    });

    describe("PaginationInfo", () => {
      it("should define pagination info structure", () => {
        const pagination: PaginationInfo = {
          hasMore: true,
          pageSize: 50,
          currentPage: 2,
          continuationToken: "token123",
          totalCount: 200
        };
        expect(pagination.hasMore).toBe(true);
        expect(pagination.pageSize).toBe(50);
      });
    });

    describe("ResponseMetadata", () => {
      it("should define response metadata structure", () => {
        const metadata: ResponseMetadata = {
          totalCount: 100,
          processedCount: 95,
          errorCount: 5,
          executionTime: 1500,
          apiVersion: "7.0",
          warnings: ["Warning message"]
        };
        expect(metadata.totalCount).toBe(100);
        expect(metadata.apiVersion).toBe("7.0");
      });
    });

    describe("ToolResponse", () => {
      it("should define tool response structure", () => {
        const response: ToolResponse<string> = {
          content: [{ type: "text", text: "Response text" }],
          data: "response data",
          pagination: {
            hasMore: false,
            pageSize: 10,
            currentPage: 1
          },
          metadata: {
            executionTime: 500,
            apiVersion: "7.0"
          }
        };
        expect(response.content[0].text).toBe("Response text");
        expect(response.data).toBe("response data");
      });
    });
  });
});