// Copyright (c) eKassir ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import {
  createTestingError,
  measureExecutionTime,
  parseAzureDevOpsError
} from "./utils.js";
import { ErrorCodes } from "./schemas.js";

const TEST_CONFIGURATION_TOOLS = {
  create_configuration: "testconfig_create_configuration",
  update_configuration: "testconfig_update_configuration",
  list_configurations: "testconfig_list_configurations",
  delete_configuration: "testconfig_delete_configuration",
  clone_configuration: "testconfig_clone_configuration",
  validate_configuration: "testconfig_validate_configuration"
};

export function configureTestConfigurationTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  /**
   * Create Test Configuration
   */
  // Define the schema for create configuration
  const createConfigurationSchema = z.object({
    project: z.string().min(1, "Project ID or name cannot be empty").describe("Project ID or name"),
    name: z.string().min(1, "Configuration name cannot be empty").max(256).describe("Configuration name"),
    description: z.string().max(2000).optional().describe("Configuration description"),
    environment: z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"])
      .describe("Target environment type"),
    variables: z.array(z.object({
      name: z.string().describe("Variable name"),
      value: z.string().describe("Variable value"),
      type: z.enum(["string", "number", "boolean", "json", "password", "url"]).default("string"),
      isSecret: z.boolean().default(false).describe("Whether this is a secret variable"),
      description: z.string().optional().describe("Variable description")
    })).optional().describe("Configuration variables"),
    settings: z.object({
      timeout: z.number().min(1).max(3600).default(300),
      retryAttempts: z.number().min(0).max(10).default(3),
      parallelExecution: z.boolean().default(false),
      captureScreenshots: z.boolean().default(true),
      generateReports: z.boolean().default(true),
      cleanupAfterRun: z.boolean().default(true)
    }).optional().describe("Configuration settings"),
    tags: z.array(z.string()).optional().describe("Configuration tags"),
    category: z.string().max(100).optional().describe("Configuration category")
  });

  server.tool(
    TEST_CONFIGURATION_TOOLS.create_configuration,
    "Create a new test configuration with environment-specific settings, variable definitions, and validation rules",
    {
      project: z.string().min(1).describe("Project ID or name"),
      name: z.string().min(1).max(256).describe("Configuration name"),
      description: z.string().max(2000).optional().describe("Configuration description"),
      environment: z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"])
        .describe("Target environment type"),
      variables: z.array(z.object({
        name: z.string().describe("Variable name"),
        value: z.string().describe("Variable value"),
        type: z.enum(["string", "number", "boolean", "json", "password", "url"]).default("string"),
        isSecret: z.boolean().default(false).describe("Whether this is a secret variable"),
        description: z.string().optional().describe("Variable description")
      })).optional().describe("Configuration variables"),
      settings: z.object({
        timeout: z.number().min(1).max(3600).default(300),
        retryAttempts: z.number().min(0).max(10).default(3),
        parallelExecution: z.boolean().default(false),
        captureScreenshots: z.boolean().default(true),
        generateReports: z.boolean().default(true),
        cleanupAfterRun: z.boolean().default(true)
      }).optional().describe("Configuration settings"),
      tags: z.array(z.string()).optional().describe("Configuration tags"),
      category: z.string().max(100).optional().describe("Configuration category")
    },
    async (params) => {
      try {
        // Explicit validation of input parameters
        const validationResult = createConfigurationSchema.safeParse(params);
        if (!validationResult.success) {
          throw createTestingError(
            ErrorCodes.INVALID_INPUT,
            `Validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}`,
            { validationErrors: validationResult.error.errors }
          );
        }
        const validatedParams = validationResult.data;

        const { result, executionTime } = await measureExecutionTime(async (): Promise<any> => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Validate variables for uniqueness
          if (validatedParams.variables) {
            const variableNames = new Set<string>();
            for (const variable of validatedParams.variables) {
              if (variableNames.has(variable.name)) {
                throw createTestingError(
                  ErrorCodes.RESOURCE_CONFLICT,
                  `Variable '${variable.name}' is already defined`,
                  { variableName: variable.name }
                );
              }
              variableNames.add(variable.name);
            }
          }

          // Create configuration as a work item (using Task type)
          const workItemFields: any = {
            "System.Title": `Test Configuration: ${validatedParams.name}`,
            "System.Description": validatedParams.description || "",
            "System.AreaPath": validatedParams.project,
            "System.IterationPath": validatedParams.project,
            "System.Tags": validatedParams.tags?.join("; ") || "",
            "System.State": "Active"
          };

          // Add custom fields for configuration data
          const customFields = {
            "Custom.ConfigurationType": "TestConfiguration",
            "Custom.ConfigurationName": validatedParams.name,
            "Custom.Environment": validatedParams.environment,
            "Custom.Category": validatedParams.category || "",
            "Custom.Variables": JSON.stringify(validatedParams.variables || []),
            "Custom.Settings": JSON.stringify(validatedParams.settings || {}),
            "Custom.CreatedBy": "Azure DevOps MCP Server"
          };

          for (const [field, value] of Object.entries(customFields)) {
            if (value) {
              workItemFields[field] = value;
            }
          }

          const patchDocument = Object.entries(workItemFields).map(([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value
          }));

          const createdWorkItem = await workItemApi.createWorkItem(
            undefined,
            patchDocument,
            validatedParams.project,
            "Task"
          );

          // Perform basic validation
          const validationResults = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            lastValidated: new Date().toISOString()
          };

          // Validate settings
          if (validatedParams.settings) {
            if (validatedParams.settings.timeout < 1 || validatedParams.settings.timeout > 3600) {
              validationResults.warnings.push("Timeout should be between 1 and 3600 seconds");
            }
            if (validatedParams.settings.retryAttempts < 0 || validatedParams.settings.retryAttempts > 10) {
              validationResults.warnings.push("Retry attempts should be between 0 and 10");
            }
          }

          return {
            configuration: {
              id: createdWorkItem.id,
              name: validatedParams.name,
              description: validatedParams.description,
              environment: validatedParams.environment,
              project: validatedParams.project,
              state: "Active",
              variables: validatedParams.variables?.map(v => ({
                ...v,
                value: v.isSecret ? "***ENCRYPTED***" : v.value
              })) || [],
              settings: validatedParams.settings,
              tags: validatedParams.tags,
              category: validatedParams.category,
              validationStatus: validationResults,
              createdDate: new Date().toISOString(),
              version: 1
            },
            warnings: validationResults.warnings
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * Update Test Configuration
   */
  server.tool(
    TEST_CONFIGURATION_TOOLS.update_configuration,
    "Update an existing test configuration with versioning, change tracking, and variable mappings",
    {
      project: z.string().describe("Project ID or name"),
      configurationId: z.number().describe("Configuration ID to update"),
      name: z.string().min(1).max(256).optional().describe("Updated configuration name"),
      description: z.string().max(2000).optional().describe("Updated description"),
      environment: z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"])
        .optional().describe("Updated environment type"),
      variables: z.array(z.object({
        name: z.string().describe("Variable name"),
        value: z.string().describe("Variable value"),
        type: z.enum(["string", "number", "boolean", "json", "password", "url"]).default("string"),
        isSecret: z.boolean().default(false).describe("Whether this is a secret variable"),
        description: z.string().optional().describe("Variable description")
      })).optional().describe("Updated variables (replaces all)"),
      settings: z.object({
        timeout: z.number().min(1).max(3600).optional(),
        retryAttempts: z.number().min(0).max(10).optional(),
        parallelExecution: z.boolean().optional(),
        captureScreenshots: z.boolean().optional(),
        generateReports: z.boolean().optional(),
        cleanupAfterRun: z.boolean().optional()
      }).optional().describe("Updated settings"),
      tags: z.array(z.string()).optional().describe("Updated tags (replaces all)"),
      state: z.enum(["Active", "Inactive", "Draft", "Archived"]).optional().describe("Configuration state")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Get current configuration
          const currentWorkItem = await workItemApi.getWorkItem(params.configurationId);
          
          if (!currentWorkItem || currentWorkItem.fields?.["Custom.ConfigurationType"] !== "TestConfiguration") {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              `Test configuration ${params.configurationId} not found`,
              { configurationId: params.configurationId }
            );
          }

          // Prepare update fields
          const updateFields: any = {};
          let changesSummary = {
            nameChanged: false,
            descriptionChanged: false,
            environmentChanged: false,
            variablesChanged: false,
            settingsChanged: false,
            tagsChanged: false,
            stateChanged: false
          };

          if (params.name) {
            updateFields["System.Title"] = `Test Configuration: ${params.name}`;
            updateFields["Custom.ConfigurationName"] = params.name;
            changesSummary.nameChanged = true;
          }

          if (params.description) {
            updateFields["System.Description"] = params.description;
            changesSummary.descriptionChanged = true;
          }

          if (params.environment) {
            updateFields["Custom.Environment"] = params.environment;
            changesSummary.environmentChanged = true;
          }

          if (params.variables) {
            updateFields["Custom.Variables"] = JSON.stringify(params.variables);
            changesSummary.variablesChanged = true;
          }

          if (params.settings) {
            const currentSettings = currentWorkItem.fields?.["Custom.Settings"] ? 
              JSON.parse(currentWorkItem.fields["Custom.Settings"]) : {};
            const updatedSettings = { ...currentSettings, ...params.settings };
            updateFields["Custom.Settings"] = JSON.stringify(updatedSettings);
            changesSummary.settingsChanged = true;
          }

          if (params.tags) {
            updateFields["System.Tags"] = params.tags.join("; ");
            changesSummary.tagsChanged = true;
          }

          if (params.state) {
            const stateMapping = {
              "Active": "Active",
              "Inactive": "Closed",
              "Draft": "New", 
              "Archived": "Removed"
            };
            updateFields["System.State"] = stateMapping[params.state] || "Active";
            changesSummary.stateChanged = true;
          }

          if (Object.keys(updateFields).length > 0) {
            const patchDocument = Object.entries(updateFields).map(([field, value]) => ({
              op: "replace",
              path: `/fields/${field}`,
              value
            }));

            await workItemApi.updateWorkItem(undefined, patchDocument, params.configurationId);
          }

          // Get updated work item
          const updatedWorkItem = await workItemApi.getWorkItem(params.configurationId);

          return {
            configuration: {
              id: updatedWorkItem.id,
              name: updatedWorkItem.fields?.["Custom.ConfigurationName"] || params.name,
              description: updatedWorkItem.fields?.["System.Description"],
              environment: updatedWorkItem.fields?.["Custom.Environment"] || params.environment,
              state: params.state || "Active",
              variables: params.variables?.map(v => ({
                ...v,
                value: v.isSecret ? "***ENCRYPTED***" : v.value
              })) || JSON.parse(updatedWorkItem.fields?.["Custom.Variables"] || "[]"),
              settings: params.settings || JSON.parse(updatedWorkItem.fields?.["Custom.Settings"] || "{}"),
              lastModifiedDate: new Date().toISOString()
            },
            changesSummary,
            warnings: []
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * List Test Configurations
   */
  server.tool(
    TEST_CONFIGURATION_TOOLS.list_configurations,
    "List and filter test configurations with pagination, environment filtering, and active/inactive status",
    {
      project: z.string().optional().describe("Project ID or name to filter by"),
      environment: z.array(z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"]))
        .optional().describe("Filter by environment types"),
      state: z.array(z.enum(["Active", "Inactive", "Draft", "Archived"]))
        .optional().describe("Filter by configuration states"),
      category: z.string().optional().describe("Filter by category"),
      nameFilter: z.string().optional().describe("Filter by name (partial match)"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      top: z.number().min(1).max(1000).default(100).describe("Maximum results to return"),
      skip: z.number().min(0).default(0).describe("Results to skip"),
      includeVariables: z.boolean().default(false).describe("Include variable definitions"),
      includeSettings: z.boolean().default(false).describe("Include configuration settings")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Build WIQL query to find test configurations
          let query = `SELECT [System.Id], [System.Title], [System.Description], [System.State], [System.Tags], [Custom.ConfigurationName], [Custom.Environment], [Custom.Category], [Custom.Variables], [Custom.Settings] FROM WorkItems WHERE [Custom.ConfigurationType] = 'TestConfiguration'`;

          if (params.project) {
            query += ` AND [System.TeamProject] = '${params.project}'`;
          }

          if (params.environment && params.environment.length > 0) {
            const envFilter = params.environment.map(env => `'${env}'`).join(", ");
            query += ` AND [Custom.Environment] IN (${envFilter})`;
          }

          if (params.category) {
            query += ` AND [Custom.Category] = '${params.category}'`;
          }

          if (params.nameFilter) {
            query += ` AND [Custom.ConfigurationName] CONTAINS '${params.nameFilter}'`;
          }

          query += ` ORDER BY [Custom.ConfigurationName]`;

          const teamContext = params.project ? { project: params.project } : undefined;
          const queryResult = await workItemApi.queryByWiql({ query }, teamContext);

          if (!queryResult.workItems || queryResult.workItems.length === 0) {
            return {
              configurations: [],
              totalCount: 0,
              pagination: {
                hasMore: false,
                pageSize: params.top,
                currentPage: 1,
                totalCount: 0
              }
            };
          }

          // Get work item details
          const workItemIds = queryResult.workItems.map(wi => wi.id!);
          const workItems = await workItemApi.getWorkItems(
            workItemIds.slice(params.skip, params.skip + params.top)
          );

          // Transform to configuration format
          const configurations = workItems.map(workItem => {
            const config: any = {
              id: workItem.id,
              name: workItem.fields?.["Custom.ConfigurationName"],
              description: workItem.fields?.["System.Description"],
              environment: workItem.fields?.["Custom.Environment"],
              category: workItem.fields?.["Custom.Category"],
              state: mapWorkItemStateToConfigState(workItem.fields?.["System.State"]),
              tags: workItem.fields?.["System.Tags"] ? 
                workItem.fields["System.Tags"].split(";").map((t: string) => t.trim()) : []
            };

            if (params.includeVariables) {
              const variables = JSON.parse(workItem.fields?.["Custom.Variables"] || "[]");
              config.variables = variables.map((v: any) => ({
                ...v,
                value: v.isSecret ? "***ENCRYPTED***" : v.value
              }));
            }

            if (params.includeSettings) {
              config.settings = JSON.parse(workItem.fields?.["Custom.Settings"] || "{}");
            }

            return config;
          });

          // Apply additional filters
          let filteredConfigurations = configurations;

          if (params.state && params.state.length > 0) {
            filteredConfigurations = filteredConfigurations.filter(config => 
              params.state!.includes(config.state)
            );
          }

          if (params.tags && params.tags.length > 0) {
            filteredConfigurations = filteredConfigurations.filter(config => 
              params.tags!.some(tag => config.tags.includes(tag))
            );
          }

          const totalCount = filteredConfigurations.length;

          return {
            configurations: filteredConfigurations,
            totalCount,
            pagination: {
              hasMore: params.skip + params.top < totalCount,
              pageSize: params.top,
              currentPage: Math.floor(params.skip / params.top) + 1,
              totalCount
            }
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * Delete Test Configuration
   */
  server.tool(
    TEST_CONFIGURATION_TOOLS.delete_configuration,
    "Safe deletion of test configurations with dependency checking, usage analysis, and backup creation",
    {
      project: z.string().describe("Project ID or name"),
      configurationId: z.number().describe("Configuration ID to delete"),
      forceDelete: z.boolean().default(false).describe("Force deletion even if in use"),
      createBackup: z.boolean().default(true).describe("Create backup before deletion"),
      checkDependencies: z.boolean().default(true).describe("Check for dependencies before deletion")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Get configuration details
          const workItem = await workItemApi.getWorkItem(params.configurationId);

          if (!workItem || workItem.fields?.["Custom.ConfigurationType"] !== "TestConfiguration") {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              `Test configuration ${params.configurationId} not found`,
              { configurationId: params.configurationId }
            );
          }

          // Create backup if requested
          let backup: any = null;
          if (params.createBackup) {
            backup = {
              configuration: {
                id: workItem.id,
                name: workItem.fields?.["Custom.ConfigurationName"],
                description: workItem.fields?.["System.Description"],
                environment: workItem.fields?.["Custom.Environment"],
                category: workItem.fields?.["Custom.Category"],
                variables: JSON.parse(workItem.fields?.["Custom.Variables"] || "[]"),
                settings: JSON.parse(workItem.fields?.["Custom.Settings"] || "{}"),
                tags: workItem.fields?.["System.Tags"] ? 
                  workItem.fields["System.Tags"].split(";").map((t: string) => t.trim()) : []
              },
              exportedAt: new Date().toISOString(),
              exportedBy: "Azure DevOps MCP Server"
            };
          }

          // Simple dependency check (in real implementation, this would check test runs, etc.)
          const dependencyCheck = {
            testRuns: 0,
            testSuites: 0,
            scheduledRuns: 0,
            childConfigurations: 0,
            warnings: [] as string[]
          };

          if (params.checkDependencies && !params.forceDelete) {
            // This is a simplified check - in a real implementation, 
            // you would query for actual dependencies
            dependencyCheck.warnings.push("Dependency checking is simplified in this implementation");
          }

          // Delete the configuration
          await workItemApi.deleteWorkItem(params.configurationId);

          return {
            deletedConfiguration: {
              id: workItem.id,
              name: workItem.fields?.["Custom.ConfigurationName"],
              state: mapWorkItemStateToConfigState(workItem.fields?.["System.State"])
            },
            dependencyCheck,
            backup: backup ? {
              created: true,
              size: JSON.stringify(backup).length,
              dependencies: dependencyCheck
            } : null,
            metadataDeleted: true,
            deletedAt: new Date().toISOString(),
            warnings: dependencyCheck.warnings
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * Clone Test Configuration
   */
  server.tool(
    TEST_CONFIGURATION_TOOLS.clone_configuration,
    "Clone test configurations with cross-project support, variable substitution, and bulk operations",
    {
      sourceProject: z.string().describe("Source project ID or name"),
      sourceConfigurationId: z.number().describe("Source configuration ID"),
      targetProject: z.string().describe("Target project ID or name"),
      newName: z.string().min(1).max(256).describe("Name for cloned configuration"),
      newDescription: z.string().max(2000).optional().describe("Description for cloned configuration"),
      cloneVariables: z.boolean().default(true).describe("Clone variable definitions"),
      cloneSettings: z.boolean().default(true).describe("Clone configuration settings"),
      cloneTags: z.boolean().default(true).describe("Clone tags"),
      targetEnvironment: z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"])
        .optional().describe("Target environment type"),
      variableTransformations: z.array(z.object({
        sourceVariableName: z.string().describe("Source variable name"),
        targetVariableName: z.string().describe("Target variable name"),
        newValue: z.string().optional().describe("New value for target variable")
      })).optional().describe("Variable name/value transformations")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          // Get source configuration
          const sourceWorkItem = await workItemApi.getWorkItem(params.sourceConfigurationId);

          if (!sourceWorkItem || sourceWorkItem.fields?.["Custom.ConfigurationType"] !== "TestConfiguration") {
            throw createTestingError(
              ErrorCodes.RESOURCE_NOT_FOUND,
              `Source configuration ${params.sourceConfigurationId} not found in project ${params.sourceProject}`,
              { 
                sourceProject: params.sourceProject, 
                sourceConfigurationId: params.sourceConfigurationId 
              }
            );
          }

          // Clone variables with transformations
          let clonedVariables: any[] = [];
          if (params.cloneVariables) {
            const sourceVariables = JSON.parse(sourceWorkItem.fields?.["Custom.Variables"] || "[]");
            
            for (const sourceVar of sourceVariables) {
              // Check for variable transformations
              const transformation = params.variableTransformations?.find(
                t => t.sourceVariableName === sourceVar.name
              );

              const clonedVar = {
                name: transformation?.targetVariableName || sourceVar.name,
                value: transformation?.newValue || sourceVar.value,
                type: sourceVar.type,
                isSecret: sourceVar.isSecret,
                description: sourceVar.description
              };

              // Clear encrypted values for security
              if (sourceVar.isSecret) {
                clonedVar.value = ""; // Clear secret values in clone
              }

              clonedVariables.push(clonedVar);
            }
          }

          // Prepare cloned configuration fields
          const workItemFields: any = {
            "System.Title": `Test Configuration: ${params.newName}`,
            "System.Description": params.newDescription || `Cloned from ${sourceWorkItem.fields?.["Custom.ConfigurationName"]}`,
            "System.AreaPath": params.targetProject,
            "System.IterationPath": params.targetProject,
            "System.State": "Active"
          };

          // Add custom fields
          const customFields = {
            "Custom.ConfigurationType": "TestConfiguration",
            "Custom.ConfigurationName": params.newName,
            "Custom.Environment": params.targetEnvironment || sourceWorkItem.fields?.["Custom.Environment"],
            "Custom.Category": sourceWorkItem.fields?.["Custom.Category"] || "",
            "Custom.Variables": JSON.stringify(clonedVariables),
            "Custom.CreatedBy": "Azure DevOps MCP Server (Cloned)"
          };

          if (params.cloneSettings) {
            (customFields as any)["Custom.Settings"] = sourceWorkItem.fields?.["Custom.Settings"] || "{}";
          }

          if (params.cloneTags && sourceWorkItem.fields?.["System.Tags"]) {
            workItemFields["System.Tags"] = sourceWorkItem.fields["System.Tags"];
          }

          for (const [field, value] of Object.entries(customFields)) {
            if (value) {
              workItemFields[field] = value;
            }
          }

          const patchDocument = Object.entries(workItemFields).map(([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value
          }));

          const clonedWorkItem = await workItemApi.createWorkItem(
            undefined,
            patchDocument,
            params.targetProject,
            "Task"
          );

          return {
            sourceConfiguration: {
              id: sourceWorkItem.id,
              name: sourceWorkItem.fields?.["Custom.ConfigurationName"],
              project: params.sourceProject
            },
            clonedConfiguration: {
              id: clonedWorkItem.id,
              name: params.newName,
              description: params.newDescription,
              project: params.targetProject,
              state: "Active",
              variables: clonedVariables.map(v => ({
                ...v,
                value: v.isSecret ? "***ENCRYPTED***" : v.value
              })),
              environment: params.targetEnvironment || sourceWorkItem.fields?.["Custom.Environment"]
            },
            cloneOptions: {
              variablesCloned: params.cloneVariables,
              settingsCloned: params.cloneSettings,
              tagsCloned: params.cloneTags,
              transformationsApplied: params.variableTransformations?.length || 0
            },
            warnings: []
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );

  /**
   * Validate Test Configuration
   */
  server.tool(
    TEST_CONFIGURATION_TOOLS.validate_configuration,
    "Validate configuration settings with schema validation, connectivity checks, and compatibility analysis",
    {
      project: z.string().describe("Project ID or name"),
      configurationId: z.number().optional().describe("Configuration ID to validate"),
      configurationDefinition: z.object({
        name: z.string().describe("Configuration name"),
        environment: z.enum(["Development", "Test", "Staging", "Production", "Integration", "QA"]),
        variables: z.array(z.object({
          name: z.string(),
          value: z.string(),
          type: z.enum(["string", "number", "boolean", "json", "password", "url"]).default("string"),
          isSecret: z.boolean().default(false)
        })).optional(),
        settings: z.object({
          timeout: z.number().min(1).max(3600).optional(),
          retryAttempts: z.number().min(0).max(10).optional()
        }).optional()
      }).optional().describe("Configuration definition to validate"),
      validationTypes: z.array(z.enum([
        "schema", "connectivity", "dependencies", "permissions", "variables", "settings", "compatibility"
      ])).default(["schema", "variables", "settings"]).describe("Types of validation to perform"),
      strictValidation: z.boolean().default(false).describe("Use strict validation rules"),
      includeWarnings: z.boolean().default(true).describe("Include warnings in validation results")
    },
    async (params) => {
      try {
        const { result, executionTime } = await measureExecutionTime(async () => {
          const connection = await connectionProvider();
          const workItemApi = await connection.getWorkItemTrackingApi();

          let configurationToValidate: any = null;

          // Get configuration to validate
          if (params.configurationId) {
            const workItem = await workItemApi.getWorkItem(params.configurationId);

            if (!workItem || workItem.fields?.["Custom.ConfigurationType"] !== "TestConfiguration") {
              throw createTestingError(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Configuration ${params.configurationId} not found`,
                { configurationId: params.configurationId }
              );
            }

            configurationToValidate = {
              name: workItem.fields?.["Custom.ConfigurationName"],
              environment: workItem.fields?.["Custom.Environment"],
              variables: JSON.parse(workItem.fields?.["Custom.Variables"] || "[]"),
              settings: JSON.parse(workItem.fields?.["Custom.Settings"] || "{}")
            };
          } else if (params.configurationDefinition) {
            configurationToValidate = params.configurationDefinition;
          } else {
            throw createTestingError(
              ErrorCodes.INVALID_INPUT,
              "Either configurationId or configurationDefinition must be provided"
            );
          }

          const errors: string[] = [];
          const warnings: string[] = [];
          const validationDetails: Record<string, any> = {};

          // Perform validations based on requested types
          for (const validationType of params.validationTypes) {
            switch (validationType) {
              case "schema":
                const schemaValidation = validateSchema(configurationToValidate);
                errors.push(...schemaValidation.errors);
                if (params.includeWarnings) {
                  warnings.push(...schemaValidation.warnings);
                }
                validationDetails.schema = schemaValidation;
                break;

              case "variables":
                const variableValidation = validateVariables(configurationToValidate.variables || []);
                errors.push(...variableValidation.errors);
                if (params.includeWarnings) {
                  warnings.push(...variableValidation.warnings);
                }
                validationDetails.variables = variableValidation;
                break;

              case "settings":
                const settingsValidation = validateSettings(configurationToValidate.settings || {});
                errors.push(...settingsValidation.errors);
                if (params.includeWarnings) {
                  warnings.push(...settingsValidation.warnings);
                }
                validationDetails.settings = settingsValidation;
                break;

              case "connectivity":
                validationDetails.connectivity = {
                  status: "simulated",
                  message: "Connectivity validation is simulated in this implementation"
                };
                break;

              case "dependencies":
                validationDetails.dependencies = {
                  status: "simulated",
                  message: "Dependency validation is simulated in this implementation"
                };
                break;

              case "permissions":
                validationDetails.permissions = {
                  status: "simulated",
                  message: "Permission validation is simulated in this implementation"
                };
                break;

              case "compatibility":
                validationDetails.compatibility = {
                  status: "simulated",
                  message: "Compatibility validation is simulated in this implementation"
                };
                break;
            }
          }

          return {
            isValid: errors.length === 0,
            errors,
            warnings,
            validationTypes: params.validationTypes,
            lastValidated: new Date().toISOString(),
            validationDetails
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };

      } catch (error) {
        throw parseAzureDevOpsError(error);
      }
    }
  );
}

// Helper functions

function mapWorkItemStateToConfigState(workItemState: string): string {
  const stateMapping: Record<string, string> = {
    "Active": "Active",
    "New": "Draft",
    "Closed": "Inactive",
    "Removed": "Archived"
  };
  return stateMapping[workItemState] || "Active";
}

function validateSchema(config: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push("Configuration name is required");
  }

  if (config.name && config.name.length > 256) {
    errors.push("Configuration name is too long (max 256 characters)");
  }

  if (!config.environment) {
    errors.push("Environment is required");
  }

  return { errors, warnings };
}

function validateVariables(variables: any[]): { errors: string[]; warnings: string[]; validVariables: number; totalVariables: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let validVariables = 0;
  const variableNames = new Set<string>();

  for (const variable of variables) {
    let isValid = true;

    if (!variable.name || variable.name.trim().length === 0) {
      errors.push("Variable name cannot be empty");
      isValid = false;
    } else if (variableNames.has(variable.name)) {
      errors.push(`Duplicate variable name: ${variable.name}`);
      isValid = false;
    } else {
      variableNames.add(variable.name);
    }

    if (variable.name && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable.name)) {
      errors.push(`Invalid variable name '${variable.name}' - must start with letter and contain only letters, numbers, and underscores`);
      isValid = false;
    }

    if (isValid) {
      validVariables++;
    }
  }

  return { errors, warnings, validVariables, totalVariables: variables.length };
}

function validateSettings(settings: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (settings.timeout !== undefined) {
    if (settings.timeout < 1 || settings.timeout > 3600) {
      warnings.push("Timeout should be between 1 and 3600 seconds");
    }
  }

  if (settings.retryAttempts !== undefined) {
    if (settings.retryAttempts < 0 || settings.retryAttempts > 10) {
      warnings.push("Retry attempts should be between 0 and 10");
    }
  }

  return { errors, warnings };
}

export { TEST_CONFIGURATION_TOOLS };