import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  createTestingError,
  parseAzureDevOpsError,
  measureExecutionTime,
  validateNoCircularDependency,
  createToolResponse,
  convertStepsToXml,
  escapeXml,
  validateTestStepFormat,
  parseTestSteps,
  createWorkItemPatchDocument,
  buildQueryParams,
  processBatch,
  validateFieldName,
  createSafeFieldName,
  retryOperation,
  normalizeTags,
  generateOperationId,
  validateProjectIdentifier,
  createPaginationInfo,
  safeStringify
} from "../../../../src/tools/testing/utils.js";
import { ErrorCodes } from "../../../../src/tools/testing/schemas.js";

describe("Testing Utils", () => {
  describe("createTestingError", () => {
    it("should create a testing error with all properties", () => {
      const error = createTestingError(
        ErrorCodes.INVALID_INPUT,
        "Test error message",
        { detail: "test" },
        ["suggestion1", "suggestion2"]
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(ErrorCodes.INVALID_INPUT);
      expect(error.message).toBe("Test error message");
      expect(error.details).toEqual({ detail: "test" });
      expect(error.suggestions).toEqual(["suggestion1", "suggestion2"]);
    });

    it("should create a testing error with minimal properties", () => {
      const error = createTestingError(ErrorCodes.OPERATION_FAILED, "Simple error");

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(ErrorCodes.OPERATION_FAILED);
      expect(error.message).toBe("Simple error");
      expect(error.details).toBeUndefined();
      expect(error.suggestions).toBeUndefined();
    });
  });

  describe("parseAzureDevOpsError", () => {
    it("should parse error with response data", () => {
      const azureError = {
        response: {
          data: {
            message: "Azure DevOps API error",
            typeKey: "TestPlan"
          }
        }
      };

      const error = parseAzureDevOpsError(azureError);

      expect(error.code).toBe(ErrorCodes.OPERATION_FAILED);
      expect(error.message).toBe("Azure DevOps API error");
      expect(error.details).toEqual(azureError.response.data);
      expect(error.suggestions).toEqual(["Check TestPlan documentation"]);
    });

    it("should parse error with message only", () => {
      const azureError = {
        message: "Network error"
      };

      const error = parseAzureDevOpsError(azureError);

      expect(error.code).toBe(ErrorCodes.OPERATION_FAILED);
      expect(error.message).toBe("Network error");
      expect(error.details).toEqual(azureError);
    });

    it("should handle unknown error format", () => {
      const azureError = {};

      const error = parseAzureDevOpsError(azureError);

      expect(error.code).toBe(ErrorCodes.OPERATION_FAILED);
      expect(error.message).toBe("Unknown Azure DevOps API error");
      expect(error.details).toEqual(azureError);
    });
  });

  describe("measureExecutionTime", () => {
    it("should measure execution time of async operation", async () => {
      const testResult = "test result";
      const operation = async () => testResult;

      const result = await measureExecutionTime(operation);

      expect(result.result).toBe(testResult);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTime).toBe("number");
    });

    it("should handle operation that throws error", async () => {
      const testError = new Error("Test error");
      const operation = async () => {
        throw testError;
      };

      await expect(measureExecutionTime(operation)).rejects.toThrow(testError);
    });
  });

  describe("validateNoCircularDependency", () => {
    it("should detect direct circular dependency", () => {
      const hierarchy = new Map<number, number>();
      
      const isValid = validateNoCircularDependency(1, 1, hierarchy);
      
      expect(isValid).toBe(false);
    });

    it("should detect indirect circular dependency", () => {
      const hierarchy = new Map<number, number>([
        [2, 3],
        [3, 1]
      ]);
      
      const isValid = validateNoCircularDependency(1, 2, hierarchy);
      
      expect(isValid).toBe(false);
    });

    it("should allow valid hierarchy", () => {
      const hierarchy = new Map<number, number>([
        [2, 3],
        [3, 4]
      ]);
      
      const isValid = validateNoCircularDependency(1, 2, hierarchy);
      
      expect(isValid).toBe(true);
    });

    it("should handle empty hierarchy", () => {
      const hierarchy = new Map<number, number>();
      
      const isValid = validateNoCircularDependency(1, 2, hierarchy);
      
      expect(isValid).toBe(true);
    });
  });

  describe("createToolResponse", () => {
    it("should create response with data only", () => {
      const data = { test: "data" };
      
      const response = createToolResponse(data);
      
      expect(response.content).toEqual([{ type: "text", text: JSON.stringify(data, null, 2) }]);
      expect(response.data).toEqual(data);
      expect(response.metadata?.apiVersion).toBe("7.0");
      expect(response.metadata?.executionTime).toBeDefined();
    });

    it("should create response with all options", () => {
      const data = { test: "data" };
      const pagination = { hasMore: true, pageSize: 10, currentPage: 1 };
      const metadata = { totalCount: 100 };
      const message = "Custom message";
      
      const response = createToolResponse(data, { pagination, metadata, message });
      
      expect(response.content).toEqual([{ type: "text", text: message }]);
      expect(response.data).toEqual(data);
      expect(response.pagination).toEqual(pagination);
      expect(response.metadata?.totalCount).toBe(100);
      expect(response.metadata?.apiVersion).toBe("7.0");
    });
  });

  describe("convertStepsToXml", () => {
    it("should convert simple steps to XML", () => {
      const steps = "1. First step|Expected result 1\n2. Second step|Expected result 2";
      
      const xml = convertStepsToXml(steps);
      
      expect(xml).toContain('<steps id="0" last="2">');
      expect(xml).toContain('<step id="1" type="ActionStep">');
      expect(xml).toContain('<step id="2" type="ActionStep">');
      expect(xml).toContain('First step');
      expect(xml).toContain('Expected result 1');
      expect(xml).toContain('Second step');
      expect(xml).toContain('Expected result 2');
      expect(xml).toContain('</steps>');
    });

    it("should handle steps without expected results", () => {
      const steps = "1. Step without expected result";
      
      const xml = convertStepsToXml(steps);
      
      expect(xml).toContain('Step without expected result');
      expect(xml).toContain('Verify step completes successfully');
    });

    it("should return empty string for empty input", () => {
      expect(convertStepsToXml("")).toBe("");
      expect(convertStepsToXml("   ")).toBe("");
    });

    it("should handle XML special characters", () => {
      const steps = "1. Step with <tag> & \"quotes\"|Expected < > result";
      
      const xml = convertStepsToXml(steps);
      
      expect(xml).toContain('&lt;tag&gt; &amp; &quot;quotes&quot;');
      expect(xml).toContain('Expected &lt; &gt; result');
    });
  });

  describe("escapeXml", () => {
    it("should escape all XML special characters", () => {
      const input = '<>&\'"';
      const output = escapeXml(input);
      
      expect(output).toBe('&lt;&gt;&amp;&apos;&quot;');
    });

    it("should not modify safe text", () => {
      const input = "Safe text 123";
      const output = escapeXml(input);
      
      expect(output).toBe(input);
    });
  });

  describe("validateTestStepFormat", () => {
    it("should validate correct step format", () => {
      const steps = "1. First step|Expected result\n2. Second step|Another result";
      
      expect(validateTestStepFormat(steps)).toBe(true);
    });

    it("should validate steps without expected results", () => {
      const steps = "1. First step\n2. Second step";
      
      expect(validateTestStepFormat(steps)).toBe(true);
    });

    it("should allow empty steps", () => {
      expect(validateTestStepFormat("")).toBe(true);
      expect(validateTestStepFormat("   ")).toBe(true);
    });

    it("should reject invalid format", () => {
      const steps = "Invalid step format\nAnother invalid line";
      
      expect(validateTestStepFormat(steps)).toBe(false);
    });

    it("should handle mixed valid and empty lines", () => {
      const steps = "1. Valid step\n\n2. Another valid step";
      
      expect(validateTestStepFormat(steps)).toBe(true);
    });
  });

  describe("parseTestSteps", () => {
    it("should parse steps with expected results", () => {
      const steps = "1. First step|Expected result 1\n2. Second step|Expected result 2";
      
      const parsed = parseTestSteps(steps);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        stepText: "First step",
        expectedResult: "Expected result 1"
      });
      expect(parsed[1]).toEqual({
        stepText: "Second step",
        expectedResult: "Expected result 2"
      });
    });

    it("should handle steps without expected results", () => {
      const steps = "1. Step without expected result";
      
      const parsed = parseTestSteps(steps);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        stepText: "Step without expected result",
        expectedResult: "Verify step completes successfully"
      });
    });

    it("should return empty array for empty input", () => {
      expect(parseTestSteps("")).toEqual([]);
      expect(parseTestSteps("   ")).toEqual([]);
    });
  });

  describe("createWorkItemPatchDocument", () => {
    it("should create patch document with field paths", () => {
      const updates = {
        "System.Title": "New Title",
        "Microsoft.VSTS.Common.Priority": 1,
        "/fields/System.State": "Active"
      };
      
      const patch = createWorkItemPatchDocument(updates);
      
      expect(patch).toHaveLength(3);
      expect(patch[0]).toEqual({
        op: "add",
        path: "/fields/System.Title",
        value: "New Title"
      });
      expect(patch[1]).toEqual({
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: 1
      });
      expect(patch[2]).toEqual({
        op: "add",
        path: "/fields/System.State",
        value: "Active"
      });
    });

    it("should skip undefined and null values", () => {
      const updates = {
        "System.Title": "New Title",
        "System.Description": undefined,
        "System.State": null,
        "Microsoft.VSTS.Common.Priority": 0
      };
      
      const patch = createWorkItemPatchDocument(updates);
      
      expect(patch).toHaveLength(2);
      expect(patch.find(p => p.path.includes("Description"))).toBeUndefined();
      expect(patch.find(p => p.path.includes("State"))).toBeUndefined();
    });
  });

  describe("buildQueryParams", () => {
    it("should build query string from object", () => {
      const params = {
        project: "TestProject",
        top: 10,
        skip: 0,
        tags: ["tag1", "tag2"]
      };
      
      const queryString = buildQueryParams(params);
      
      expect(queryString).toContain("project=TestProject");
      expect(queryString).toContain("top=10");
      expect(queryString).toContain("skip=0");
      expect(queryString).toContain("tags=tag1%2Ctag2");
    });

    it("should skip undefined and null values", () => {
      const params = {
        project: "TestProject",
        top: undefined,
        skip: null,
        active: true
      };
      
      const queryString = buildQueryParams(params);
      
      expect(queryString).toContain("project=TestProject");
      expect(queryString).toContain("active=true");
      expect(queryString).not.toContain("top=");
      expect(queryString).not.toContain("skip=");
    });
  });

  describe("processBatch", () => {
    it("should process items in batches successfully", async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item: number) => item * 2;
      
      const result = await processBatch(items, processor, { batchSize: 2 });
      
      expect(result.results).toEqual([2, 4, 6, 8, 10]);
      expect(result.successCount).toBe(5);
      expect(result.totalCount).toBe(5);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle errors and continue processing", async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item: number) => {
        if (item === 3) throw new Error("Test error");
        return item * 2;
      };
      
      const result = await processBatch(items, processor, { continueOnError: true });
      
      expect(result.results).toEqual([2, 4, 8, 10]);
      expect(result.successCount).toBe(4);
      expect(result.totalCount).toBe(5);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Test error");
    });

    it("should stop on first error when continueOnError is false", async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (item: number) => {
        if (item === 3) throw new Error("Test error");
        return item * 2;
      };
      
      await expect(processBatch(items, processor, { continueOnError: false }))
        .rejects.toThrow("Test error");
    });

    it("should call progress callback", async () => {
      const items = [1, 2, 3];
      const processor = async (item: number) => item * 2;
      const onProgress = jest.fn();
      
      await processBatch(items, processor, { onProgress });
      
      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenCalledWith(1, 3);
      expect(onProgress).toHaveBeenCalledWith(2, 3);
      expect(onProgress).toHaveBeenCalledWith(3, 3);
    });
  });

  describe("validateFieldName", () => {
    it("should validate system fields", () => {
      expect(validateFieldName("System.Title")).toBe(true);
      expect(validateFieldName("System.State")).toBe(true);
    });

    it("should validate Microsoft VSTS fields", () => {
      expect(validateFieldName("Microsoft.VSTS.Common.Priority")).toBe(true);
      expect(validateFieldName("Microsoft.VSTS.TCM.Steps")).toBe(true);
    });

    it("should validate custom fields", () => {
      expect(validateFieldName("Custom.MyField")).toBe(true);
      expect(validateFieldName("Custom.Test_Field")).toBe(true);
    });

    it("should validate general field patterns", () => {
      expect(validateFieldName("MyCompany.CustomField")).toBe(true);
      expect(validateFieldName("Field123")).toBe(true);
    });

    it("should reject invalid field names", () => {
      expect(validateFieldName("123Invalid")).toBe(false);
      expect(validateFieldName("Field With Spaces")).toBe(false);
      expect(validateFieldName("Field@Invalid")).toBe(false);
    });
  });

  describe("createSafeFieldName", () => {
    it("should create safe field name with default prefix", () => {
      const safeName = createSafeFieldName("My Field Name");
      
      expect(safeName).toBe("Custom.MyFieldName");
    });

    it("should create safe field name with custom prefix", () => {
      const safeName = createSafeFieldName("Test Field", "MyCompany");
      
      expect(safeName).toBe("MyCompany.TestField");
    });

    it("should handle field names starting with numbers", () => {
      const safeName = createSafeFieldName("123Field");
      
      expect(safeName).toBe("Custom.Field");
    });

    it("should truncate long field names", () => {
      const longName = "A".repeat(200);
      const safeName = createSafeFieldName(longName);
      
      expect(safeName.length).toBeLessThanOrEqual(135); // Custom. + 128 chars
      expect(safeName.startsWith("Custom.")).toBe(true);
    });
  });

  describe("retryOperation", () => {
    it("should succeed on first attempt", async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return "success";
      };
      
      const result = await retryOperation(operation, 3, 100);
      
      expect(result).toBe("success");
      expect(callCount).toBe(1);
    });

    it("should retry and eventually succeed", async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error(`Fail ${callCount}`);
        }
        return "success";
      };
      
      const result = await retryOperation(operation, 3, 10);
      
      expect(result).toBe("success");
      expect(callCount).toBe(3);
    });

    it("should fail after max retries", async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new Error("Always fails");
      };
      
      await expect(retryOperation(operation, 2, 10))
        .rejects.toThrow("Always fails");
      
      expect(callCount).toBe(3); // Initial + 2 retries
    });
  });

  describe("normalizeTags", () => {
    it("should normalize valid tags", () => {
      const tags = ["  tag1  ", "tag2", "tag-3", "tag_4"];
      
      const normalized = normalizeTags(tags);
      
      expect(normalized).toEqual(["tag1", "tag2", "tag-3", "tag_4"]);
    });

    it("should filter out invalid tags", () => {
      const tags = ["valid", "invalid@tag", "", "also valid"];
      
      const normalized = normalizeTags(tags);
      
      expect(normalized).toEqual(["valid", "also valid"]);
    });

    it("should truncate long tags", () => {
      const longTag = "A".repeat(150);
      const tags = [longTag, "short"];
      
      const normalized = normalizeTags(tags);
      
      expect(normalized[0]).toHaveLength(100);
      expect(normalized[1]).toBe("short");
    });

    it("should handle empty input", () => {
      expect(normalizeTags([])).toEqual([]);
    });
  });

  describe("generateOperationId", () => {
    it("should generate unique operation IDs", () => {
      const id1 = generateOperationId();
      const id2 = generateOperationId();
      
      expect(id1).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("validateProjectIdentifier", () => {
    it("should validate GUID project IDs", () => {
      expect(validateProjectIdentifier("12345678-1234-1234-1234-123456789012")).toBe(true);
      expect(validateProjectIdentifier("12345678-1234-1234-1234-123456789012".toUpperCase())).toBe(true);
    });

    it("should validate project names", () => {
      expect(validateProjectIdentifier("MyProject")).toBe(true);
      expect(validateProjectIdentifier("Project-123")).toBe(true);
      expect(validateProjectIdentifier("Project_Name")).toBe(true);
      expect(validateProjectIdentifier("Project.Name")).toBe(true);
    });

    it("should reject invalid project identifiers", () => {
      expect(validateProjectIdentifier("")).toBe(false);
      expect(validateProjectIdentifier("   ")).toBe(false);
      expect(validateProjectIdentifier("Project Name")).toBe(false);
      expect(validateProjectIdentifier("-StartWithDash")).toBe(false);
      expect(validateProjectIdentifier("EndWithDash-")).toBe(false);
      expect(validateProjectIdentifier("A".repeat(70))).toBe(false);
    });
  });

  describe("createPaginationInfo", () => {
    it("should create pagination info with more data", () => {
      const pagination = createPaginationInfo([1, 2, 3, 4, 5], 5, 0, "token123");
      
      expect(pagination.hasMore).toBe(true);
      expect(pagination.continuationToken).toBe("token123");
      expect(pagination.pageSize).toBe(5);
      expect(pagination.currentPage).toBe(1);
    });

    it("should create pagination info without more data", () => {
      const pagination = createPaginationInfo([1, 2, 3], 5, 0);
      
      expect(pagination.hasMore).toBe(false);
      expect(pagination.continuationToken).toBeUndefined();
      expect(pagination.pageSize).toBe(5);
      expect(pagination.currentPage).toBe(1);
    });

    it("should calculate correct page number", () => {
      const pagination = createPaginationInfo([1, 2, 3], 5, 10);
      
      expect(pagination.currentPage).toBe(3); // (10 / 5) + 1
    });
  });

  describe("safeStringify", () => {
    it("should stringify normal objects", () => {
      const obj = { name: "test", value: 123 };
      
      const result = safeStringify(obj, 2);
      
      expect(result).toBe(JSON.stringify(obj, null, 2));
    });

    it("should handle Error objects", () => {
      const error = new Error("Test error");
      const obj = { error, other: "data" };
      
      const result = safeStringify(obj);
      
      expect(result).toContain("Test error");
      expect(result).toContain("Error");
      expect(result).toContain("other");
    });

    it("should handle circular references", () => {
      const obj: any = { name: "test" };
      obj.circular = obj;
      
      const result = safeStringify(obj);
      
      expect(result).toContain("[Error stringifying object:");
    });
  });
});