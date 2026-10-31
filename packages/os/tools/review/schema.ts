import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "aiReview",
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
      "name": "aiReview",
      "methodPath": [
        "aiReview"
      ],
      "description": "run the AI PR review helper",
      "category": "review",
      "underlying": "workspace aiReview",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "AiReviewInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "pr": 226,
        "noPost": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "prReview",
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
      "name": "prReview",
      "methodPath": [
        "prReview"
      ],
      "description": "legacy wrapper for GitHub PR review feedback; prefer OS github with operation pr.reviews for normalized actionable review comments",
      "category": "review",
      "underlying": "workspace prReview",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "PrReviewInput",
      "outputSchema": "RawOutput",
      "search": { "hidden": true },
      "exampleInput": {
        "pr": 225
      },
      "sessionRequired": false
    }
  },
  {
    "name": "review.run",
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
      "name": "review.run",
      "methodPath": [
        "review",
        "run"
      ],
      "description": "run the workspace review checks",
      "category": "review",
      "underlying": "workspace review.run",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ReviewInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "noTests": true
      },
      "sessionRequired": true,
      "workflowRole": "validation.review"
    }
  },
  {
    "name": "verify",
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
      "name": "verify",
      "methodPath": [
        "verify"
      ],
      "description": "Run the full task safety gate once per exact snapshot; on VERIFY_PENDING use read-only verify.status with runKey and waitSeconds:60 rather than polling verify; retry:true explicitly reruns an unchanged failed gate.",
      "category": "review",
      "underlying": "workspace verify",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "VerifyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "noStamp": true,
        "dryRun": true
      },
      "sessionRequired": true,
      "workflowRole": "validation.verify"
    }
  },
  {
    "name": "verify.status",
    "order": [
      "name", "methodPath", "description", "category", "underlying",
      "capabilities", "defaultTimeout", "inputSchema", "outputSchema",
      "command", "exampleInput", "sessionRequired", "workflowRole"
    ],
    "definition": {
      "name": "verify.status",
      "methodPath": ["verifyStatus"],
      "description": "Read-only long-poll for a previously started verify run. Reuses runKey, waits up to 60 seconds by default, reports pending/success/failure/stale without starting work.",
      "category": "review",
      "underlying": "workspace verify-status",
      "capabilities": {
        "readOnly": true, "mutating": false, "deterministic": false, "safeToRetry": true
      },
      "defaultTimeout": 150000,
      "inputSchema": "VerifyStatusInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "runKey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "waitSeconds": 60
      },
      "sessionRequired": true,
      "workflowRole": "validation.verify"
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
