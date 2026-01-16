// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import {
  ReleaseDefinitionExpands,
  ReleaseDefinitionQueryOrder,
  ReleaseExpands,
  ReleaseStatus,
  ReleaseQueryOrder,
  EnvironmentStatus,
  ApprovalStatus,
  ApprovalType
} from "azure-devops-node-api/interfaces/ReleaseInterfaces.js";
import { z } from "zod";
import { getEnumKeys, safeEnumConvert, getAuthorizationHeader } from "../utils.js";

const RELEASE_TOOLS = {
  // Existing tools
  get_release_definitions: "release_get_definitions",
  get_releases: "release_get_releases",
  
  // New definition management tools
  get_definition: "release_get_definition",
  create_definition: "release_create_definition",
  update_definition: "release_update_definition",
  delete_definition: "release_delete_definition",
  
  // New release management tools
  get_release: "release_get_release",
  create_release: "release_create_release",
  update_release: "release_update_release",
  abandon_release: "release_abandon_release",
  
  // New deployment tools
  deploy_environment: "release_deploy_environment",
  get_environment: "release_get_environment",
  
  // New approval tools
  list_approvals: "release_list_approvals",
  update_approval: "release_update_approval"
};

const ApiVersion = {
  DEFINITIONS: "6.0",
  RELEASES: "6.0",
  DEPLOYMENTS: "6.0-preview.1",
  APPROVALS: "6.0"
};

function configureReleaseTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  // ============================================
  // EXISTING TOOLS (Keep as-is)
  // ============================================
  
  /**
   * Tool 1: List Release Definitions (EXISTING)
   */
  server.tool(
    RELEASE_TOOLS.get_release_definitions,
    "Retrieves list of release definitions for a given project.",
    {
      project: z.string().describe("Project ID or name to get release definitions for"),
      searchText: z.string().optional().describe("Search text to filter release definitions"),
      expand: z
        .enum(getEnumKeys(ReleaseDefinitionExpands) as [string, ...string[]])
        .default("None")
        .describe("Expand options for release definitions"),
      artifactType: z.string().optional().describe("Filter by artifact type"),
      artifactSourceId: z.string().optional().describe("Filter by artifact source ID"),
      top: z.number().optional().describe("Number of results to return (for pagination)"),
      continuationToken: z.string().optional().describe("Continuation token for pagination"),
      queryOrder: z
        .enum(getEnumKeys(ReleaseDefinitionQueryOrder) as [string, ...string[]])
        .default("NameAscending")
        .describe("Order of the results"),
      path: z.string().optional().describe("Path to filter release definitions"),
      isExactNameMatch: z.boolean().optional().default(false).describe("Whether to match the exact name of the release definition. Default is false."),
      tagFilter: z.array(z.string()).optional().describe("Filter by tags associated with the release definitions"),
      propertyFilters: z.array(z.string()).optional().describe("Filter by properties associated with the release definitions"),
      definitionIdFilter: z.array(z.string()).optional().describe("Filter by specific release definition IDs"),
      isDeleted: z.boolean().default(false).describe("Whether to include deleted release definitions. Default is false."),
      searchTextContainsFolderName: z.boolean().optional().describe("Whether to include folder names in the search text"),
    },
    async ({
      project,
      searchText,
      expand,
      artifactType,
      artifactSourceId,
      top,
      continuationToken,
      queryOrder,
      path,
      isExactNameMatch,
      tagFilter,
      propertyFilters,
      definitionIdFilter,
      isDeleted,
      searchTextContainsFolderName,
    }) => {
      const connection = await connectionProvider();
      const releaseApi = await connection.getReleaseApi();
      const releaseDefinitions = await releaseApi.getReleaseDefinitions(
        project,
        searchText,
        safeEnumConvert(ReleaseDefinitionExpands, expand),
        artifactType,
        artifactSourceId,
        top,
        continuationToken,
        safeEnumConvert(ReleaseDefinitionQueryOrder, queryOrder),
        path,
        isExactNameMatch,
        tagFilter,
        propertyFilters,
        definitionIdFilter,
        isDeleted,
        searchTextContainsFolderName
      );

      return {
        content: [{ type: "text", text: JSON.stringify(releaseDefinitions, null, 2) }],
      };
    }
  );

  /**
   * Tool 2: List Releases (EXISTING)
   */
  server.tool(
    RELEASE_TOOLS.get_releases,
    "Retrieves a list of releases for a given project.",
    {
      project: z.string().optional().describe("Project ID or name to get releases for"),
      definitionId: z.number().optional().describe("ID of the release definition to filter releases"),
      definitionEnvironmentId: z.number().optional().describe("ID of the definition environment to filter releases"),
      searchText: z.string().optional().describe("Search text to filter releases"),
      createdBy: z.string().optional().describe("User ID or name who created the release"),
      statusFilter: z
        .enum(getEnumKeys(ReleaseStatus) as [string, ...string[]])
        .optional()
        .default("Active")
        .describe("Status of the releases to filter (default: Active)"),
      environmentStatusFilter: z.number().optional().describe("Environment status to filter releases"),
      minCreatedTime: z.coerce
        .date()
        .optional()
        .default(() => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return sevenDaysAgo;
        })
        .describe("Minimum created time for releases (default: 7 days ago)"),
      maxCreatedTime: z.coerce
        .date()
        .optional()
        .default(() => new Date())
        .describe("Maximum created time for releases (default: now)"),
      queryOrder: z
        .enum(getEnumKeys(ReleaseQueryOrder) as [string, ...string[]])
        .optional()
        .default("Ascending")
        .describe("Order in which to return releases (default: Ascending)"),
      top: z.number().optional().describe("Number of releases to return"),
      continuationToken: z.number().optional().describe("Continuation token for pagination"),
      expand: z
        .enum(getEnumKeys(ReleaseExpands) as [string, ...string[]])
        .optional()
        .default("None")
        .describe("Expand options for releases"),
      artifactTypeId: z.string().optional().describe("Filter releases by artifact type ID"),
      sourceId: z.string().optional().describe("Filter releases by artifact source ID"),
      artifactVersionId: z.string().optional().describe("Filter releases by artifact version ID"),
      sourceBranchFilter: z.string().optional().describe("Filter releases by source branch"),
      isDeleted: z.boolean().optional().default(false).describe("Whether to include deleted releases (default: false)"),
      tagFilter: z.array(z.string()).optional().describe("Filter releases by tags"),
      propertyFilters: z.array(z.string()).optional().describe("Filter releases by properties"),
      releaseIdFilter: z.array(z.number()).optional().describe("Filter by specific release IDs"),
      path: z.string().optional().describe("Path to filter releases"),
    },
    async ({
      project,
      definitionId,
      definitionEnvironmentId,
      searchText,
      createdBy,
      statusFilter,
      environmentStatusFilter,
      minCreatedTime,
      maxCreatedTime,
      queryOrder,
      top,
      continuationToken,
      expand,
      artifactTypeId,
      sourceId,
      artifactVersionId,
      sourceBranchFilter,
      isDeleted,
      tagFilter,
      propertyFilters,
      releaseIdFilter,
      path,
    }) => {
      const connection = await connectionProvider();
      const releaseApi = await connection.getReleaseApi();
      const releases = await releaseApi.getReleases(
        project,
        definitionId,
        definitionEnvironmentId,
        searchText,
        createdBy,
        safeEnumConvert(ReleaseStatus, statusFilter),
        environmentStatusFilter,
        minCreatedTime,
        maxCreatedTime,
        safeEnumConvert(ReleaseQueryOrder, queryOrder),
        top,
        continuationToken,
        safeEnumConvert(ReleaseExpands, expand),
        artifactTypeId,
        sourceId,
        artifactVersionId,
        sourceBranchFilter,
        isDeleted,
        tagFilter,
        propertyFilters,
        releaseIdFilter,
        path
      );

      return {
        content: [{ type: "text", text: JSON.stringify(releases, null, 2) }],
      };
    }
  );

  // ============================================
  // NEW TOOLS - Definition Management
  // ============================================

  /**
   * Tool 3: Get Release Definition (NEW)
   */
  server.tool(
    RELEASE_TOOLS.get_definition,
    "Get a specific release definition by ID",
    {
      project: z.string().describe("Project ID or name"),
      definitionId: z.number().describe("Release definition ID"),
      includeEnvironments: z.boolean().default(true).describe("Include environment details"),
      includeArtifacts: z.boolean().default(true).describe("Include artifact details")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        const definition = await releaseApi.getReleaseDefinition(
          params.project,
          params.definitionId
        );

        return {
          content: [{ type: "text", text: JSON.stringify(definition, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Get release definition failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 4: Create Release Definition (NEW)
   */
  server.tool(
    RELEASE_TOOLS.create_definition,
    "Create a new release definition",
    {
      project: z.string().describe("Project ID or name"),
      name: z.string().describe("Release definition name"),
      description: z.string().optional().describe("Definition description"),
      path: z.string().optional().describe("Folder path (e.g., '\\\\MyFolder')"),
      environments: z.array(z.object({
        name: z.string().describe("Environment name"),
        rank: z.number().describe("Deployment order (1, 2, 3...)"),
        conditions: z.array(z.object({
          conditionType: z.string().describe("Condition type (e.g., 'event', 'artifact')"),
          value: z.string().optional().describe("Condition value")
        })).optional().describe("Pre-deployment conditions")
      })).describe("Release environments/stages"),
      artifacts: z.array(z.object({
        sourceId: z.string().describe("Source ID (e.g., build definition ID)"),
        type: z.string().describe("Artifact type (e.g., 'Build', 'Git')"),
        alias: z.string().describe("Artifact alias"),
        definitionReference: z.record(z.string(), z.object({
          id: z.string(),
          name: z.string().optional()
        })).optional().describe("Artifact source references")
      })).describe("Release artifacts"),
      triggers: z.array(z.object({
        triggerType: z.string().describe("Trigger type"),
        artifactAlias: z.string().optional().describe("Related artifact alias")
      })).optional().describe("Release triggers")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const requestBody = {
          name: params.name,
          description: params.description || "",
          path: params.path || "\\",
          environments: params.environments.map(env => ({
            name: env.name,
            rank: env.rank,
            conditions: env.conditions || [],
            deployPhases: [{
              deploymentInput: {
                parallelExecution: { parallelExecutionType: "none" },
                skipArtifactsDownload: false,
                queueId: 0,
                demands: [],
                enableAccessToken: false,
                timeoutInMinutes: 0,
                jobCancelTimeoutInMinutes: 1
              },
              rank: 1,
              phaseType: "agentBasedDeployment",
              name: "Agent job",
              workflowTasks: []
            }]
          })),
          artifacts: params.artifacts,
          triggers: params.triggers || [],
          variables: {},
          variableGroups: []
        };
        
        const endpoint = `${baseUrl}/${params.project}/_apis/release/definitions?api-version=${ApiVersion.DEFINITIONS}`;
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create release definition: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Create release definition failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 5: Update Release Definition (NEW)
   */
  server.tool(
    RELEASE_TOOLS.update_definition,
    "Update an existing release definition",
    {
      project: z.string().describe("Project ID or name"),
      definitionId: z.number().describe("Release definition ID to update"),
      name: z.string().optional().describe("Updated name"),
      description: z.string().optional().describe("Updated description"),
      comment: z.string().optional().describe("Update comment")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        // Get current definition
        const currentDef = await releaseApi.getReleaseDefinition(params.project, params.definitionId);
        
        // Apply updates
        const updatedDef = {
          ...currentDef,
          name: params.name || currentDef.name,
          description: params.description !== undefined ? params.description : currentDef.description,
          comment: params.comment || ""
        };
        
        const result = await releaseApi.updateReleaseDefinition(updatedDef, params.project);
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Update release definition failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 6: Delete Release Definition (NEW)
   */
  server.tool(
    RELEASE_TOOLS.delete_definition,
    "Delete a release definition",
    {
      project: z.string().describe("Project ID or name"),
      definitionId: z.number().describe("Release definition ID to delete"),
      forceDelete: z.boolean().default(false).describe("Force delete even if releases exist"),
      comment: z.string().optional().describe("Deletion comment")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        await releaseApi.deleteReleaseDefinition(
          params.project,
          params.definitionId,
          params.comment,
          params.forceDelete
        );
        
        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            deletedDefinitionId: params.definitionId,
            message: "Release definition deleted successfully"
          }, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Delete release definition failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // ============================================
  // NEW TOOLS - Release Management
  // ============================================

  /**
   * Tool 7: Get Release (NEW)
   */
  server.tool(
    RELEASE_TOOLS.get_release,
    "Get a specific release by ID",
    {
      project: z.string().describe("Project ID or name"),
      releaseId: z.number().describe("Release ID"),
      includeAllApprovals: z.boolean().default(false).describe("Include all approval details"),
      includeWorkItems: z.boolean().default(false).describe("Include linked work items")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        const release = await releaseApi.getRelease(
          params.project,
          params.releaseId
        );

        return {
          content: [{ type: "text", text: JSON.stringify(release, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Get release failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 8: Create Release (NEW)
   */
  server.tool(
    RELEASE_TOOLS.create_release,
    "Create a new release from a release definition",
    {
      project: z.string().describe("Project ID or name"),
      definitionId: z.number().describe("Release definition ID"),
      description: z.string().optional().describe("Release description"),
      artifacts: z.array(z.object({
        alias: z.string().describe("Artifact alias"),
        instanceReference: z.object({
          id: z.string().describe("Build/artifact ID"),
          name: z.string().optional().describe("Build/artifact name")
        }).describe("Artifact instance reference")
      })).describe("Artifacts to use in this release"),
      isDraft: z.boolean().default(false).describe("Create as draft release"),
      reason: z.string().optional().describe("Release creation reason"),
      manualEnvironments: z.array(z.string()).optional().describe("Environment names to deploy manually")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        const releaseStartMetadata: any = {
          definitionId: params.definitionId,
          description: params.description || "",
          artifacts: params.artifacts,
          isDraft: params.isDraft,
          manualEnvironments: params.manualEnvironments || []
        };
        
        const release = await releaseApi.createRelease(releaseStartMetadata, params.project);
        
        return {
          content: [{ type: "text", text: JSON.stringify(release, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Create release failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 9: Update Release (NEW)
   */
  server.tool(
    RELEASE_TOOLS.update_release,
    "Update a release (name, description, status)",
    {
      project: z.string().describe("Project ID or name"),
      releaseId: z.number().describe("Release ID"),
      name: z.string().optional().describe("Updated release name"),
      description: z.string().optional().describe("Updated description"),
      status: z.enum(["Active", "Abandoned"]).optional().describe("Updated status"),
      comment: z.string().optional().describe("Update comment")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        // Get current release
        const currentRelease = await releaseApi.getRelease(params.project, params.releaseId);
        
        // Apply updates
        const updatedRelease = {
          ...currentRelease,
          name: params.name || currentRelease.name,
          description: params.description !== undefined ? params.description : currentRelease.description,
          status: params.status ? safeEnumConvert(ReleaseStatus, params.status) : currentRelease.status,
          comment: params.comment || ""
        };
        
        const result = await releaseApi.updateRelease(updatedRelease, params.project, params.releaseId);
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Update release failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 10: Abandon Release (NEW)
   */
  server.tool(
    RELEASE_TOOLS.abandon_release,
    "Abandon a release and stop all deployments",
    {
      project: z.string().describe("Project ID or name"),
      releaseId: z.number().describe("Release ID to abandon"),
      comment: z.string().optional().describe("Abandonment reason/comment")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        // Get current release
        const currentRelease = await releaseApi.getRelease(params.project, params.releaseId);
        
        // Set status to Abandoned
        const abandonedRelease = {
          ...currentRelease,
          status: safeEnumConvert(ReleaseStatus, "Abandoned"),
          comment: params.comment || "Release abandoned"
        };
        
        const result = await releaseApi.updateRelease(abandonedRelease, params.project, params.releaseId);
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Abandon release failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // ============================================
  // NEW TOOLS - Deployment Management
  // ============================================

  /**
   * Tool 11: Deploy Environment/Stage (NEW)
   */
  server.tool(
    RELEASE_TOOLS.deploy_environment,
    "Deploy a release to a specific environment/stage",
    {
      project: z.string().describe("Project ID or name"),
      releaseId: z.number().describe("Release ID"),
      environmentId: z.number().describe("Environment/stage ID to deploy"),
      comment: z.string().optional().describe("Deployment comment")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        
        const requestBody = {
          status: safeEnumConvert(EnvironmentStatus, "InProgress"),
          scheduledDeploymentTime: null,
          comment: params.comment || ""
        };
        
        const endpoint = `${baseUrl}/${params.project}/_apis/release/releases/${params.releaseId}/environments/${params.environmentId}?api-version=${ApiVersion.DEPLOYMENTS}`;
        
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to deploy environment: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Deploy environment failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 12: Get Environment/Stage (NEW)
   */
  server.tool(
    RELEASE_TOOLS.get_environment,
    "Get release environment/stage details",
    {
      project: z.string().describe("Project ID or name"),
      releaseId: z.number().describe("Release ID"),
      environmentId: z.number().describe("Environment/stage ID")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        const release = await releaseApi.getRelease(params.project, params.releaseId);
        const environment = release.environments?.find(env => env.id === params.environmentId);
        
        if (!environment) {
          throw new Error(`Environment ${params.environmentId} not found in release ${params.releaseId}`);
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(environment, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Get environment failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // ============================================
  // NEW TOOLS - Approval Management
  // ============================================

  /**
   * Tool 13: List Approvals (NEW)
   */
  server.tool(
    RELEASE_TOOLS.list_approvals,
    "List release approvals (pending, approved, rejected)",
    {
      project: z.string().describe("Project ID or name"),
      assignedToFilter: z.string().optional().describe("Filter by approver (user ID or 'me')"),
      statusFilter: z.enum(["Undefined", "Pending", "Approved", "Rejected", "Reassigned", "Canceled", "Skipped"])
        .default("Pending")
        .describe("Filter by approval status"),
      releaseIdsFilter: z.array(z.number()).optional().describe("Filter by specific release IDs"),
      typeFilter: z.enum(["Undefined", "PreDeploy", "PostDeploy", "All"])
        .default("All")
        .describe("Filter by approval type"),
      top: z.number().default(50).optional().describe("Maximum number of approvals to return"),
      continuationToken: z.number().optional().describe("Continuation token for pagination")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        const approvals = await releaseApi.getApprovals(
          params.project,
          params.assignedToFilter,
          safeEnumConvert(ApprovalStatus, params.statusFilter),
          params.releaseIdsFilter,
          safeEnumConvert(ApprovalType, params.typeFilter),
          params.top,
          params.continuationToken
        );
        
        return {
          content: [{ type: "text", text: JSON.stringify(approvals, null, 2) }]
        };
      } catch (error) {
        throw new Error(`List approvals failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  /**
   * Tool 14: Update Approval (NEW)
   */
  server.tool(
    RELEASE_TOOLS.update_approval,
    "Approve or reject a release approval",
    {
      project: z.string().describe("Project ID or name"),
      approvalId: z.number().describe("Approval ID"),
      status: z.enum(["Approved", "Rejected", "Pending", "Reassigned", "Canceled", "Skipped"])
        .describe("Approval status (typically 'Approved' or 'Rejected')"),
      comments: z.string().optional().describe("Approval comments"),
      reassignTo: z.string().optional().describe("Reassign to user (when status is 'Reassigned')")
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();
        
        const approval = {
          status: safeEnumConvert(ApprovalStatus, params.status),
          comments: params.comments || "",
          approver: params.reassignTo ? { displayName: params.reassignTo } : undefined
        };
        
        const result = await releaseApi.updateReleaseApproval(
          approval,
          params.project,
          params.approvalId
        );
        
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`Update approval failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

export { RELEASE_TOOLS, configureReleaseTools };
