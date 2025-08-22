# Work Item Attachments Architecture Specification

## Overview

This document provides a comprehensive architectural design for adding work item attachment functionality to the Azure DevOps MCP server. The design follows existing patterns in the codebase and integrates with the azure-devops-node-api library.

## Current State Analysis

### Existing Work Item Tools Structure
- 15 tools currently in `WORKITEM_TOOLS` constant
- Consistent pattern: tool registration, Zod schema validation, API integration, JSON response
- Connection provider pattern for Azure DevOps API access
- Error handling with try/catch blocks and structured error responses

### Reference Implementation (Test Attachments)
- Base64 encoding for binary content (lines 178-181, testexecution.ts)
- Attachment schema: `{ fileName: string, stream: string }` (schemas.ts:205-210)
- API integration patterns: createTestResultAttachment, getTestResultAttachments
- Error handling for attachment operations (lines 222-226, testexecution.ts)

## Architectural Design

### 1. Tool Specifications

#### 1.1 List Work Item Attachments (`wit_list_work_item_attachments`)

**Purpose**: Retrieve all attachments for a specific work item

**API Integration**: `workItemTrackingApi.getAttachments(workItemId, project)`

**Input Schema**:
```typescript
{
  workItemId: z.number().describe("The ID of the work item to list attachments for"),
  project: z.string().describe("The name or ID of the Azure DevOps project"),
  includeContent: z.boolean().default(false).describe("Whether to include attachment content URLs")
}
```

**Response Format**:
```typescript
{
  workItemId: number,
  attachments: [{
    id: string,
    fileName: string,
    comment?: string,
    createdDate: string,
    createdBy: IdentityRef,
    size: number,
    url?: string // if includeContent is true
  }],
  totalCount: number
}
```

#### 1.2 Download Work Item Attachment (`wit_download_work_item_attachment`)

**Purpose**: Download attachment content as base64-encoded data

**API Integration**: `workItemTrackingApi.getAttachment(id, fileName, project)`

**Input Schema**:
```typescript
{
  workItemId: z.number().describe("The ID of the work item"),
  attachmentId: z.string().describe("The ID of the attachment to download"),
  project: z.string().describe("The name or ID of the Azure DevOps project"),
  fileName: z.string().describe("The name of the attachment file"),
  includeMetadata: z.boolean().default(true).describe("Whether to include attachment metadata")
}
```

**Response Format**:
```typescript
{
  attachmentId: string,
  fileName: string,
  contentType: string,
  size: number,
  content: string, // base64 encoded
  metadata?: {
    createdDate: string,
    createdBy: IdentityRef,
    comment?: string
  }
}
```

#### 1.3 Upload Work Item Attachment (`wit_upload_work_item_attachment`)

**Purpose**: Upload a new attachment to a work item

**API Integration**: 
1. `workItemTrackingApi.createAttachment(uploadStream, project, fileName)`
2. `workItemTrackingApi.updateWorkItem()` to link attachment

**Input Schema**:
```typescript
{
  workItemId: z.number().describe("The ID of the work item to attach file to"),
  project: z.string().describe("The name or ID of the Azure DevOps project"),
  fileName: z.string()
    .min(1, "File name cannot be empty")
    .max(260, "File name too long")
    .regex(/^[^<>:"/\\|?*]+$/, "File name contains invalid characters")
    .describe("The name of the file to attach"),
  content: z.string().describe("Base64 encoded file content"),
  comment: z.string().max(1000).optional().describe("Optional comment for the attachment"),
  overwrite: z.boolean().default(false).describe("Whether to overwrite if file exists")
}
```

**Response Format**:
```typescript
{
  attachmentId: string,
  fileName: string,
  size: number,
  url: string,
  workItemId: number,
  uploadedDate: string,
  uploadedBy: IdentityRef
}
```

#### 1.4 Delete Work Item Attachment (`wit_delete_work_item_attachment`)

**Purpose**: Remove an attachment from a work item

**API Integration**: `workItemTrackingApi.deleteAttachment(id, project)`

**Input Schema**:
```typescript
{
  workItemId: z.number().describe("The ID of the work item"),
  attachmentId: z.string().describe("The ID of the attachment to delete"),
  project: z.string().describe("The name or ID of the Azure DevOps project"),
  fileName: z.string().describe("The name of the attachment file for verification"),
  force: z.boolean().default(false).describe("Force deletion without confirmation")
}
```

**Response Format**:
```typescript
{
  attachmentId: string,
  fileName: string,
  workItemId: number,
  deletedDate: string,
  deletedBy: IdentityRef,
  success: boolean
}
```

### 2. Complete Zod Schema Definitions

```typescript
// File validation patterns
const fileNameValidation = z.string()
  .min(1, "File name cannot be empty")
  .max(260, "File name too long")
  .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, "File name contains invalid characters")
  .refine(name => !name.match(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i), 
    "File name is reserved");

const base64ContentValidation = z.string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Invalid base64 content")
  .refine(content => {
    try {
      const decoded = Buffer.from(content, 'base64');
      return decoded.length > 0 && decoded.length <= 50 * 1024 * 1024; // 50MB limit
    } catch {
      return false;
    }
  }, "Content must be valid base64 and under 50MB");

// Schema definitions
export const listWorkItemAttachmentsSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  project: z.string().min(1, "Project cannot be empty"),
  includeContent: z.boolean().default(false)
});

export const downloadWorkItemAttachmentSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  attachmentId: z.string().min(1, "Attachment ID cannot be empty"),
  project: z.string().min(1, "Project cannot be empty"),
  fileName: fileNameValidation,
  includeMetadata: z.boolean().default(true)
});

export const uploadWorkItemAttachmentSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  project: z.string().min(1, "Project cannot be empty"),
  fileName: fileNameValidation,
  content: base64ContentValidation,
  comment: z.string().max(1000, "Comment too long").optional(),
  overwrite: z.boolean().default(false)
});

export const deleteWorkItemAttachmentSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  attachmentId: z.string().min(1, "Attachment ID cannot be empty"),
  project: z.string().min(1, "Project cannot be empty"),
  fileName: fileNameValidation,
  force: z.boolean().default(false)
});
```

### 3. Error Handling Strategy

#### 3.1 Error Categories

1. **Validation Errors**
   - Invalid work item ID
   - Invalid attachment ID
   - Invalid file name or content
   - Project not found

2. **Permission Errors**
   - Insufficient permissions to access work item
   - No permission to add/delete attachments
   - Project access denied

3. **Resource Errors**
   - Work item not found
   - Attachment not found
   - File size exceeds limits
   - Storage quota exceeded

4. **Operation Errors**
   - Upload failed
   - Download failed
   - Deletion failed
   - Corruption detected

#### 3.2 Error Response Pattern

```typescript
interface AttachmentError {
  code: string;
  message: string;
  details?: {
    workItemId?: number;
    attachmentId?: string;
    fileName?: string;
    operation: string;
  };
  suggestions?: string[];
}
```

#### 3.3 Error Handling Implementation

```typescript
function handleAttachmentError(error: any, operation: string, context: any): AttachmentError {
  if (error.status === 404) {
    return {
      code: "RESOURCE_NOT_FOUND",
      message: `Resource not found during ${operation}`,
      details: { ...context, operation },
      suggestions: ["Verify work item ID and attachment ID", "Check project permissions"]
    };
  }
  
  if (error.status === 403) {
    return {
      code: "INSUFFICIENT_PERMISSIONS",
      message: `Insufficient permissions for ${operation}`,
      details: { ...context, operation },
      suggestions: ["Request attachment permissions", "Contact project administrator"]
    };
  }
  
  // Handle other error types...
  return {
    code: "OPERATION_FAILED",
    message: `${operation} failed: ${error.message}`,
    details: { ...context, operation }
  };
}
```

### 4. Security Considerations

#### 4.1 File Type Validation

```typescript
const ALLOWED_FILE_EXTENSIONS = [
  '.txt', '.md', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
  '.zip', '.7z', '.tar', '.gz',
  '.log', '.json', '.xml', '.csv'
];

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar'
];

function validateFileType(fileName: string): { valid: boolean, reason?: string } {
  const ext = path.extname(fileName).toLowerCase();
  
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { valid: false, reason: `File type ${ext} is not allowed for security reasons` };
  }
  
  if (ALLOWED_FILE_EXTENSIONS.length > 0 && !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return { valid: false, reason: `File type ${ext} is not in the allowed list` };
  }
  
  return { valid: true };
}
```

#### 4.2 Content Validation

```typescript
function validateFileContent(content: string, fileName: string): { valid: boolean, reason?: string } {
  try {
    const buffer = Buffer.from(content, 'base64');
    
    // Size validation
    if (buffer.length > 50 * 1024 * 1024) {
      return { valid: false, reason: "File size exceeds 50MB limit" };
    }
    
    // Basic content validation
    if (buffer.length === 0) {
      return { valid: false, reason: "File content is empty" };
    }
    
    // Additional security checks can be added here
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: "Invalid base64 content" };
  }
}
```

#### 4.3 Permission Validation

```typescript
async function validateAttachmentPermissions(
  workItemId: number, 
  project: string, 
  operation: 'read' | 'write' | 'delete',
  workItemApi: any
): Promise<{ valid: boolean, reason?: string }> {
  try {
    // Check work item access
    const workItem = await workItemApi.getWorkItem(workItemId, undefined, undefined, undefined, project);
    if (!workItem) {
      return { valid: false, reason: "Work item not found or access denied" };
    }
    
    // Additional permission checks based on operation
    // This would integrate with Azure DevOps permission system
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: `Permission check failed: ${error.message}` };
  }
}
```

### 5. API Integration Patterns

#### 5.1 Upload Pattern

```typescript
async function uploadAttachment(params: UploadParams, connectionProvider: () => Promise<WebApi>) {
  const connection = await connectionProvider();
  const workItemApi = await connection.getWorkItemTrackingApi();
  
  // Step 1: Validate permissions
  const permCheck = await validateAttachmentPermissions(params.workItemId, params.project, 'write', workItemApi);
  if (!permCheck.valid) {
    throw new Error(permCheck.reason);
  }
  
  // Step 2: Create attachment
  const buffer = Buffer.from(params.content, 'base64');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  
  const attachmentRef = await workItemApi.createAttachment(stream, params.project, params.fileName);
  
  // Step 3: Link to work item
  const patchDocument = [{
    op: "add",
    path: "/relations/-",
    value: {
      rel: "AttachedFile",
      url: attachmentRef.url,
      attributes: {
        name: params.fileName,
        comment: params.comment || ""
      }
    }
  }];
  
  await workItemApi.updateWorkItem(null, patchDocument, params.workItemId, params.project);
  
  return {
    attachmentId: attachmentRef.id,
    fileName: params.fileName,
    size: buffer.length,
    url: attachmentRef.url
  };
}
```

#### 5.2 Download Pattern

```typescript
async function downloadAttachment(params: DownloadParams, connectionProvider: () => Promise<WebApi>) {
  const connection = await connectionProvider();
  const workItemApi = await connection.getWorkItemTrackingApi();
  
  // Step 1: Validate permissions
  const permCheck = await validateAttachmentPermissions(params.workItemId, params.project, 'read', workItemApi);
  if (!permCheck.valid) {
    throw new Error(permCheck.reason);
  }
  
  // Step 2: Get attachment content
  const attachmentStream = await workItemApi.getAttachment(params.attachmentId, params.fileName, params.project);
  
  // Step 3: Convert to base64
  const chunks: Buffer[] = [];
  for await (const chunk of attachmentStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const content = buffer.toString('base64');
  
  return {
    attachmentId: params.attachmentId,
    fileName: params.fileName,
    content,
    size: buffer.length
  };
}
```

### 6. Binary Content Handling Strategy

#### 6.1 Base64 Encoding
- Follow the pattern established in test attachments
- Use Node.js Buffer for reliable encoding/decoding
- Validate base64 format with regex patterns
- Handle large files with streaming when possible

#### 6.2 Memory Management
```typescript
const MAX_MEMORY_SIZE = 50 * 1024 * 1024; // 50MB
const STREAM_THRESHOLD = 10 * 1024 * 1024; // 10MB

function shouldUseStreaming(contentSize: number): boolean {
  return contentSize > STREAM_THRESHOLD;
}
```

#### 6.3 Content Type Detection
```typescript
function detectContentType(fileName: string, content?: Buffer): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    // ... more mappings
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}
```

### 7. Implementation Guidelines

#### 7.1 Tool Registration Pattern
```typescript
// Add to WORKITEM_TOOLS constant
const WORKITEM_TOOLS = {
  // ... existing tools
  list_work_item_attachments: "wit_list_work_item_attachments",
  download_work_item_attachment: "wit_download_work_item_attachment", 
  upload_work_item_attachment: "wit_upload_work_item_attachment",
  delete_work_item_attachment: "wit_delete_work_item_attachment"
};
```

#### 7.2 Error Response Pattern
```typescript
return {
  content: [{ type: "text", text: JSON.stringify(errorResponse, null, 2) }],
  isError: true
};
```

#### 7.3 Success Response Pattern
```typescript
return {
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
};
```

#### 7.4 Consistent Logging
```typescript
console.warn(`Attachment operation ${operation} failed for work item ${workItemId}:`, error);
```

### 8. Testing Strategy

#### 8.1 Unit Tests
- Schema validation tests
- File type validation tests
- Base64 encoding/decoding tests
- Permission validation tests

#### 8.2 Integration Tests
- Upload/download round-trip tests
- Error handling tests
- Large file handling tests
- Security validation tests

#### 8.3 Mock Data
```typescript
export const mockAttachment = {
  id: "12345-67890-abcdef",
  fileName: "test-document.pdf",
  content: "VGVzdCBjb250ZW50", // "Test content" in base64
  size: 12,
  workItemId: 12345
};
```

### 9. Performance Considerations

#### 9.1 Caching Strategy
- Cache attachment metadata for frequently accessed items
- Implement TTL for cached data
- Clear cache on attachment modifications

#### 9.2 Rate Limiting
- Implement operation-specific rate limits
- Monitor API usage patterns
- Provide user feedback on rate limit status

#### 9.3 Batch Operations
- Consider future batch upload/download capabilities
- Design for extensibility

### 10. Migration and Backwards Compatibility

#### 10.1 Schema Evolution
- Design schemas to be extensible
- Use optional fields for new features
- Maintain backwards compatibility

#### 10.2 API Versioning
- Follow Azure DevOps API versioning best practices
- Handle API version compatibility

## Conclusion

This architecture provides a comprehensive, secure, and scalable foundation for work item attachment functionality in the Azure DevOps MCP server. The design follows established patterns in the codebase while incorporating modern security practices and error handling strategies.

The implementation should be done incrementally, starting with the core functionality and gradually adding advanced features like security validation and performance optimizations.