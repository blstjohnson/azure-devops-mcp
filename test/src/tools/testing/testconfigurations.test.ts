// Copyright (c) eKassir ltd.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { AccessToken } from "@azure/identity";
import { configureTestConfigurationTools } from "../../../../src/tools/testing/testconfigurations.js";
import { ErrorCodes } from "../../../../src/tools/testing/schemas.js";

// Mock Azure DevOps API
const mockTestApi = {
  createTestConfiguration: jest.fn(),
  updateTestConfiguration: jest.fn(),
  getTestConfiguration: jest.fn(),
  getTestConfigurations: jest.fn(),
  deleteTestConfiguration: jest.fn()
};

const mockWorkItemApi = {
  createWorkItem: jest.fn(),
  updateWorkItem: jest.fn(),
  getWorkItem: jest.fn(),
  getWorkItems: jest.fn(),
  deleteWorkItem: jest.fn(),
  queryByWiql: jest.fn()
};

const mockConnection = {
  getTestApi: jest.fn().mockResolvedValue(mockTestApi),
  getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWorkItemApi)
} as unknown as WebApi;

const mockTokenProvider = jest.fn().mockResolvedValue({ token: "mock-token" } as AccessToken);
const mockConnectionProvider = jest.fn().mockResolvedValue(mockConnection);

describe("Test Configuration Tools", () => {
  let server: McpServer;
  let toolHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    server = {
      tool: jest.fn((name, description, schema, handler) => {
        toolHandler = handler;
      })
    } as unknown as McpServer;

    configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
  });

  describe("testconfig_create_configuration", () => {
    beforeEach(() => {
      // Reset the server.tool mock to capture the create configuration handler
      (server.tool as jest.Mock).mockClear();
      configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
      // Get the first call (create configuration tool)
      toolHandler = (server.tool as jest.Mock).mock.calls[0][3];
    });

    it("should create a test configuration successfully", async () => {
      const mockWorkItem = {
        id: 123,
        fields: {
          "System.Title": "Test Configuration: MyConfig",
          "Custom.ConfigurationName": "MyConfig"
        }
      };

      mockWorkItemApi.createWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        name: "MyConfig",
        description: "Test configuration",
        environment: "Development" as const,
        variables: [
          {
            name: "testVar",
            value: "testValue",
            type: "string" as const,
            isSecret: false,
            description: "Test variable"
          }
        ],
        settings: {
          timeout: 300,
          retryAttempts: 3,
          parallelExecution: false,
          captureScreenshots: true,
          generateReports: true,
          cleanupAfterRun: true
        },
        tags: ["test", "config"],
        category: "TestCategory"
      };

      const result = await toolHandler(params);

      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/System.Title",
            value: "Test Configuration: MyConfig"
          }),
          expect.objectContaining({
            op: "add",
            path: "/fields/Custom.ConfigurationName",
            value: "MyConfig"
          })
        ]),
        "TestProject",
        "Task"
      );

      expect(result.content[0].text).toContain("MyConfig");
      expect(result.content[0].text).toContain("TestProject");
    });

    it("should validate variable name uniqueness", async () => {
      const params = {
        project: "TestProject",
        name: "MyConfig",
        description: "Test configuration",
        environment: "Development" as const,
        variables: [
          {
            name: "testVar",
            value: "testValue1",
            type: "string" as const,
            isSecret: false
          },
          {
            name: "testVar", // Duplicate name
            value: "testValue2",
            type: "string" as const,
            isSecret: false
          }
        ]
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });

    it("should handle missing required fields", async () => {
      const params = {
        project: "", // Empty project
        name: "MyConfig",
        environment: "Development" as const
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });
  });

  describe("testconfig_update_configuration", () => {
    beforeEach(() => {
      (server.tool as jest.Mock).mockClear();
      configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
      // Get the second call (update configuration tool)
      toolHandler = (server.tool as jest.Mock).mock.calls[1][3];
    });

    it("should update a test configuration successfully", async () => {
      const mockCurrentWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationType": "TestConfiguration",
          "Custom.ConfigurationName": "OldName",
          "System.Description": "Old description"
        }
      };

      const mockUpdatedWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationName": "NewName",
          "System.Description": "New description"
        }
      };

      mockWorkItemApi.getWorkItem
        .mockResolvedValueOnce(mockCurrentWorkItem)  // First call to get current item
        .mockResolvedValueOnce(mockUpdatedWorkItem); // Second call to get updated item
      mockWorkItemApi.updateWorkItem.mockResolvedValue(mockUpdatedWorkItem);

      const params = {
        project: "TestProject",
        configurationId: 123,
        name: "NewName",
        description: "New description",
        environment: "Test" as const
      };

      const result = await toolHandler(params);

      expect(mockWorkItemApi.getWorkItem).toHaveBeenCalledWith(123);
      expect(mockWorkItemApi.updateWorkItem).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            op: "replace",
            path: "/fields/System.Title",
            value: "Test Configuration: NewName"
          })
        ]),
        123
      );

      expect(result.content[0].text).toContain("NewName");
    });

    it("should handle configuration not found", async () => {
      mockWorkItemApi.getWorkItem.mockResolvedValue(null);

      const params = {
        project: "TestProject",
        configurationId: 999,
        name: "NewName"
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });

    it("should handle non-configuration work item", async () => {
      const mockWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationType": "SomethingElse"
        }
      };

      mockWorkItemApi.getWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        configurationId: 123,
        name: "NewName"
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });
  });

  describe("testconfig_list_configurations", () => {
    beforeEach(() => {
      (server.tool as jest.Mock).mockClear();
      configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
      // Get the third call (list configurations tool)
      toolHandler = (server.tool as jest.Mock).mock.calls[2][3];
    });

    it("should list configurations successfully", async () => {
      const mockQueryResult = {
        workItems: [
          { id: 123 },
          { id: 124 }
        ]
      };

      const mockWorkItems = [
        {
          id: 123,
          fields: {
            "Custom.ConfigurationName": "Config1",
            "Custom.Environment": "Development",
            "System.Description": "First config",
            "Custom.Category": "Category1",
            "System.Tags": "tag1; tag2"
          }
        },
        {
          id: 124,
          fields: {
            "Custom.ConfigurationName": "Config2",
            "Custom.Environment": "Test",
            "System.Description": "Second config",
            "Custom.Category": "Category2",
            "System.Tags": "tag3; tag4"
          }
        }
      ];

      mockWorkItemApi.queryByWiql.mockResolvedValue(mockQueryResult);
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockWorkItems);

      const params = {
        project: "TestProject",
        top: 10,
        skip: 0,
        includeVariables: false,
        includeSettings: false
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(mockWorkItemApi.queryByWiql).toHaveBeenCalled();
      expect(mockWorkItemApi.getWorkItems).toHaveBeenCalledWith([123, 124]);
      expect(parsedResult.configurations).toHaveLength(2);
      expect(parsedResult.configurations[0].name).toBe("Config1");
      expect(parsedResult.configurations[1].name).toBe("Config2");
    });

    it("should handle empty results", async () => {
      const mockQueryResult = {
        workItems: []
      };

      mockWorkItemApi.queryByWiql.mockResolvedValue(mockQueryResult);

      const params = {
        project: "TestProject",
        top: 10,
        skip: 0
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.configurations).toHaveLength(0);
      expect(parsedResult.totalCount).toBe(0);
    });

    it("should apply environment filter", async () => {
      const mockQueryResult = {
        workItems: [{ id: 123 }]
      };

      const mockWorkItems = [
        {
          id: 123,
          fields: {
            "Custom.ConfigurationName": "Config1",
            "Custom.Environment": "Development"
          }
        }
      ];

      mockWorkItemApi.queryByWiql.mockResolvedValue(mockQueryResult);
      mockWorkItemApi.getWorkItems.mockResolvedValue(mockWorkItems);

      const params = {
        project: "TestProject",
        environment: ["Development"],
        top: 10,
        skip: 0
      };

      await toolHandler(params);

      const queryCall = mockWorkItemApi.queryByWiql.mock.calls[0][0];
      expect(queryCall.query).toContain("AND [Custom.Environment] IN ('Development')");
    });
  });

  describe("testconfig_delete_configuration", () => {
    beforeEach(() => {
      (server.tool as jest.Mock).mockClear();
      configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
      // Get the fourth call (delete configuration tool)
      toolHandler = (server.tool as jest.Mock).mock.calls[3][3];
    });

    it("should delete configuration successfully", async () => {
      const mockWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationType": "TestConfiguration",
          "Custom.ConfigurationName": "ConfigToDelete",
          "System.State": "Active"
        }
      };

      mockWorkItemApi.getWorkItem.mockResolvedValue(mockWorkItem);
      mockWorkItemApi.deleteWorkItem.mockResolvedValue(undefined);

      const params = {
        project: "TestProject",
        configurationId: 123,
        forceDelete: false,
        createBackup: true,
        checkDependencies: true
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(mockWorkItemApi.getWorkItem).toHaveBeenCalledWith(123);
      expect(mockWorkItemApi.deleteWorkItem).toHaveBeenCalledWith(123);
      expect(parsedResult.deletedConfiguration.id).toBe(123);
      expect(parsedResult.backup.created).toBe(true);
    });

    it("should handle configuration not found", async () => {
      mockWorkItemApi.getWorkItem.mockResolvedValue(null);

      const params = {
        project: "TestProject",
        configurationId: 999,
        forceDelete: false,
        createBackup: true,
        checkDependencies: true
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });
  });

  describe("testconfig_clone_configuration", () => {
    beforeEach(() => {
      (server.tool as jest.Mock).mockClear();
      configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
      // Get the fifth call (clone configuration tool)
      toolHandler = (server.tool as jest.Mock).mock.calls[4][3];
    });

    it("should clone configuration successfully", async () => {
      const mockSourceWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationType": "TestConfiguration",
          "Custom.ConfigurationName": "SourceConfig",
          "Custom.Environment": "Development",
          "Custom.Variables": JSON.stringify([
            { name: "var1", value: "value1", type: "string", isSecret: false }
          ]),
          "Custom.Settings": JSON.stringify({ timeout: 300 }),
          "System.Tags": "tag1; tag2"
        }
      };

      const mockClonedWorkItem = {
        id: 124,
        fields: {
          "Custom.ConfigurationName": "ClonedConfig"
        }
      };

      mockWorkItemApi.getWorkItem.mockResolvedValue(mockSourceWorkItem);
      mockWorkItemApi.createWorkItem.mockResolvedValue(mockClonedWorkItem);

      const params = {
        sourceProject: "SourceProject",
        sourceConfigurationId: 123,
        targetProject: "TargetProject",
        newName: "ClonedConfig",
        newDescription: "Cloned configuration",
        cloneVariables: true,
        cloneSettings: true,
        cloneTags: true,
        targetEnvironment: "Test" as const
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(mockWorkItemApi.getWorkItem).toHaveBeenCalledWith(123);
      expect(mockWorkItemApi.createWorkItem).toHaveBeenCalledWith(
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            op: "add",
            path: "/fields/System.Title",
            value: "Test Configuration: ClonedConfig"
          })
        ]),
        "TargetProject",
        "Task"
      );

      expect(parsedResult.sourceConfiguration.id).toBe(123);
      expect(parsedResult.clonedConfiguration.id).toBe(124);
      expect(parsedResult.clonedConfiguration.name).toBe("ClonedConfig");
    });

    it("should handle source configuration not found", async () => {
      mockWorkItemApi.getWorkItem.mockResolvedValue(null);

      const params = {
        sourceProject: "SourceProject",
        sourceConfigurationId: 999,
        targetProject: "TargetProject",
        newName: "ClonedConfig"
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });

    it("should apply variable transformations", async () => {
      const mockSourceWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationType": "TestConfiguration",
          "Custom.ConfigurationName": "SourceConfig",
          "Custom.Variables": JSON.stringify([
            { name: "oldVar", value: "oldValue", type: "string", isSecret: false }
          ])
        }
      };

      const mockClonedWorkItem = {
        id: 124,
        fields: {
          "Custom.ConfigurationName": "ClonedConfig"
        }
      };

      mockWorkItemApi.getWorkItem.mockResolvedValue(mockSourceWorkItem);
      mockWorkItemApi.createWorkItem.mockResolvedValue(mockClonedWorkItem);

      const params = {
        sourceProject: "SourceProject",
        sourceConfigurationId: 123,
        targetProject: "TargetProject",
        newName: "ClonedConfig",
        cloneVariables: true,
        variableTransformations: [
          {
            sourceVariableName: "oldVar",
            targetVariableName: "newVar",
            newValue: "newValue"
          }
        ]
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.clonedConfiguration.variables[0].name).toBe("newVar");
      expect(parsedResult.clonedConfiguration.variables[0].value).toBe("newValue");
    });
  });

  describe("testconfig_validate_configuration", () => {
    beforeEach(() => {
      (server.tool as jest.Mock).mockClear();
      configureTestConfigurationTools(server, mockTokenProvider, mockConnectionProvider);
      // Get the sixth call (validate configuration tool)
      toolHandler = (server.tool as jest.Mock).mock.calls[5][3];
    });

    it("should validate existing configuration successfully", async () => {
      const mockWorkItem = {
        id: 123,
        fields: {
          "Custom.ConfigurationType": "TestConfiguration",
          "Custom.ConfigurationName": "ValidConfig",
          "Custom.Environment": "Development",
          "Custom.Variables": JSON.stringify([
            { name: "validVar", value: "validValue", type: "string", isSecret: false }
          ]),
          "Custom.Settings": JSON.stringify({ timeout: 300, retryAttempts: 3 })
        }
      };

      mockWorkItemApi.getWorkItem.mockResolvedValue(mockWorkItem);

      const params = {
        project: "TestProject",
        configurationId: 123,
        validationTypes: ["schema", "variables", "settings"],
        strictValidation: false,
        includeWarnings: true
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(mockWorkItemApi.getWorkItem).toHaveBeenCalledWith(123);
      expect(parsedResult.isValid).toBe(true);
      expect(parsedResult.validationTypes).toEqual(["schema", "variables", "settings"]);
      expect(parsedResult.validationDetails).toHaveProperty("schema");
      expect(parsedResult.validationDetails).toHaveProperty("variables");
      expect(parsedResult.validationDetails).toHaveProperty("settings");
    });

    it("should validate configuration definition successfully", async () => {
      const params = {
        project: "TestProject",
        configurationDefinition: {
          name: "TestConfig",
          environment: "Development" as const,
          variables: [
            { name: "testVar", value: "testValue", type: "string" as const, isSecret: false }
          ],
          settings: {
            timeout: 300,
            retryAttempts: 3
          }
        },
        validationTypes: ["schema", "variables"],
        strictValidation: false,
        includeWarnings: true
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.isValid).toBe(true);
      expect(parsedResult.validationDetails.schema.errors).toHaveLength(0);
      expect(parsedResult.validationDetails.variables.validVariables).toBe(1);
    });

    it("should detect validation errors", async () => {
      const params = {
        project: "TestProject",
        configurationDefinition: {
          name: "", // Invalid empty name
          environment: "Development" as const,
          variables: [
            { name: "", value: "testValue", type: "string" as const, isSecret: false }, // Invalid empty variable name
            { name: "validVar", value: "validValue", type: "string" as const, isSecret: false },
            { name: "validVar", value: "duplicateVar", type: "string" as const, isSecret: false } // Duplicate name
          ]
        },
        validationTypes: ["schema", "variables"],
        strictValidation: true,
        includeWarnings: true
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.isValid).toBe(false);
      expect(parsedResult.errors.length).toBeGreaterThan(0);
      expect(parsedResult.validationDetails.schema.errors).toContain("Configuration name is required");
      expect(parsedResult.validationDetails.variables.errors).toContain("Variable name cannot be empty");
      expect(parsedResult.validationDetails.variables.errors).toContain("Duplicate variable name: validVar");
    });

    it("should handle missing parameters", async () => {
      const params = {
        project: "TestProject",
        validationTypes: ["schema"],
        strictValidation: false,
        includeWarnings: true
      };

      await expect(toolHandler(params)).rejects.toThrow();
    });

    it("should validate all supported types", async () => {
      const params = {
        project: "TestProject",
        configurationDefinition: {
          name: "TestConfig",
          environment: "Development" as const
        },
        validationTypes: ["schema", "connectivity", "dependencies", "permissions", "variables", "settings", "compatibility"],
        strictValidation: false,
        includeWarnings: true
      };

      const result = await toolHandler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.validationDetails).toHaveProperty("schema");
      expect(parsedResult.validationDetails).toHaveProperty("connectivity");
      expect(parsedResult.validationDetails).toHaveProperty("dependencies");
      expect(parsedResult.validationDetails).toHaveProperty("permissions");
      expect(parsedResult.validationDetails).toHaveProperty("variables");
      expect(parsedResult.validationDetails).toHaveProperty("settings");
      expect(parsedResult.validationDetails).toHaveProperty("compatibility");
    });
  });
});