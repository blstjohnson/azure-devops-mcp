# Test Case XML Escaping Bug Analysis

## Issue Summary
Test case 378827 in project PSB has steps present in database but invisible in Azure DevOps Web UI due to malformed XML structure.

## Root Cause Analysis

### Expected XML Structure (from our code)
```xml
<steps id="0" last="2">
  <step id="1" type="ActionStep">
    <parameterizedString isformatted="true">Step text</parameterizedString>
    <parameterizedString isformatted="true">Expected result</parameterizedString>
  </step>
  <step id="2" type="ActionStep">
    <parameterizedString isformatted="true">Step text</parameterizedString>
    <parameterizedString isformatted="true">Expected result</parameterizedString>
  </step>
</steps>
```

### Actual Stored XML (test case 378827)
```xml
<steps id="0" last="2">
  <step id="1" type="ActionStep">
    <parameterizedString>Поместить файл configuration_1.csv</parameterizedString>
  </step>
  <step id="2" type="ActionStep">
    <parameterizedString>Запустить мигратор</parameterizedString>
    <description>- Конфигурация успешно создана\n- Файл перемещён в CompletedFilesDir</description>
  </step>
</steps>
```

## Critical Issues Identified

### 1. Missing Required Attributes
- **Issue**: `isformatted="true"` attribute missing from `<parameterizedString>` elements
- **Impact**: Azure DevOps Web UI cannot properly render the content
- **Location**: All `<parameterizedString>` elements

### 2. Inconsistent XML Structure  
- **Issue**: Different structure between steps
  - Step 1: Only one `<parameterizedString>` (missing expected result)
  - Step 2: `<parameterizedString>` + `<description>` (wrong element type)
- **Impact**: Parser confusion in Azure DevOps Web UI

### 3. Wrong Element Types
- **Issue**: Using `<description>` instead of second `<parameterizedString>` for expected results
- **Impact**: Azure DevOps expects specific schema with two `<parameterizedString>` elements per step

## Code Implementation Issues

### Duplicate XML Processing Functions
1. **`src/tools/testplans.ts`** (lines 229-276)
2. **`src/tools/testing/utils.ts`** (lines 167-217)

### Usage Inconsistency
- `testcase_update_case` → uses `utils.ts` version
- `testplan_create_test_case` → uses `testplans.ts` version  

## Technical Analysis

### Function Comparison
| Aspect | testplans.ts | utils.ts |
|--------|--------------|----------|
| Empty input handling | `filter(line.trim() !== "")` | Returns `""` for empty/whitespace |
| XML structure | Identical schema | Identical schema |
| Escaping logic | Same characters escaped | Same characters escaped |
| Required attributes | Includes `isformatted="true"` | Includes `isformatted="true"` |

### Schema Compliance Issues
The stored XML fails Azure DevOps schema validation due to:
1. Missing required `isformatted` attributes
2. Inconsistent step structure
3. Non-standard element usage (`<description>` vs `<parameterizedString>`)

## Reproduction Steps
1. Update test case using `testcase_update_case` tool
2. Provide steps with format: `"1. Step one|Expected result\n2. Step two|Expected result"`
3. Check stored XML in database vs Web UI visibility

## Solution Requirements

### Immediate Fixes
1. **Consolidate XML functions** - Single source of truth
2. **Enforce schema compliance** - Always include `isformatted="true"`
3. **Validate structure** - Each step must have exactly 2 `<parameterizedString>` elements
4. **Handle missing expected results** - Default to standard text when not provided

### Validation Needs
1. **Test with actual Azure DevOps instance**
2. **Verify Web UI rendering after fix**  
3. **Cross-tool compatibility testing**
4. **Unicode and special character handling**

## Risk Assessment
- **High**: Data visibility issues in production Azure DevOps
- **Medium**: Potential impact on other XML-generating tools
- **Low**: API functionality (data storage works correctly)

## Next Steps
1. Create unified XML processing function
2. Add comprehensive schema validation
3. Test fix with test case 378827
4. Audit all tools using XML formatting
5. Implement safeguards to prevent future regressions