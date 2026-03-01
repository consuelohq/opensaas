# Research: GitHub Response Formatting (Task 7cu)

**Task:** consuelo_on_call_coaching-7cu
**Status:** RESEARCH COMPLETE → PLANNING
**Date:** 2026-01-03

---

## Current State Analysis

### GitHub Workflow (`.github/workflows/consuelo-tag-handler.yml`)
**What it does:**
- Listens for `@consuelo` mentions in PR/issue comments
- Gathers PR context (files, diffs, commits)
- Calls GLM-4.7 API via Z.ai
- Posts AI response as comment
- Basic markdown formatting only

**Current Response Format:**
- Plain AI response from GLM-4.7
- Footer: `*🤖 Powered by Consuelo (GLM-4.7 via Z.ai)*`
- No structured formatting
- No code block syntax highlighting
- No collapsible sections
- No emoji categorization

**Key Lines:**
- Line 119-236: API call with basic prompt
- Line 238-250: Post response to GitHub
- Line 146-152: Instructions to AI (mentions "GitHub-flavored markdown" but no specific structure)

### Problems to Solve
1. ❌ Code blocks lack syntax highlighting (no language specifiers)
2. ❌ Long responses are hard to read (no collapsible sections)
3. ❌ No clear structure (headings, sections, formatting)
4. ❌ File references don't link to code (e.g., `PaymentModal.tsx:45`)
5. ❌ No emoji icons for visual scanning (security, tests, docs)
6. ❌ No action items checklist at end
7. ❌ No truncation warnings for long responses (GitHub limit: 65535 chars)
8. ❌ Error messages are basic, not formatted

---

## Implementation Plan

### STEP 1: Create Response Formatter Script
**File:** `.github/workflows/scripts/format-response.js`
**Purpose:** Post-process AI responses to add structure and formatting

**Functions to implement:**
1. `formatCodeBlocks(text)` - Add language syntax highlighting
2. `formatFileReferences(text)` - Convert file:line to GitHub links
3. `addCollapsibleSections(text)` - Wrap long sections in `<details>` tags
4. `addEmojiHeaders(text)` - Add emoji icons to section headers
5. `addActionItems(text)` - Extract/format action items checklist
6. `addFooter(text, metadata)` - Branded footer with model info
7. `truncateIfNeeded(text, limit)` - Truncate and warn if > 65535 chars
8. `formatErrorMessage(error)` - Structure error messages clearly

**Main function:**
```javascript
function formatResponse(aiResponse, prContext, options = {}) {
  let formatted = aiResponse;

  // Apply formatting transformations
  formatted = formatCodeBlocks(formatted);
  formatted = formatFileReferences(formatted, prContext);
  formatted = addCollapsibleSections(formatted);
  formatted = addEmojiHeaders(formatted);
  formatted = addActionItems(formatted);
  formatted = truncateIfNeeded(formatted, 65535);
  formatted = addFooter(formatted, options.metadata);

  return formatted;
}
```

### STEP 2: Update Workflow to Use Formatter
**File:** `.github/workflows/consuelo-tag-handler.yml`
**Changes:**
- After line 236 (API call), add step to format response
- Replace direct posting with formatted response
- Pass PR context to formatter for file links

**New steps:**
```yaml
- name: Format AI response
  id: format
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const aiResponse = fs.readFileSync('ai-response.txt', 'utf8');
      const prContext = fs.existsSync('pr-context.json')
        ? JSON.parse(fs.readFileSync('pr-context.json', 'utf8'))
        : null;

      // Import formatter
      const { formatResponse } = require('./.github/workflows/scripts/format-response.js');

      // Format response
      const formatted = formatResponse(aiResponse, prContext, {
        metadata: {
          model: 'GLM-4.7',
          provider: 'Z.ai',
          prNumber: context.issue.number
        }
      });

      fs.writeFileSync('formatted-response.txt', formatted);
      return formatted;

- name: Post formatted response
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const formatted = fs.readFileSync('formatted-response.txt', 'utf8');

      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: formatted
      });
```

### STEP 3: Formatting Logic Details

#### Code Block Formatting
**Input:**
```
Here's the fix:
function foo() { return 42; }
```

**Output:**
```typescript
function foo() {
  return 42;
}
```

**Logic:**
- Detect code blocks (indented or fenced)
- Infer language from file extension context
- Add triple backticks with language specifier
- Preserve existing fenced blocks

#### File Reference Formatting
**Input:**
```
Check PaymentModal.tsx:45 for the issue
See src/components/ui/button.tsx:120
```

**Output:**
```
Check [PaymentModal.tsx:45](https://github.com/kokayicobb/consuelo_on_call_coaching/blob/PR_SHA/PaymentModal.tsx#L45) for the issue
See [src/components/ui/button.tsx:120](https://github.com/kokayicobb/consuelo_on_call_coaching/blob/PR_SHA/src/components/ui/button.tsx#L120)
```

**Logic:**
- Regex: `(\w+\.(?:tsx?|jsx?|py|yml|yaml|json|md)):(\d+)`
- Replace with GitHub blob URL + line anchor
- Use PR HEAD SHA for accurate links

#### Collapsible Section Formatting
**Input:**
```
## Long Analysis Section
... 500 lines of analysis ...
```

**Output:**
```html
<details>
<summary><b>📊 Long Analysis Section</b></summary>

... 500 lines of analysis ...

</details>
```

**Logic:**
- Detect sections > 20 lines
- Wrap in `<details>` with styled `<summary>`
- Keep short sections expanded

#### Emoji Header Formatting
**Mapping:**
- `## Security` → `## 🔴 Security`
- `## Tests` → `## ✅ Tests`
- `## Documentation` → `## 📝 Documentation`
- `## Recommendations` → `## 💡 Recommendations`
- `## Summary` → `## 📋 Summary`
- `## Findings` → `## 🔍 Findings`
- `## Action Items` → `## ✔️ Action Items`
- `## Performance` → `## ⚡ Performance`

#### Action Items Formatting
**Logic:**
- Extract TODO/FIXME/ACTION lines
- Create checklist at end:
```markdown
---
## ✔️ Action Items

- [ ] Fix security vulnerability in PaymentModal.tsx:45
- [ ] Add tests for user authentication flow
- [ ] Update documentation for API changes
```

#### Footer Formatting
**Output:**
```markdown
---

<div align="center">

*🤖 Powered by **Consuelo** (GLM-4.7 via Z.ai)*
*PR #123 | Generated on 2026-01-03*

</div>
```

#### Truncation Handling
**Logic:**
- If response > 65535 chars:
  - Truncate to 65000 chars
  - Add warning:
```markdown
---
⚠️ **Response Truncated** (Original: 75000 chars, GitHub limit: 65535)

Full response available in workflow logs: [View logs](#)
```

---

## Acceptance Criteria Checklist

- [ ] ✅ Code blocks have syntax highlighting (typescript, python, yaml, etc.)
- [ ] ✅ File references are clickable GitHub links (e.g., PaymentModal.tsx:45)
- [ ] ✅ Long sections are collapsible (`<details>` tags)
- [ ] ✅ Headers have emoji icons (🔴 Security, ✅ Tests, 📝 Docs)
- [ ] ✅ Action items checklist at end
- [ ] ✅ Branded footer with model info
- [ ] ✅ Markdown escaping handled properly
- [ ] ✅ Truncation warnings for responses > 65535 chars
- [ ] ✅ Error messages formatted with helpful next steps

---

## File Changes Summary

**New Files:**
- `.github/workflows/scripts/format-response.js` (new formatter script)

**Modified Files:**
- `.github/workflows/consuelo-tag-handler.yml` (integrate formatter)

---

## Testing Strategy

1. **Test with sample responses:**
   - Long response (> 65535 chars)
   - Response with code blocks
   - Response with file references
   - Error message response

2. **Manual testing:**
   - Create test PR
   - Comment with `@consuelo review this PR`
   - Verify formatting in response

3. **Edge cases:**
   - No PR context (issue comment)
   - Empty response
   - Response with existing formatting
   - Response with special characters

---

## Next Steps

1. ✅ RESEARCH COMPLETE
2. ➡️ CREATE format-response.js script
3. ⏸️ UPDATE workflow YAML
4. ⏸️ TEST with sample data
5. ⏸️ COMMIT and push

---

## Notes

- GitHub comment limit: 65535 characters
- GitHub markdown supports HTML (`<details>`, `<summary>`, etc.)
- File links use blob URLs with SHA for PR context
- Emoji usage keeps response scannable without overwhelming
- Formatter should be idempotent (safe to run multiple times)
