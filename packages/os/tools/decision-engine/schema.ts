import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "audit",
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
      "name": "audit",
      "methodPath": [
        "audit"
      ],
      "description": "audit workspace scripts, docs, or index freshness",
      "category": "decision engine",
      "underlying": "workspace audit",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "AuditInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "scripts": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "confidenceScore",
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
      "name": "confidenceScore",
      "methodPath": [
        "confidenceScore"
      ],
      "description": "compatibility view of the readiness already returned by Explore's unified investigation policy",
      "category": "decision engine",
      "underlying": "workspace confidenceScore",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "confirm",
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
      "name": "confirm",
      "methodPath": [
        "confirm"
      ],
      "description": "run verification or targeted validation through confirm",
      "category": "decision engine",
      "underlying": "workspace confirm",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "ConfirmInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "verify": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "decideNext",
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
      "name": "decideNext",
      "methodPath": [
        "decideNext"
      ],
      "description": "compatibility view of the next evidence action already returned by Explore's unified investigation policy",
      "category": "decision engine",
      "underlying": "workspace decideNext",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "DecideNextInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "exploit",
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
      "name": "exploit",
      "methodPath": [
        "exploit"
      ],
      "description": "compatibility alias for Explore's edit target; without an explicit override it only selects when Explore is edit-ready",
      "category": "decision engine",
      "underlying": "workspace exploit",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "ExploitInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "explore",
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
      "name": "explore",
      "methodPath": [
        "explore"
      ],
      "description": "a repo-aware investigation policy for coding agents. It retrieves the dependency graph and returns the current hypotheses, readiness, uncertainty, next evidence action, and whether the investigation is edit-ready.",
      "category": "decision engine",
      "underlying": "workspace explore",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "ExploreInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "query": "workspace facade",
        "limit": 5
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
