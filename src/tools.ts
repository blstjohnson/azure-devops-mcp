// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { configureAdvSecTools } from "./tools/advsec.js";
import { configureBuildTools } from "./tools/builds.js";
import { configureCoreTools } from "./tools/core.js";
import { configureEnvironmentsTools } from "./tools/environments.js";
import { configurePipelinesTools } from "./tools/pipelines.js";
import { configureReleaseTools } from "./tools/releases.js";
import { configureRepoTools } from "./tools/repos.js";
import { configureSearchTools } from "./tools/search.js";
import { configureServiceConnectionsTools } from "./tools/serviceconnections.js";
import { configureTestPlanTools } from "./tools/testplans.js";
import { configureTestingTools } from "./tools/testing/index.js";
import { configureVariableGroupsTools } from "./tools/variablegroups.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureWorkTools } from "./tools/work.js";
import { configureWorkItemTools } from "./tools/workitems.js";

function configureAllTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string, orgName: string | undefined) {
  configureCoreTools(server, tokenProvider, connectionProvider, orgName);
  configureWorkTools(server, tokenProvider, connectionProvider);
  configureBuildTools(server, tokenProvider, connectionProvider);
  configureRepoTools(server, tokenProvider, connectionProvider);
  configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureReleaseTools(server, tokenProvider, connectionProvider);
  configureWikiTools(server, tokenProvider, connectionProvider);
  configureTestPlanTools(server, tokenProvider, connectionProvider);
  configureTestingTools(server, tokenProvider, connectionProvider);
  configureVariableGroupsTools(server, tokenProvider, connectionProvider);
  configureEnvironmentsTools(server, tokenProvider, connectionProvider);
  configurePipelinesTools(server, tokenProvider, connectionProvider);
  configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
  configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider, orgName);
  configureAdvSecTools(server, tokenProvider, connectionProvider);
}

export { configureAllTools };
