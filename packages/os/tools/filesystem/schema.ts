import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "fs.apply_patch",
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
      "sessionRequired"
    ],
    "definition": {
      "name": "fs.apply_patch",
      "methodPath": [
        "fs",
        "apply_patch"
      ],
      "description": "apply an anchored patch inside an authorized task worktree or work-session directory",
      "category": "filesystem",
      "underlying": "workspace fs.apply_patch",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 30000,
      "inputSchema": "FsApplyPatchInput",
      "outputSchema": "RawOutput",
      "search": {
        "keywords": ["anchored", "patch", "hunk", "apply", "edit"]
      },
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "patchFile": "/tmp/change.patch",
        "dryRun": true
      },
      "sessionRequired": true
    }
  },
  {
    "name": "fs.list",
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
      "sessionRequired"
    ],
    "definition": {
      "name": "fs.list",
      "methodPath": [
        "fs",
        "list"
      ],
      "description": "list or find files in the repo root or a resolved task worktree",
      "category": "filesystem",
      "underlying": "workspace fs list, or task:fs list when a branch is resolved",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "FsListInput",
      "outputSchema": "RawOutput",
      "search": {
        "entities": ["directory", "directories", "folder", "folders", "tree"]
      },
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "path": "packages/os/scripts",
        "depth": 1
      },
      "sessionRequired": false
    }
  },
  {
    "name": "fs.read",
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
      "examples"
    ],
    "definition": {
      "name": "fs.read",
      "methodPath": [
        "fs",
        "read"
      ],
      "description": "read bounded text or supported media from files with pagination, MIME metadata, binary detection, and structured truncation for agent-safe file ingestion",
      "category": "filesystem",
      "underlying": "workspace fs read, or task:fs read when a branch is resolved",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "FsReadInput",
      "outputSchema": "FsReadOutput",
      "search": {
        "entities": ["file", "files", "line", "lines", "contents"]
      },
      "exampleInput": {
        "path": "packages/os/scripts/fs.js",
        "offset": 1,
        "limit": 120
      },
      "sessionRequired": false,
      "examples": [
        {
          "label": "single paged file",
          "input": {
            "path": "packages/os/scripts/fs.js",
            "offset": 1,
            "limit": 120
          }
        },
        {
          "label": "multiple paged files",
          "input": {
            "files": [
              {
                "path": "packages/os/scripts/fs.js",
                "offset": 1,
                "limit": 80
              },
              {
                "path": "packages/os/manifests/generated/tool.manifest.json",
                "offset": 1,
                "limit": 120
              }
            ]
          }
        }
      ]
    }
  },
  {
    "name": "fs.search",
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
      "examples"
    ],
    "definition": {
      "name": "fs.search",
      "methodPath": [
        "fs",
        "search"
      ],
      "description": "search file contents with ripgrep and return structured bounded matches for agent-safe discovery",
      "category": "filesystem",
      "underlying": "workspace fs search, or task:fs search when a branch is resolved",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "FsSearchInput",
      "outputSchema": "FsSearchOutput",
      "search": {
        "keywords": ["grep", "ripgrep", "rg", "pattern", "contents", "codebase"]
      },
      "exampleInput": {
        "pattern": "task:fs",
        "path": "packages/os/SCRIPTS.md"
      },
      "sessionRequired": false,
      "examples": [
        {
          "label": "search a directory",
          "input": {
            "pattern": "Effect.gen",
            "path": "packages/os/scripts",
            "include": "*.ts",
            "maxResults": 20
          }
        },
        {
          "label": "search multiple paths",
          "input": {
            "pattern": "task:fs",
            "paths": [
              "packages/os/SCRIPTS.md",
              "packages/os/TOOLS.md"
            ],
            "maxResults": 10
          }
        }
      ]
    }
  },
  {
    "name": "fs.trash",
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
      "sessionRequired"
    ],
    "definition": {
      "name": "fs.trash",
      "methodPath": [
        "fs",
        "trash"
      ],
      "description": "move files to trash inside an authorized task worktree or work-session directory",
      "category": "filesystem",
      "underlying": "workspace fs.trash",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 30000,
      "inputSchema": "FsTrashInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "path": "tmp/example.txt",
        "dryRun": true
      },
      "sessionRequired": true
    }
  },
  {
    "name": "fs.write",
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
      "name": "fs.write",
      "methodPath": [
        "fs",
        "write"
      ],
      "description": "write a file inside an authorized task worktree or work-session directory",
      "category": "filesystem",
      "underlying": "workspace fs.write",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 30000,
      "inputSchema": "FsWriteInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "path": "tmp/example.txt",
        "contentFile": "/tmp/example.txt",
        "dryRun": true
      },
      "sessionRequired": true,
      "workflowRole": "workpad.write"
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
