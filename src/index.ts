#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport  } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import { AccessToken, AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";
import express from "express";
import type { Request, Response } from "express";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Buffer } from 'buffer';
import { IRequestHandler } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js";

import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 [organization]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name",
      type: "string",
    });
  })
  .option("server-url", {
    alias: "s",
    describe: "Azure DevOps server URL (e.g. 'https://your-server/azdevops')",
    type: "string",
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, required for multi-tenant scenarios)",
    type: "string",
  })
  .option("transport", {
    describe: "Transport protocol to use (stdio or http-streaming)",
    type: "string",
    default: "stdio",
    choices: ["stdio", "http-streaming"],
  })
  .option("http-port", {
    describe: "Port for HTTP streaming transport",
    type: "number",
    default: 3000,
  })
  .help()
  .parseSync();

export let orgName = argv.organization as string | undefined;
let serverUrl = argv["server-url"] as string | undefined;
let tenantId = argv.tenant;

const orgUrl: string = serverUrl || (orgName ? "https://dev.azure.com/" + orgName : "");

if (!orgUrl) {
  throw new Error("Either an Azure DevOps organization name or a server URL must be provided.");
}
console.log(`[DEBUG] orgName: ${orgName}`);
console.log(`[DEBUG] serverUrl: ${serverUrl}`);
console.log(`[DEBUG] tenantId: ${tenantId}`);
console.log(`[DEBUG] Final orgUrl: ${orgUrl}`);
console.log(`[DEBUG] Selected transport: ${argv.transport}`);

async function getAzureDevOpsToken(): Promise<AccessToken> {
  if (process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS) {
    process.env.AZURE_TOKEN_CREDENTIALS = process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS;
  } else {
    process.env.AZURE_TOKEN_CREDENTIALS = "dev";
  }
  let credential: TokenCredential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
  if (tenantId) {
    // Use Azure CLI credential if tenantId is provided for multi-tenant scenarios
    const azureCliCredential = new AzureCliCredential({ tenantId });
    credential = new ChainedTokenCredential(azureCliCredential, credential);
  }

  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  if (!token) {
    throw new Error("Failed to obtain Azure DevOps token. Ensure you have Azure CLI logged in or another token source setup correctly.");
  }
  return token;
}

function getAzureDevOpsClient(tokenProvider: () => Promise<AccessToken>, userAgentComposer: UserAgentComposer): () => Promise<azdev.WebApi> {
  return async () => {
    const token = await tokenProvider();
    let authHandler: IRequestHandler;

    if (orgUrl.includes("dev.azure.com") || orgUrl.includes("vsrm.dev.azure.com")) { // Check for cloud and releases
      authHandler = azdev.getBearerHandler(token.token);
    } else {
      // For on-premise, convert bearer token to basic auth (empty username, PAT as password)
      authHandler = azdev.getBasicHandler('', token.token);
    }

    const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };

  configurePrompts(server);

  configureAllTools(server, getAzureDevOpsToken, getAzureDevOpsClient(getAzureDevOpsToken, userAgentComposer), () => userAgentComposer.userAgent, orgName);

  if (argv.transport === "http-streaming") {
    const app = express();
    app.use(express.json());

    app.post("/mcp", async (req: Request, res: Response) => {
      console.log("[DEBUG] Received incoming MCP HTTP request.");
      console.time("[DEBUG] Request processing time");

      console.time("[DEBUG] McpServer instantiation");
      const requestServer = new McpServer({
        name: "Azure DevOps MCP Server",
        version: packageVersion,
      });
      console.timeEnd("[DEBUG] McpServer instantiation");

      console.time("[DEBUG] UserAgentComposer instantiation");
      const requestUserAgentComposer = new UserAgentComposer(packageVersion);
      requestServer.server.oninitialized = () => {
        requestUserAgentComposer.appendMcpClientInfo(requestServer.server.getClientVersion());
      };
      console.timeEnd("[DEBUG] UserAgentComposer instantiation");

      try {
        console.time("[DEBUG] StreamableHTTPServerTransport instantiation");
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        console.timeEnd("[DEBUG] StreamableHTTPServerTransport instantiation");

        const currentRequestToken = req.headers.authorization?.split(" ")[1];
        
        const getAuthTokenForRequest = async (): Promise<AccessToken> => {
            if (currentRequestToken) {
                console.log("[DEBUG] Using token from HTTP request header.");
                return { token: currentRequestToken, expiresOnTimestamp: new Date(Date.now() + 3600 * 1000).getTime() };
            }
            console.log("[DEBUG] Falling back to Azure Identity credentials.");
            return getAzureDevOpsToken();
        }

        console.time("[DEBUG] configurePrompts");
        configurePrompts(requestServer);
        console.timeEnd("[DEBUG] configurePrompts");

        console.time("[DEBUG] configureAllTools");
        configureAllTools(requestServer, getAuthTokenForRequest, getAzureDevOpsClient(getAuthTokenForRequest, requestUserAgentComposer), () => requestUserAgentComposer.userAgent, orgName);
        console.timeEnd("[DEBUG] configureAllTools");

        res.on("close", () => {
          console.log("[DEBUG] MCP HTTP request closed.");
          transport.close();
          requestServer.close();
        });

        console.time("[DEBUG] requestServer.connect");
        await requestServer.connect(transport);
        console.timeEnd("[DEBUG] requestServer.connect");
        
        console.time("[DEBUG] transport.handleRequest");
        await transport.handleRequest(req, res, req.body);
        console.timeEnd("[DEBUG] transport.handleRequest");

      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      } finally {
        console.timeEnd("[DEBUG] Request processing time");
      }
    });

    const port = argv["http-port"];
    app.listen(port, () => {
      console.log(`MCP HTTP Streaming Server listening on port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
