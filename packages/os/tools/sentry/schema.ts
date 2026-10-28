import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "sentry.config",
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
      "name": "sentry.config",
      "methodPath": [
        "sentry",
        "config"
      ],
      "description": "show Sentry API configuration status from Keychain without exposing secrets",
      "category": "sentry",
      "underlying": "workspace sentry.config",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryConfigInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "verify": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "sentry.event",
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
      "name": "sentry.event",
      "methodPath": [
        "sentry",
        "event"
      ],
      "description": "retrieve or resolve a Sentry event id, using a project slug when available",
      "category": "sentry",
      "underlying": "workspace sentry.event",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryEventInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "eventId": "0123456789abcdef0123456789abcdef"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "sentry.issue",
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
      "name": "sentry.issue",
      "methodPath": [
        "sentry",
        "issue"
      ],
      "description": "retrieve one Sentry issue by short id or numeric issue id",
      "category": "sentry",
      "underlying": "workspace sentry.issue",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "identifier": "PROJECT-123"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "sentry.issueEvent",
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
      "name": "sentry.issueEvent",
      "methodPath": [
        "sentry",
        "issueEvent"
      ],
      "description": "retrieve a latest, recommended, oldest, or concrete Sentry event for an issue",
      "category": "sentry",
      "underlying": "workspace sentry.issueEvent",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryIssueEventInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "issueId": "PROJECT-123",
        "eventId": "recommended",
        "full": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "sentry.issues",
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
      "name": "sentry.issues",
      "methodPath": [
        "sentry",
        "issues"
      ],
      "description": "search Sentry issues across the configured organization",
      "category": "sentry",
      "underlying": "workspace sentry.issues",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryIssuesInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "query": "is:unresolved",
        "limit": 10
      },
      "sessionRequired": false
    }
  },
  {
    "name": "sentry.projects",
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
      "name": "sentry.projects",
      "methodPath": [
        "sentry",
        "projects"
      ],
      "description": "list Sentry projects for the configured organization",
      "category": "sentry",
      "underlying": "workspace sentry.projects",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryProjectsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "limit": 25
      },
      "sessionRequired": false
    }
  },
  {
    "name": "sentry.trace",
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
      "name": "sentry.trace",
      "methodPath": [
        "sentry",
        "trace"
      ],
      "description": "perform a best-effort Sentry trace lookup across organization events and issues",
      "category": "sentry",
      "underlying": "workspace sentry.trace",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "SentryTraceInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "traceId": "0123456789abcdef0123456789abcdef",
        "limit": 10
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
