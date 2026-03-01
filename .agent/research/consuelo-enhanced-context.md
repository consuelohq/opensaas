# Research: Enhanced Context Gathering for @consuelo

## Current Implementation

### File: `.github/workflows/consuelo-tag-handler.yml`

**Current Context Gathering (lines 43-107):**
- Uses GitHub API to fetch PR metadata
- Gets file list with patches (limited to 5000 chars per patch)
- Collects commit history
- **Limitation:** Only includes diff patches, not full file contents

**Current Context Structure:**
```json
{
  "prNumber": number,
  "title": string,
  "body": string,
  "baseBranch": string,
  "headBranch": string,
  "additions": number,
  "deletions": number,
  "changedFiles": number,
  "fileChanges": [
    {
      "filename": string,
      "status": "added|modified|removed",
      "additions": number,
      "deletions": number,
      "changes": number,
      "patch": string (first 5000 chars of diff)
    }
  ],
  "commits": [...]
}
```

## Enhancement Requirements

Based on Beads task `consuelo_on_call_coaching-6ro`:

1. **Read Full File Contents**: When intent requires file access (tests, docs, code review)
2. **Calculate Code Complexity Metrics**: Cyclomatic complexity, lines per function, file size
3. **Identify File Relationships**: Imports/exports between files
4. **Extract Relevant Code Snippets**: Changed lines +/- 10 lines context
5. **Build Comprehensive Context**: Include file contents, metrics, and snippets
6. **Handle Large Files**: Truncate if > 5000 lines, show only changed sections
7. **Error Handling**: Missing files, permission errors

## Implementation Plan

### Option 1: Inline JavaScript in Workflow (RECOMMENDED)
**Pros:**
- No new files needed
- Uses GitHub Actions script context
- Direct access to GitHub API via `github.rest`
- Can use `actions/checkout` to access repo files

**Cons:**
- Longer workflow file
- Harder to test locally

### Option 2: External Script (gather-context.js)
**Pros:**
- Cleaner workflow file
- Easier to test locally
- Better code organization

**Cons:**
- Needs separate step to run
- Less direct access to GitHub context

### Decision: **Option 1** (Inline) - Simpler, no new dependencies

## Technical Approach

### Step 1: Detect Intent
Analyze user prompt to determine if file contents are needed:
- Keywords: "test", "review", "code", "function", "class", "implement", "fix"
- OR: PR has < 10 files (safe to read all)

### Step 2: Read File Contents
For each modified file:
```javascript
const { data: fileContent } = await github.rest.repos.getContent({
  owner: context.repo.owner,
  repo: context.repo.repo,
  path: file.filename,
  ref: pr.data.head.ref // Read from PR branch
});

const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
```

### Step 3: Calculate Metrics
```javascript
function analyzeCodeFile(content, filename) {
  const lines = content.split('\n');
  const fileSize = content.length;

  return {
    lines: lines.length,
    fileSize,
    fileType: getFileType(filename),
    complexity: estimateComplexity(content, filename),
    imports: extractImports(content, filename),
    exports: extractExports(content, filename)
  };
}
```

### Step 4: Extract Snippets
For each changed section in patch:
- Parse patch to get line numbers
- Extract lines[lineNum - 10 : lineNum + 10]
- Include line numbers for context

### Step 5: Build Enhanced Context
```javascript
{
  ...existingContext,
  fileContents: [
    {
      filename: string,
      content: string | null, // null if > 5000 lines
      truncated: boolean,
      metrics: {
        lines: number,
        fileSize: number,
        fileType: string,
        complexity: number,
        imports: string[],
        exports: string[]
      },
      snippets: [
        {
          startLine: number,
          endLine: number,
          code: string,
          isChanged: boolean
        }
      ]
    }
  ]
}
```

## Code Complexity Estimation

### Simple Approach (Good Enough for AI Context)
```javascript
function estimateComplexity(content, filename) {
  const ext = filename.split('.').pop();
  let score = 1;

  // Count control flow statements
  const controlFlow = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch'];
  controlFlow.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    const matches = content.match(regex);
    score += matches ? matches.length : 0;
  });

  // Count functions/methods
  if (ext === 'js' || ext === 'ts' || ext === 'tsx') {
    const funcMatches = content.match(/function\s+\w+|=>\s*{|\w+\s*\(/g);
    score += funcMatches ? funcMatches.length * 0.5 : 0;
  }

  return Math.min(100, score); // Cap at 100
}
```

## Import/Export Detection

### TypeScript/JavaScript
```javascript
function extractImports(content, filename) {
  if (!filename.match(/\.(js|ts|tsx|jsx)$/)) return [];

  const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
  const matches = [...content.matchAll(importRegex)];
  return matches.map(m => m[1]);
}

function extractExports(content, filename) {
  if (!filename.match(/\.(js|ts|tsx|jsx)$/)) return [];

  const exportRegex = /export\s+(default\s+)?(class|function|const|let|var)\s+(\w+)/g;
  const matches = [...content.matchAll(exportRegex)];
  return matches.map(m => m[3]);
}
```

### Python
```javascript
function extractImports(content, filename) {
  if (!filename.match(/\.py$/)) return [];

  const importRegex = /^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
  const matches = [...content.matchAll(importRegex)];
  return matches.map(m => m[1] || m[2]);
}
```

## Error Handling

### File Read Errors
```javascript
try {
  const { data: fileContent } = await github.rest.repos.getContent({...});
  // process content
} catch (error) {
  if (error.status === 404) {
    fileContents.push({
      filename: file.filename,
      content: null,
      error: 'File not found (possibly binary or deleted)',
      truncated: true
    });
  } else {
    fileContents.push({
      filename: file.filename,
      content: null,
      error: error.message,
      truncated: true
    });
  }
}
```

## Performance Considerations

1. **File Count Limit**: Only read contents if < 20 files changed
2. **File Size Limit**: Skip files > 100KB (likely binary or generated)
3. **Total Size Limit**: Stop reading if total context > 500KB
4. **Concurrent Reads**: Use Promise.all() for parallel file fetches

## Testing Strategy

1. **Manual Test Cases:**
   - PR with 1 file changed (should read full content)
   - PR with 50 files changed (should skip or read selectively)
   - PR with binary files (should handle gracefully)
   - PR with deleted files (should handle 404)
   - User prompt with "write tests" (should trigger file reading)
   - User prompt with "summarize" (might skip file reading)

2. **Test in Real PR:**
   - Create test PR
   - Comment `@consuelo write tests for these changes`
   - Verify response includes code-aware suggestions

## Files to Modify

1. **`.github/workflows/consuelo-tag-handler.yml`**
   - Enhance "Gather PR context" step (lines 43-107)
   - Add file content reading logic
   - Add complexity calculation
   - Add snippet extraction

## Next Steps

1. ✅ Research completed
2. ⏭️ Write implementation plan
3. ⏭️ Implement enhanced context gathering
4. ⏭️ Test with real PR
5. ⏭️ Commit changes
