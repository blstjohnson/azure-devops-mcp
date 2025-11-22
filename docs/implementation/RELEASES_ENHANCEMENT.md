# Releases Tools Enhancement Implementation Guide

**Category**: Releases  
**File**: `src/tools/releases.ts` (ENHANCEMENT - 2 existing tools)  
**Test File**: `test/src/tools/releases.test.ts` (TO BE CREATED)  
**Tool Count**: 13 (2 existing + 11 new)  
**API Version**: 6.0 (Server 2020 compatible)

---

## Overview

This document specifies the enhancement of the existing Releases tools from 2 basic tools to a comprehensive 13-tool suite enabling full release lifecycle management including release creation, deployment, approvals, and environment management.

### Current Implementation Status

**Existing Tools** (in `src/tools/releases.ts`):
1. ✅ `release_get_definitions` - List release definitions (comprehensive with filtering)
2. ✅ `release_get_releases` - List releases (comprehensive with filtering)

**Enhancement Plan** - Add 11 new tools:
3. 🆕 `release_get_definition` - Get single release definition
4. 🆕 `release_create_definition` - Create release definition
5. 🆕 `release_update_definition` - Update release definition
6. 🆕 `release_delete_definition` - Delete release definition
7. 🆕 `release_get_release` - Get single release
8. 🆕 `release_create_release` - Create a new release
9. 🆕 `release_update_release` - Update release properties
10. 🆕 `release_abandon_release` - Abandon a release
11. 🆕 `release_deploy_environment` - Deploy a release to environment/stage
12. 🆕 `release_get_environment` - Get environment/stage details
13. 🆕 `release_list_approvals` - List pending approvals
14. 🆕 `release_update_approval` - Approve or reject an approval

---

## Tool Names (Updated)

```typescript
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
```

---

## Enhanced Implementation: src/tools/releases.ts

```typescript
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
import { getEnumKeys, safeEnumConvert } from "../utils.js";
import { getAuthorizationHeader } from "../utils.js";

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
    async (params) => {
      const connection = await connectionProvider();
      const releaseApi = await connection.getReleaseApi();
      const releaseDefinitions = await releaseApi.getReleaseDefinitions(
        params.project,
        params.searchText,
        safeEnumConvert(ReleaseDefinitionExpands, params.expand),
        params.artifactType,
        params.artifactSourceId,
        params.top,
        params.continuationToken,
        safeEnumConvert(ReleaseDefinitionQueryOrder, params.queryOrder),
        params.path,
        params.isExactNameMatch,
        params.tagFilter,
        params.propertyFilters,
        params.definitionIdFilter,
        params.isDeleted,
        params.searchTextContainsFolderName
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
    async (params) => {
      const connection = await connectionProvider();
      const releaseApi = await connection.getReleaseApi();
      const releases = await releaseApi.getReleases(
        params.project,
        params.definitionId,
        params.definitionEnvironmentId,
        params.searchText,
        params.createdBy,
        safeEnumConvert(ReleaseStatus, params.statusFilter),
        params.environmentStatusFilter,
        params.minCreatedTime,
        params.maxCreatedTime,
        safeEnumConvert(ReleaseQueryOrder, params.queryOrder),
        params.top,
        params.continuationToken,
        safeEnumConvert(ReleaseExpands, params.expand),
        params.artifactTypeId,
        params.sourceId,
        params.artifactVersionId,
        params.sourceBranchFilter,
        params.isDeleted,
        params.tagFilter,
        params.propertyFilters,
        params.releaseIdFilter,
        params.path
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
        
        const approvalFilters = params.includeAllApprovals ? 
          safeEnumConvert(ApprovalType, "All") : 
          safeEnumConvert(ApprovalType, "PreDeploy");
        
        const release = await releaseApi.getRelease(
          params.project,
          params.releaseId,
          approvalFilters,
          undefined,
          undefined,
          params.includeWorkItems
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
        
        const releaseStartMetadata = {
          definitionId: params.definitionId,
          description: params.description || "",
          artifacts: params.artifacts,
          isDraft: params.isDraft,
          reason: params.reason || "Triggered by API",
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
```

---

## Test Implementation: test/src/tools/releases.test.ts

```typescript
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureReleaseTools } from "../../../src/tools/releases";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureReleaseTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { serverUrl: string; getReleaseApi: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue({ token: "test-token" });
    mockConnection = {
      serverUrl: "https://dev.azure.com/test-org",
      getReleaseApi: jest.fn()
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers 13 release tools", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(13);
    });

    it("registers all expected tool names", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const calls = (server.tool as jest.Mock).mock.calls;
      const toolNames = calls.map(call => call[0]);
      
      // Existing tools
      expect(toolNames).toContain("release_get_definitions");
      expect(toolNames).toContain("release_get_releases");
      
      // New definition management
      expect(toolNames).toContain("release_get_definition");
      expect(toolNames).toContain("release_create_definition");
      expect(toolNames).toContain("release_update_definition");
      expect(toolNames).toContain("release_delete_definition");
      
      // New release management
      expect(toolNames).toContain("release_get_release");
      expect(toolNames).toContain("release_create_release");
      expect(toolNames).toContain("release_update_release");
      expect(toolNames).toContain("release_abandon_release");
      
      // New deployment
      expect(toolNames).toContain("release_deploy_environment");
      expect(toolNames).toContain("release_get_environment");
      
      // New approvals
      expect(toolNames).toContain("release_list_approvals");
      expect(toolNames).toContain("release_update_approval");
    });
  });

  describe("release_get_definition tool", () => {
    it("should get release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_get_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getReleaseDefinition: jest.fn().mockResolvedValue({
          id: 1,
          name: "Production Release",
          environments: [{ id: 10, name: "Production" }]
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 1
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(1);
      expect(parsed.name).toBe("Production Release");
      expect(mockApi.getReleaseDefinition).toHaveBeenCalledWith("TestProject", 1);
    });
  });

  describe("release_create_definition tool", () => {
    it("should create release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 5,
          name: "New Release Pipeline",
          environments: []
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        name: "New Release Pipeline",
        environments: [
          { name: "Development", rank: 1 },
          { name: "Production", rank: 2 }
        ],
        artifacts: [
          {
            sourceId: "build-1",
            type: "Build",
            alias: "_MyBuild"
          }
        ]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(5);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/release/definitions?"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("release_delete_definition tool", () => {
    it("should delete release definition", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_delete_definition"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        deleteReleaseDefinition: jest.fn().mockResolvedValue(undefined)
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 5
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.deletedDefinitionId).toBe(5);
    });
  });

  describe("release_create_release tool", () => {
    it("should create release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_create_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        createRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          definitionId: 1
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        definitionId: 1,
        artifacts: [
          {
            alias: "_MyBuild",
            instanceReference: {
              id: "123",
              name: "Build 20240101.1"
            }
          }
        ]
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(100);
      expect(mockApi.createRelease).toHaveBeenCalled();
    });
  });

  describe("release_deploy_environment tool", () => {
    it("should deploy to environment", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_deploy_environment"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 10,
          status: "inProgress",
          name: "Production"
        })
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);

      const params = {
        project: "TestProject",
        releaseId: 100,
        environmentId: 10,
        comment: "Deploying to production"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(10);
      expect(parsed.status).toBe("inProgress");
    });
  });

  describe("release_list_approvals tool", () => {
    it("should list pending approvals", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_list_approvals"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getApprovals: jest.fn().mockResolvedValue([
          {
            id: 1,
            status: "pending",
            release: { id: 100, name: "Release-1" }
          },
          {
            id: 2,
            status: "pending",
            release: { id: 101, name: "Release-2" }
          }
        ])
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        statusFilter: "Pending" as const
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].status).toBe("pending");
    });
  });

  describe("release_update_approval tool", () => {
    it("should approve an approval", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_approval"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        updateReleaseApproval: jest.fn().mockResolvedValue({
          id: 1,
          status: "approved",
          comments: "Looks good!"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        approvalId: 1,
        status: "Approved" as const,
        comments: "Looks good!"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.status).toBe("approved");
      expect(parsed.comments).toBe("Looks good!");
    });

    it("should reject an approval", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_update_approval"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        updateReleaseApproval: jest.fn().mockResolvedValue({
          id: 1,
          status: "rejected",
          comments: "Failed tests"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        approvalId: 1,
        status: "Rejected" as const,
        comments: "Failed tests"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.status).toBe("rejected");
    });
  });

  describe("release_abandon_release tool", () => {
    it("should abandon release", async () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "release_abandon_release"
      );
      if (!call) throw new Error("Tool not registered");
      const [, , , handler] = call;

      const mockApi = {
        getRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          status: "Active"
        }),
        updateRelease: jest.fn().mockResolvedValue({
          id: 100,
          name: "Release-1",
          status: "Abandoned"
        })
      };
      mockConnection.getReleaseApi.mockResolvedValue(mockApi);

      const params = {
        project: "TestProject",
        releaseId: 100,
        comment: "Cancelled deployment"
      };

      const result = await handler(params);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.status).toBe("Abandoned");
      expect(mockApi.updateRelease).toHaveBeenCalled();
    });
  });
});
```

---

## API Endpoints Reference

### Release Definitions API (v6.0)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| get_release_definitions | GET | `/{project}/_apis/release/definitions?api-version=6.0` |
| get_definition | GET | `/{project}/_apis/release/definitions/{definitionId}?api-version=6.0` |
| create_definition | POST | `/{project}/_apis/release/definitions?api-version=6.0` |
| update_definition | PUT | `/{project}/_apis/release/definitions/{definitionId}?api-version=6.0` |
| delete_definition | DELETE | `/{project}/_apis/release/definitions/{definitionId}?api-version=6.0` |

### Releases API (v6.0)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| get_releases | GET | `/{project}/_apis/release/releases?api-version=6.0` |
| get_release | GET | `/{project}/_apis/release/releases/{releaseId}?api-version=6.0` |
| create_release | POST | `/{project}/_apis/release/releases?api-version=6.0` |
| update_release | PUT | `/{project}/_apis/release/releases/{releaseId}?api-version=6.0` |
| abandon_release | PUT | `/{project}/_apis/release/releases/{releaseId}?api-version=6.0` |

### Deployments API (v6.0-preview.1)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| deploy_environment | PATCH | `/{project}/_apis/release/releases/{releaseId}/environments/{environmentId}?api-version=6.0-preview.1` |
| get_environment | GET | Via getReleaseApi().getRelease() then filter environments |

### Approvals API (v6.0)

| Tool | HTTP Method | Endpoint Pattern |
|------|-------------|------------------|
| list_approvals | GET | `/{project}/_apis/release/approvals?api-version=6.0` |
| update_approval | PATCH | `/{project}/_apis/release/approvals/{approvalId}?api-version=6.0` |

---

## Implementation Checklist

- [ ] Update `src/tools/releases.ts` with 11 new tools (keep 2 existing)
- [ ] Update `RELEASE_TOOLS` constant with all 13 tool names
- [ ] Import necessary enums from ReleaseInterfaces
- [ ] Implement all new tools following existing patterns
- [ ] Create `test/src/tools/releases.test.ts` with comprehensive tests
- [ ] Test all new tools with mocked APIs
- [ ] Test deployment workflows (create release → deploy → approve)
- [ ] Achieve >90% test coverage
- [ ] Validate tool names with ESLint
- [ ] Test on Server 2020 and Cloud
- [ ] Verify integration with existing 2 tools

---

## Server 2020 Compatibility Notes

✅ **Fully Supported on Server 2020 Update 1**
- All Release Definition APIs available in v6.0
- All Release Management APIs available in v6.0
- Deployment APIs available in v6.0-preview.1
- Approval APIs fully functional

⚠️ **Deployment Considerations**
- Agent queues must be properly configured
- Approvers must have appropriate permissions
- Service connections must exist before use in releases
- Variable groups referenced must be accessible

⚠️ **Approval Workflow**
- Pre-deployment approvals must be configured in definition
- Post-deployment approvals require environment setup
- Manual intervention tasks are separate from approvals
- Test approval workflows in non-production first

---

## Common Release Workflows

### 1. Create and Deploy a Release

```
1. release_create_release (with artifacts from build)
2. release_deploy_environment (trigger deployment to first stage)
3. Wait for deployment
4. release_list_approvals (check for pending approvals)
5. release_update_approval (approve next stage)
6. release_deploy_environment (deploy to next stage)
```

### 2. Abandon Failed Release

```
1. release_get_release (check status)
2. release_abandon_release (stop all deployments)
```

### 3. Create New Release Pipeline

```
1. release_create_definition (with environments and artifacts)
2. release_create_release (create first release)
3. release_deploy_environment (deploy to dev)
```

---

## Migration from Existing Implementation

**IMPORTANT**: The existing 2 tools remain unchanged. New code should:
1. Keep existing tool implementations as-is
2. Add 11 new tools after existing ones
3. Update RELEASE_TOOLS constant to include all 13 names
4. Maintain backward compatibility
5. Follow established naming patterns

**Testing Strategy**:
1. Test existing 2 tools continue to work
2. Test each new tool independently
3. Test integration workflows (create → deploy → approve)
4. Test error handling and edge cases
5. Verify Server 2020 compatibility

---

## Error Handling Patterns

All new tools should handle:
- Not found (404): Release/definition/approval doesn't exist
- Forbidden (403): Insufficient permissions
- Conflict (409): Release in use, cannot delete
- Bad Request (400): Invalid parameters
- Unauthorized (401): Authentication failed

Example error handling:
```typescript
if (!response.ok) {
  const errorText = await response.text();
  if (response.status === 404) {
    throw new Error(`Release ${params.releaseId} not found`);
  }
  throw new Error(`Failed to ...: ${response.status} ${errorText}`);
}