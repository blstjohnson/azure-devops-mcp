# Azure DevOps XML Formatting Best Practices

## Overview
This document outlines best practices for generating XML content that is compatible with Azure DevOps Web UI, specifically for test case steps.

## Critical Requirements for Azure DevOps Web UI Compatibility

### 1. Required Attributes
All `<parameterizedString>` elements **MUST** include the `isformatted="true"` attribute:

```xml
<parameterizedString isformatted="true">Step content</parameterizedString>
```

**❌ Incorrect (causes Web UI rendering failure):**
```xml
<parameterizedString>Step content</parameterizedString>
```

**✅ Correct:**
```xml
<parameterizedString isformatted="true">Step content</parameterizedString>
```

### 2. Consistent Step Structure
Each `<step>` element **MUST** contain exactly 2 `<parameterizedString>` elements:
1. First: Step action/instruction
2. Second: Expected result

```xml
<step id="1" type="ActionStep">
    <parameterizedString isformatted="true">Step action</parameterizedString>
    <parameterizedString isformatted="true">Expected result</parameterizedString>
</step>
```

### 3. Forbidden Elements
**NEVER** use `<description>` elements in test steps. Azure DevOps Web UI cannot parse them correctly:

**❌ Incorrect:**
```xml
<step id="1" type="ActionStep">
    <parameterizedString isformatted="true">Step action</parameterizedString>
    <description>Expected result</description>
</step>
```

### 4. Proper XML Escaping
All content **MUST** be properly XML-escaped for special characters:

| Character | Escape Sequence |
|-----------|----------------|
| `<`       | `&lt;`         |
| `>`       | `&gt;`         |
| `&`       | `&amp;`        |
| `"`       | `&quot;`       |
| `'`       | `&apos;`       |

## Complete Valid XML Structure

```xml
<steps id="0" last="2">
    <step id="1" type="ActionStep">
        <parameterizedString isformatted="true">Navigate to login page</parameterizedString>
        <parameterizedString isformatted="true">Login form is displayed</parameterizedString>
    </step>
    <step id="2" type="ActionStep">
        <parameterizedString isformatted="true">Enter credentials &amp; click login</parameterizedString>
        <parameterizedString isformatted="true">User is redirected to dashboard</parameterizedString>
    </step>
</steps>
```

## Implementation Guidelines

### Use Consolidated XML Processing
Always use the centralized [`convertStepsToXml`](../src/tools/testing/utils.ts) function:

```typescript
import { convertStepsToXml } from "./testing/utils.js";

const stepsXml = convertStepsToXml(stepString);
```

### Input Format
Use this standardized format for step input:
```
1. Step action|Expected result
2. Another step|Another expected result
```

### Handle Edge Cases
- **Empty steps**: Function returns empty string
- **Missing expected results**: Defaults to "Verify step completes successfully"
- **Unicode content**: Properly preserved and escaped
- **Empty step text**: Defaults to "Step N" where N is step number

## Common Issues and Solutions

### Issue: Steps visible in database but not in Web UI
**Cause**: Missing `isformatted="true"` attributes
**Solution**: Use the consolidated `convertStepsToXml` function

### Issue: Inconsistent step structure
**Cause**: Different XML formats between creation and update
**Solution**: All tools now use the same XML processing function

### Issue: Special characters breaking XML
**Cause**: Improper escaping
**Solution**: Built-in `escapeXml` function handles all cases

## Testing and Validation

### Required Tests
1. **Basic functionality**: Simple steps with expected results
2. **Edge cases**: Empty inputs, missing expected results
3. **Special characters**: XML entities, Unicode content
4. **Web UI compatibility**: Verify `isformatted="true"` attributes
5. **Structure validation**: Exactly 2 `<parameterizedString>` per step

### Validation Checklist
- [ ] All `<parameterizedString>` elements have `isformatted="true"`
- [ ] Each step has exactly 2 `<parameterizedString>` elements
- [ ] No `<description>` elements present
- [ ] Proper XML escaping applied
- [ ] Valid XML structure generated
- [ ] Web UI can render the steps correctly

## Maintenance

### When Adding New Tools
1. Import `convertStepsToXml` from `testing/utils.js`
2. Use the standardized input format
3. Add comprehensive tests
4. Validate with real Azure DevOps instance

### Code Review Requirements
- Verify no direct XML generation (must use utility functions)
- Check test coverage for XML formatting
- Validate Azure DevOps Web UI compatibility

## References
- [Test Case Update Implementation](../src/tools/testing/testcases.ts)
- [Test Plan Creation Implementation](../src/tools/testplans.ts)
- [XML Processing Utilities](../src/tools/testing/utils.ts)
- [Comprehensive Test Suite](../test/src/tools/testing/utils.test.ts)