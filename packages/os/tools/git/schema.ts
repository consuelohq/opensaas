import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "git.diff",
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
      "name": "git.diff",
      "methodPath": [
        "git",
        "diff"
      ],
      "description": "inspect task or working-tree diffs as bounded structured JSON for agents",
      "category": "git",
      "underlying": "workspace git:diff",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "GitDiffInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "base": "origin/main",
        "stat": true,
        "files": true,
        "hunks": true,
        "maxBytes": 20000
      },
      "sessionRequired": true,
      "workflowRole": "diff.inspect"
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
