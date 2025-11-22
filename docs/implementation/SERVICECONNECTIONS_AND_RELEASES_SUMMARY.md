# Service Connections and Releases Tools - Architecture Summary

**Date**: 2024-12-22  
**Author**: Architect Mode  
**Status**: Implementation Ready

---

## Executive Summary

This document provides a comprehensive architecture for implementing:

1. **Service Connections Tools** - 7 new tools for complete service endpoint lifecycle management
2. **Releases Tools Enhancement** - 11 new tools (expanding from 2 to 13 total) for complete release lifecycle management

Both implementations follow established patterns from Environments, Pipelines, and Variable Groups implementations and are fully compatible with Azure DevOps Server 2020 Update 1.

---

## Implementation Overview

### Service Connections (NEW)

**File**: `src/tools/serviceconnections.ts` (NEW FILE)  
**Test File**: `test/src/tools/serviceconnections.test.ts` (NEW FILE)  
**Tool Count**: 7 tools  
**API Version**: 6.0-preview.4

#### Tools Breakdown:
1. `serviceconnections_list` - List service connections with filtering
2. `serviceconnections_get` - Get single connection with redacted credentials
3. `serviceconnections_create` - Create new service connection
4. `serviceconnections_update` - Update existing connection
5. `serviceconnections_delete` - Delete service connection
6. `serviceconnections_share_with_project` - Share across projects
7. `serviceconnections_get_connection_data` - Get execution history

**Key Features**:
- ✅ Complete CRUD operations
- ✅ Automatic credential redaction for security
- ✅ Support for multiple connection types (Azure RM, GitHub, Docker, Kubernetes, etc.)
- ✅ Cross-project sharing capabilities
- ✅ Execution history tracking

### Releases Enhancement (ENHANCEMENT)

**File**: `src/tools/releases.ts` (ENHANCE EXISTING)  
**Test File**: `test/src/tools/releases.test.ts` (CREATE NEW)  
**Tool Count**: 13 tools (2 existing + 11 new)  
**API Version**: 6.0

#### Existing Tools (Keep as-is):
1. ✅ `release_get_definitions` - List release definitions
2. ✅ `release_get_releases` - List releases

#### New Tools to Add:

**Definition Management** (4 tools):
3. 🆕 `release_get_definition` - Get single definition
4. 🆕 `release_create_definition` - Create release pipeline
5. 🆕 `release_update_definition` - Update definition
6. 🆕 `release_delete_definition` - Delete definition

**Release Management** (4 tools):
7. 🆕 `release_get_release` - Get single release
8. 🆕 `release_create_release` - Create new release
9. 🆕 `release_update_release` - Update release properties
10. 🆕 `release_abandon_release` - Abandon/cancel release

**Deployment** (2 tools):
11. 🆕 `release_deploy_environment` - Deploy to stage
12. 🆕 `release_get_environment` - Get stage details

**Approvals** (2 tools):
13. 🆕 `release_list_approvals` - List pending approvals
14. 🆕 `release_update_approval` - Approve/reject

**Key Features**:
- ✅ Full release lifecycle management
- ✅ Multi-stage deployment support
- ✅ Approval workflow management
- ✅ Environment/stage management
- ✅ Release abandonment capability

---

## Implementation Priority

### Phase 1: Service Connections (Week 1)
1. Create `src/tools/serviceconnections.ts`
2. Implement all 7 tools
3. Create `test/src/tools/serviceconnections.test.ts`
4. Achieve >90% test coverage
5. Add to `src/tools.ts` registration

### Phase 2: Releases Enhancement (Week 1-2)
1. Update `src/tools/releases.ts` with 11 new tools
2. Keep existing 2 tools unchanged
3. Create `test/src/tools/releases.test.ts`
4. Achieve >90% test coverage
5. Test integration with existing tools

### Phase 3: Integration Testing (Week 2)
1. Test all tools on Server 2020 Update 1
2. Test all tools on Azure DevOps Cloud
3. Validate credential security
4. Test workflow scenarios
5. Performance testing

---

## Technical Specifications

### Service Connections

#### API Endpoints
```
Base URL: {org-url}/{project}/_apis/serviceendpoint/endpoints

GET    /?api-version=6.0-preview.4                    (list)
GET    /{endpointId}?api-version=6.0-preview.4       (get)
POST   /?api-version=6.0-preview.4                    (create)
PUT    /{endpointId}?api-version=6.0-preview.4       (update)
DELETE /{endpointId}?api-version=6.0-preview.4       (delete)
PATCH  /_apis/serviceendpoint/endpoints/{id}         (share)
GET    /{endpointId}/executionhistory               (history)
```

#### Security Requirements
- **CRITICAL**: Redact all sensitive authorization parameters
- Sensitive keys: password, token, apitoken, secret, clientsecret, serviceprincipalkey, certificate, tenantid
- Pattern: `if (key.toLowerCase().includes(sensitiveKey)) value = "[REDACTED]"`

#### Supported Connection Types
| Type | Scheme | Common Use |
|------|--------|------------|
| azurerm | ServicePrincipal | Azure deployments |
| github | Token | GitHub integration |
| dockerregistry | UsernamePassword | Container registries |
| kubernetes | Kubernetes | K8s deployments |
| generic | Token/Basic | Custom services |

### Releases

#### API Endpoints
```
Base URL: {org-url}/{project}/_apis/release

# Definitions
GET    /definitions?api-version=6.0                      (list-existing)
GET    /definitions/{id}?api-version=6.0                 (get)
POST   /definitions?api-version=6.0                      (create)
PUT    /definitions/{id}?api-version=6.0                 (update)
DELETE /definitions/{id}?api-version=6.0                 (delete)

# Releases
GET    /releases?api-version=6.0                         (list-existing)
GET    /releases/{id}?api-version=6.0                    (get)
POST   /releases?api-version=6.0                         (create)
PUT    /releases/{id}?api-version=6.0                    (update)

# Deployments
PATCH  /releases/{id}/environments/{envId}              (deploy)
       ?api-version=6.0-preview.1

# Approvals
GET    /approvals?api-version=6.0                        (list)
PATCH  /approvals/{id}?api-version=6.0                   (update)
```

#### Workflow Support

**Standard Release Flow**:
```
1. Create release definition
   ↓
2. Create release with artifacts
   ↓
3. Deploy to environment 1 (Dev)
   ↓
4. Wait for approval
   ↓
5. Approve/reject
   ↓
6. Deploy to environment 2 (Prod)
```

---

## Code Patterns and Conventions

### Pattern 1: Tool Registration
```typescript
const TOOLS = {
  action_name: "category_action_name"
};

server.tool(
  TOOLS.action_name,
  "Clear description",
  { /* zod schema */ },
  async (params) => { /* implementation */ }
);
```

### Pattern 2: API Calls with fetch
```typescript
const connection = await connectionProvider();
const token = await tokenProvider();
const baseUrl = connection.serverUrl;

const endpoint = `${baseUrl}/{path}?api-version={version}`;

const response = await fetch(endpoint, {
  method: "GET/POST/PUT/DELETE",
  headers: {
    "Authorization": getAuthorizationHeader(baseUrl, token.token),
    "Content-Type": "application/json" // for POST/PUT
  },
  body: JSON.stringify(requestBody) // for POST/PUT
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Failed to ...: ${response.status} ${errorText}`);
}

const result = await response.json();
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

### Pattern 3: Using Azure DevOps Node API
```typescript
const connection = await connectionProvider();
const api = await connection.get{Service}Api(); // getReleaseApi(), etc.

const result = await api.method(params);

return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

### Pattern 4: Credential Redaction
```typescript
function redactSensitiveData(obj: any): any {
  const sensitiveKeys = ['password', 'token', 'secret', ...];
  
  if (obj.authorization?.parameters) {
    for (const [key, value] of Object.entries(obj.authorization.parameters)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        obj.authorization.parameters[key] = "[REDACTED]";
      }
    }
  }
  
  return obj;
}
```

### Pattern 5: Error Handling
```typescript
try {
  // API call
} catch (error) {
  throw new Error(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
}
```

---

## Testing Strategy

### Unit Testing Requirements

1. **Tool Registration Tests**
   - Verify correct number of tools registered
   - Verify all tool names are correct
   - Verify tool names follow naming convention

2. **Functionality Tests**
   - Test each tool with valid parameters
   - Test edge cases and boundaries
   - Test error conditions (404, 403, 400, etc.)

3. **Security Tests**
   - Verify credential redaction works
   - Test all sensitive parameter types
   - Ensure no secrets in responses

4. **Integration Tests**
   - Test tool workflows (create → use → delete)
   - Test cross-tool dependencies
   - Test Server 2020 compatibility

### Test Coverage Goals
- **Minimum**: 90% code coverage
- **Target**: 95% code coverage
- **Critical Paths**: 100% coverage (credential redaction, API calls)

### Mock Strategy
```typescript
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

const mockConnection = {
  serverUrl: "https://dev.azure.com/test-org",
  getReleaseApi: jest.fn() // for API-based tools
};

const mockResponse = {
  ok: true,
  json: jest.fn().mockResolvedValue({ /* data */ })
};

(global.fetch as jest.MockedFunction<typeof fetch>)
  .mockResolvedValue(mockResponse as any);
```

---

## Server 2020 Compatibility

### Verified Compatible APIs

✅ **Service Endpoints API 6.0-preview.4**
- All endpoints available on Server 2020 Update 1
- Full CRUD operations supported
- Sharing and execution history available

✅ **Release Definitions API 6.0**
- Complete definition management
- Environment configuration
- Artifact management
- Trigger configuration

✅ **Releases API 6.0**
- Release creation and management
- Status updates and abandonment
- Full release details retrieval

✅ **Deployments API 6.0-preview.1**
- Environment deployment
- Deployment status tracking
- Manual intervention support

✅ **Approvals API 6.0**
- Approval listing and filtering
- Approval updates (approve/reject)
- Pre/Post deployment approvals

### Known Limitations

⚠️ **Service Connections**
- Azure Key Vault integration requires Azure subscription
- GitHub Enterprise requires proper URL configuration
- Some connection types may need additional server setup

⚠️ **Releases**
- Agent queues must be configured
- Service connections must exist before use
- Variable groups must be accessible
- Approval permissions must be set correctly

---

## Security Considerations

### Critical Security Requirements

1. **Credential Redaction** (MANDATORY)
   - All service connection credentials MUST be redacted
   - Redaction applies to: passwords, tokens, secrets, certificates, tenant IDs
   - Apply redaction before returning ANY data to user

2. **Authorization**
   - Use PAT tokens for private servers
   - Use `getAuthorizationHeader()` utility for proper auth format
   - Never log or expose token values

3. **Input Validation**
   - Use Zod schemas for all parameters
   - Validate enum values with `safeEnumConvert()`
   - Sanitize user inputs before API calls

4. **Secret Management**
   - Service connection secrets are write-only
   - Never retrieve actual secret values
   - Mark secret fields clearly in schemas

---

## Integration Points

### Registration in src/tools.ts

```typescript
import { configureServiceConnectionsTools } from "./tools/serviceconnections.js";
import { configureReleaseTools } from "./tools/releases.js";

export function configureAllTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  // ... existing tools ...
  
  configureServiceConnectionsTools(server, tokenProvider, connectionProvider);
  configureReleaseTools(server, tokenProvider, connectionProvider);
  
  // ... other tools ...
}
```

### Copyright Headers

All new files must use:
```typescript
// Copyright (c) Ekassir Ltd.
// Licensed under the MIT License.
```

---

## Success Criteria

### Service Connections
- [ ] 7 tools implemented and tested
- [ ] >90% test coverage achieved
- [ ] Credential redaction verified
- [ ] All connection types tested
- [ ] Server 2020 compatibility confirmed
- [ ] Integration with pipelines tested

### Releases
- [ ] 11 new tools implemented (13 total)
- [ ] Existing 2 tools remain functional
- [ ] >90% test coverage achieved
- [ ] Full release workflow tested
- [ ] Approval workflow tested
- [ ] Server 2020 compatibility confirmed
- [ ] Multi-environment deployments tested

### Overall
- [ ] All tools follow naming conventions
- [ ] ESLint validation passes
- [ ] No TypeScript errors
- [ ] Documentation complete
- [ ] Code review approved
- [ ] Production deployment successful

---

## Implementation Resources

### Reference Documents
1. **Service Connections**: `docs/implementation/SERVICECONNECTIONS_IMPLEMENTATION.md`
2. **Releases Enhancement**: `docs/implementation/RELEASES_ENHANCEMENT.md`
3. **Environments Pattern**: `docs/implementation/ENVIRONMENTS_IMPLEMENTATION.md`
4. **Pipelines Pattern**: `docs/implementation/PIPELINES_IMPLEMENTATION.md`
5. **Variable Groups Pattern**: `docs/implementation/VARIABLEGROUPS_IMPLEMENTATION.md`

### Azure DevOps REST API Documentation
- Service Endpoints: https://learn.microsoft.com/en-us/rest/api/azure/devops/serviceendpoint/
- Release Management: https://learn.microsoft.com/en-us/rest/api/azure/devops/release/
- Server 2020 API Reference: Use api-version 6.0 or lower

---

## Next Steps for Code Mode

1. **Read Implementation Guides**:
   - Review `SERVICECONNECTIONS_IMPLEMENTATION.md` thoroughly
   - Review `RELEASES_ENHANCEMENT.md` thoroughly
   - Study the code examples and patterns

2. **Implement Service Connections**:
   - Create `src/tools/serviceconnections.ts`
   - Implement all 7 tools
   - Create comprehensive tests
   - Verify credential redaction

3. **Enhance Releases**:
   - Update `src/tools/releases.ts`
   - Add 11 new tools
   - Keep existing 2 tools unchanged
   - Create comprehensive tests

4. **Integration**:
   - Register in `src/tools.ts`
   - Run full test suite
   - Verify Server 2020 compatibility
   - Test real-world workflows

5. **Documentation**:
   - Update README if needed
   - Update CHANGELOG
   - Create usage examples

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| API version incompatibility | Use 6.0 or 6.0-preview.X only |
| Credential exposure | Mandatory redaction, automated tests |
| Server 2020 differences | Test on actual Server 2020 instance |
| Performance issues | Implement pagination, limit result sizes |

### Implementation Risks
| Risk | Mitigation |
|------|------------|
| Breaking existing tools | Keep existing releases tools unchanged |
| Test coverage gaps | Automated coverage reporting, >90% target |
| Security vulnerabilities | Security-focused code review, redaction tests |
| Complexity | Follow established patterns, comprehensive docs |

---

## Conclusion

This architecture provides a complete, implementation-ready specification for adding Service Connections and enhancing Releases tools. All designs follow established patterns, maintain Server 2020 compatibility, and include comprehensive security measures.

**Code mode can proceed directly to implementation using the detailed guides provided.**

**Estimated Implementation Time**: 1-2 weeks for both tool categories with comprehensive testing.

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Updated**: 2024-12-22  
**Review Required**: Before production deployment