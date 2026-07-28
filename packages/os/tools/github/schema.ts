import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "gh",
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
      "name": "gh",
      "methodPath": [
        "gh"
      ],
      "description": "run the workspace GitHub helper with an explicit action",
      "category": "github",
      "underlying": "workspace gh",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "GhInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "view",
        "args": [
          "225"
        ]
      },
      "sessionRequired": false
    }
  },
  {
    "name": "github",
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
      "name": "github",
      "methodPath": [
        "github"
      ],
      "description": "typed GitHub facade with semantic PR operations; use operation pr.reviews for normalized actionable PR review feedback from CodeRabbit, Codex/OpenAI/ChatGPT, Qodo, and human reviewers",
      "category": "github",
      "underlying": "workspace github",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "GithubInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "operation": "pr.reviews",
        "pr": 436
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
