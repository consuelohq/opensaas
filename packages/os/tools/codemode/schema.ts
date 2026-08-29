import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "code.call",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "search",
      "command",
      "exampleInput",
      "sessionRequired",
      "workflowRole",
      "examples"
    ],
    "definition": {
      "name": "code.call",
      "methodPath": [
        "code",
        "call"
      ],
      "description": "Run focused Python, Bun, or Bash programs where runtime output is the evidence. Use taskSession for edits inside Consuelo-managed repositories and workSession for scoped edits in ordinary folders on the owning node. Work-session execution is write-contained to its persisted session path on supported nodes and rejects managed repos/worktrees; mac.call remains the emergency host escape hatch. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.",
      "category": "codemode",
      "underlying": "os code.call",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 180000,
      "inputSchema": "CodeCallInput",
      "outputSchema": "CodeCallOutput",
      "search": {
        "keywords": ["structured", "multi", "summarize", "summary", "packet", "bounded", "transform", "transformation", "rewrite", "codemod", "codegen", "generate", "python", "bun", "bash", "test", "tests", "typecheck", "syntax", "cli", "reproduction", "diagnostic", "json", "script", "scripts", "package", "packages"]
      },
      "exampleInput": {
        "language": "bun",
        "mode": "read",
        "codeFile": "scripts/code-call-examples/structured-snippet-read.ts",
        "maxResultChars": 20000
      },
      "sessionRequired": false,
      "workflowRole": "test.run",
      "examples": [
        {
          "label": "multi-package focused test packet",
          "input": {
            "language": "bun",
            "mode": "verify",
            "codeFile": "scripts/code-call-examples/multi-package-focused-tests.ts",
            "maxResultChars": 60000
          }
        },
        {
          "label": "repository impact analysis packet",
          "input": {
            "language": "bun",
            "mode": "read",
            "codeFile": "scripts/code-call-examples/repository-impact-analysis.ts",
            "maxResultChars": 50000
          }
        },
        {
          "label": "exact manifest description verification",
          "input": {
            "language": "bun",
            "mode": "verify",
            "codeFile": "scripts/code-call-examples/exact-manifest-description-verification.ts",
            "maxResultChars": 30000
          }
        },
        {
          "label": "structured repo read and compare packet",
          "input": {
            "language": "bun",
            "mode": "read",
            "codeFile": "scripts/code-call-examples/structured-repo-read-compare.ts",
            "maxResultChars": 30000
          }
        },
        {
          "label": "task-scoped structured file rewrite",
          "input": {
            "language": "bun",
            "mode": "edit",
            "codeFile": "scripts/code-call-examples/task-scoped-structured-file-rewrite.ts",
            "maxResultChars": 30000
          }
        },
        {
          "label": "Python AST/string-heavy test insertion",
          "input": {
            "language": "python",
            "mode": "edit",
            "codeFile": "scripts/code-call-examples/python-semantic-test-mutation.py",
            "maxResultChars": 20000
          }
        },
        {
          "label": "Python test assertion audit packet",
          "input": {
            "language": "python",
            "mode": "read",
            "codeFile": "scripts/code-call-examples/python-test-assertion-audit.py",
            "maxResultChars": 30000
          }
        }
      ]
    }
  },
  {
    "name": "code.run",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired",
      "workflowRole"
    ],
    "definition": {
      "name": "code.run",
      "methodPath": [
        "code",
        "run"
      ],
      "description": "run a small JavaScript program over workspace APIs for control flow, filtering, summarization, and output reduction",
      "category": "codemode",
      "underlying": "workspace code.run",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "CodeRunInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "code": "const traces = await workspace_call(\"memory\", { operation: \"trace\", contains: \"python3\", limit: 40 });\nconst counts = new Map();\nfor (const row of traces.data?.rows ?? []) counts.set(row.tool, (counts.get(row.tool) ?? 0) + 1);\nreturn { totalMatches: traces.data?.count ?? 0, byTool: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10) };",
        "maxOperations": 25,
        "maxResultChars": 20000
      },
      "sessionRequired": false,
      "workflowRole": "decision.research"
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
