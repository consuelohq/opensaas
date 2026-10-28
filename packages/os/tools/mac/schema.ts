import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "mac.call",
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
      "name": "mac.call",
      "methodPath": [
        "mac",
        "call"
      ],
      "description": "emergency host escape hatch for non-repo Mac commands or recovery when task worktree routing is broken. Do not use `mac.call` for repo-scoped tests, package scripts, builds, typechecks, syntax checks, or validation; use code.call with taskSession instead.",
      "category": "mac",
      "underlying": "workspace mac.call",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacExecInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "command": "sw_vers",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.exec",
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
      "name": "mac.exec",
      "methodPath": [
        "mac",
        "exec"
      ],
      "description": "legacy alias for mac.call; emergency host escape hatch only. Do not use `mac.call` for repo-scoped tests, package scripts, builds, typechecks, syntax checks, or validation; use code.call with taskSession instead.",
      "category": "mac",
      "underlying": "workspace mac.exec",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacExecInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "command": "sw_vers",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.list",
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
      "name": "mac.list",
      "methodPath": [
        "mac",
        "list"
      ],
      "description": "list non-repo files on the Mac",
      "category": "mac",
      "underlying": "workspace mac.list",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "path": "/tmp",
        "depth": 1
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.port",
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
      "name": "mac.port",
      "methodPath": [
        "mac",
        "port"
      ],
      "description": "check or find a local port",
      "category": "mac",
      "underlying": "workspace mac.port",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacPortInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "find"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.process",
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
      "name": "mac.process",
      "methodPath": [
        "mac",
        "process"
      ],
      "description": "list or kill local Mac processes",
      "category": "mac",
      "underlying": "workspace mac.process",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacProcessInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "list"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.read",
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
      "name": "mac.read",
      "methodPath": [
        "mac",
        "read"
      ],
      "description": "read a non-repo file on the Mac",
      "category": "mac",
      "underlying": "workspace mac.read",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacReadInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "path": "/tmp/example.txt"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.search",
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
      "name": "mac.search",
      "methodPath": [
        "mac",
        "search"
      ],
      "description": "search non-repo files on the Mac",
      "category": "mac",
      "underlying": "workspace mac.search",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacSearchInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "pattern": "hello",
        "path": "/tmp"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "mac.write",
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
      "name": "mac.write",
      "methodPath": [
        "mac",
        "write"
      ],
      "description": "write a non-repo file on the Mac",
      "category": "mac",
      "underlying": "workspace mac.write",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MacWriteInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "path": "/tmp/example.txt",
        "content": "hello",
        "dryRun": true
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
