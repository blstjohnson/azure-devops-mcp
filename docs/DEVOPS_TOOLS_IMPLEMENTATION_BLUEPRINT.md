
# DevOps Tools Implementation Blueprint

**Purpose**: Ready-to-implement code patterns for Pipelines, Environments, and Variable Groups tools.

---

## 1. Critical Implementation Patterns

### 1.1 Standard Tool Structure

```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getAuthorizationHeader } from "../utils.js";

const {CATEGORY}_TOOLS = {
  action: "{category}_action"
};

const apiVersionConstant = "6.0-preview.1"; // Server 2020 compatible

function configure{Category}Tools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  server.tool(
    {CATEGORY}_TOOLS.action,
    "Tool description",
    {
      project: z.string().describe("Project ID or name"),
      // ... more schema fields
    },
    async (params) => {
      try {
        const connection = await connectionProvider();
        const token = await tokenProvider();
        const baseUrl = connection.serverUrl;
        const endpoint = `${baseUrl}/${params.project}/_apis/{area}?api-version=${apiVersionConstant}`;
        
        const response = await fetch(endpoint, {
          method: "GET/POST/PUT/PATCH/DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthorizationHeader(baseUrl, token.token)
          },
          body: JSON.stringify(requestBody) // For POST/PUT/PATCH
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Operation failed: ${response.status} ${errorText}`);
        }
        
        const result = await response.json(); // or .text() for logs
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        throw new Error(`{Action} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}

export { {CATEGORY}_TOOLS, configure{Category}Tools };
```

### 1.2 Test Structure Pattern

```typescript
import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configure{Category}Tools } from "../../../src/tools/{category}";

