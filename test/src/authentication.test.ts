// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { getAuthorizationHeader, getServiceBaseUrl } from "../../src/utils";
import { WebApi } from "azure-devops-node-api";

describe("Authentication Utils", () => {
  describe("getAuthorizationHeader", () => {
    describe("Azure DevOps Services (Cloud)", () => {
      it("should return Bearer authentication for dev.azure.com", () => {
        const serverUrl = "https://dev.azure.com/myorg";
        const token = "test-token-123";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        expect(result).toBe("Bearer test-token-123");
      });

      it("should return Bearer authentication for vsrm.dev.azure.com", () => {
        const serverUrl = "https://vsrm.dev.azure.com/myorg";
        const token = "test-token-456";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        expect(result).toBe("Bearer test-token-456");
      });

      it("should handle different organization names", () => {
        const serverUrl = "https://dev.azure.com/contoso";
        const token = "contoso-token";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        expect(result).toBe("Bearer contoso-token");
      });
    });

    describe("On-premise/Private Servers", () => {
      it("should return Basic authentication for on-premise server", () => {
        const serverUrl = "https://tfs.company.com/DefaultCollection";
        const token = "pat-token-xyz";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        // Basic auth with empty username should be :token encoded in base64
        const expectedCredentials = Buffer.from(`:${token}`).toString('base64');
        expect(result).toBe(`Basic ${expectedCredentials}`);
      });

      it("should return Basic authentication for custom domain", () => {
        const serverUrl = "https://azuredevops.mycompany.com";
        const token = "my-pat-token";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        const expectedCredentials = Buffer.from(`:${token}`).toString('base64');
        expect(result).toBe(`Basic ${expectedCredentials}`);
      });

      it("should return Basic authentication for localhost development", () => {
        const serverUrl = "http://localhost:8080/tfs";
        const token = "dev-token";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        const expectedCredentials = Buffer.from(`:${token}`).toString('base64');
        expect(result).toBe(`Basic ${expectedCredentials}`);
      });

      it("should return Basic authentication for IP address", () => {
        const serverUrl = "https://192.168.1.100:8080";
        const token = "internal-token";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        const expectedCredentials = Buffer.from(`:${token}`).toString('base64');
        expect(result).toBe(`Basic ${expectedCredentials}`);
      });
    });

    describe("Edge cases", () => {
      it("should handle empty token", () => {
        const serverUrl = "https://dev.azure.com/myorg";
        const token = "";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        expect(result).toBe("Bearer ");
      });

      it("should handle empty token for private server", () => {
        const serverUrl = "https://tfs.company.com";
        const token = "";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        const expectedCredentials = Buffer.from(":").toString('base64');
        expect(result).toBe(`Basic ${expectedCredentials}`);
      });

      it("should handle token with special characters", () => {
        const serverUrl = "https://dev.azure.com/myorg";
        const token = "token-with-special-chars!@#$%";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        expect(result).toBe("Bearer token-with-special-chars!@#$%");
      });

      it("should handle token with special characters for private server", () => {
        const serverUrl = "https://tfs.company.com";
        const token = "token-with-special-chars!@#$%";
        
        const result = getAuthorizationHeader(serverUrl, token);
        
        const expectedCredentials = Buffer.from(`:token-with-special-chars!@#$%`).toString('base64');
        expect(result).toBe(`Basic ${expectedCredentials}`);
      });
    });
  });

  describe("getServiceBaseUrl", () => {
    let mockConnection: WebApi;

    beforeEach(() => {
      mockConnection = {
        serverUrl: ""
      } as WebApi;
    });

    describe("Azure DevOps Services (Cloud)", () => {
      it("should return search service URL for dev.azure.com with orgName", () => {
        mockConnection.serverUrl = "https://dev.azure.com/contoso";
        
        const result = getServiceBaseUrl(mockConnection, 'search', 'contoso');
        
        expect(result).toBe("https://almsearch.dev.azure.com/contoso");
      });

      it("should return identity service URL for dev.azure.com with orgName", () => {
        mockConnection.serverUrl = "https://dev.azure.com/contoso";
        
        const result = getServiceBaseUrl(mockConnection, 'identity', 'contoso');
        
        expect(result).toBe("https://vssps.dev.azure.com/contoso/_apis/identities");
      });

      it("should extract org name from URL when not provided", () => {
        mockConnection.serverUrl = "https://dev.azure.com/fabrikam";
        
        const result = getServiceBaseUrl(mockConnection, 'search', undefined);
        
        expect(result).toBe("https://almsearch.dev.azure.com/fabrikam");
      });

      it("should extract org name from URL for identity service", () => {
        mockConnection.serverUrl = "https://dev.azure.com/fabrikam";
        
        const result = getServiceBaseUrl(mockConnection, 'identity', undefined);
        
        expect(result).toBe("https://vssps.dev.azure.com/fabrikam/_apis/identities");
      });
    });

    describe("On-premise/Private Servers", () => {
      it("should return server URL for on-premise server", () => {
        mockConnection.serverUrl = "https://tfs.company.com/DefaultCollection";
        
        const result = getServiceBaseUrl(mockConnection, 'search', undefined);
        
        expect(result).toBe("https://tfs.company.com/DefaultCollection");
      });

      it("should return server URL for custom domain", () => {
        mockConnection.serverUrl = "https://azuredevops.mycompany.com";
        
        const result = getServiceBaseUrl(mockConnection, 'identity', undefined);
        
        expect(result).toBe("https://azuredevops.mycompany.com");
      });

      it("should return server URL for localhost", () => {
        mockConnection.serverUrl = "http://localhost:8080/tfs";
        
        const result = getServiceBaseUrl(mockConnection, 'search', 'testorg');
        
        expect(result).toBe("http://localhost:8080/tfs");
      });
    });

    describe("Edge cases", () => {
      it("should handle malformed dev.azure.com URL", () => {
        mockConnection.serverUrl = "https://dev.azure.com";
        
        const result = getServiceBaseUrl(mockConnection, 'search', undefined);
        
        expect(result).toBe("https://dev.azure.com");
      });

      it("should prefer provided orgName over extracted one", () => {
        mockConnection.serverUrl = "https://dev.azure.com/extracted-org";
        
        const result = getServiceBaseUrl(mockConnection, 'search', 'provided-org');
        
        expect(result).toBe("https://almsearch.dev.azure.com/provided-org");
      });
    });
  });
});