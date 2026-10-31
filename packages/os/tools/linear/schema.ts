import type { ToolSchemaContribution } from '../package';

const linearAdditions = [
  { name: 'linear.createComment', inputSchema: 'LinearCreateCommentInput', description: 'post a Linear comment as the authenticated application and verify its author', exampleInput: { issueId: 'DEV-123', body: 'Verified and ready for review' }, readOnly: false },
  { name: 'linear.comments', inputSchema: 'LinearIssueListInput', description: 'read Linear issue comments, authors, and pagination', exampleInput: { issueId: 'DEV-123', first: 20 }, readOnly: true },
  { name: 'linear.relations', inputSchema: 'LinearIssueInput', description: 'read native incoming and outgoing issue dependencies and relations', exampleInput: { identifier: 'DEV-123' }, readOnly: true },
  { name: 'linear.createRelation', inputSchema: 'LinearCreateRelationInput', description: 'idempotently create a native Linear blocks, related, duplicate or similar issue relation', exampleInput: { issueId: 'DEV-123', relatedIssueId: 'DEV-124', type: 'blocks' }, readOnly: false },
  { name: 'linear.deleteRelation', inputSchema: 'LinearDeleteRelationInput', description: 'remove a native Linear issue relation by its id', exampleInput: { relationId: '11111111-1111-4111-8111-111111111111' }, readOnly: false },
  { name: 'linear.triageIssue', inputSchema: 'LinearTriageIssueInput', description: 'move an issue through team Triage intake, accept, or decline using current team states', exampleInput: { issueId: 'DEV-123', action: 'accept' }, readOnly: false },
] as const;

export const toolSchemas = [
  {
    "name": "linear.createIssue",
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
      "name": "linear.createIssue",
      "methodPath": [
        "linear",
        "createIssue"
      ],
      "description": "create a Linear issue with provider-configured workflow defaults, optional labels and projects",
      "category": "linear",
      "underlying": "workspace linear.createIssue",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearCreateIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "title": "add Linear facade commands"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.issue",
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
      "name": "linear.issue",
      "methodPath": [
        "linear",
        "issue"
      ],
      "description": "read a Linear issue by identifier or id",
      "category": "linear",
      "underlying": "workspace linear.issue",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "identifier": "DEV-123"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.labels",
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
      "name": "linear.labels",
      "methodPath": [
        "linear",
        "labels"
      ],
      "description": "list Linear issue labels for label consistency",
      "category": "linear",
      "underlying": "workspace linear.labels",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "first": 50
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.projects",
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
      "name": "linear.projects",
      "methodPath": [
        "linear",
        "projects"
      ],
      "description": "list Linear projects and ids",
      "category": "linear",
      "underlying": "workspace linear.projects",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "first": 50
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.search",
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
      "name": "linear.search",
      "methodPath": [
        "linear",
        "search"
      ],
      "description": "search Linear issues with DEV default team support",
      "category": "linear",
      "underlying": "workspace linear.search",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearSearchInput",
      "outputSchema": "RawOutput",
      "search": {"keywords":["ticket","tickets","issue search","find issues"]},
      "exampleInput": {
        "search": "workspace facade"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.states",
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
      "name": "linear.states",
      "methodPath": [
        "linear",
        "states"
      ],
      "description": "list workflow states for a Linear team",
      "category": "linear",
      "underlying": "workspace linear.states",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearTeamScopedListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "team": "dev"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.teams",
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
      "name": "linear.teams",
      "methodPath": [
        "linear",
        "teams"
      ],
      "description": "list Linear teams and workflow states",
      "category": "linear",
      "underlying": "workspace linear.teams",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearListInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "first": 20
      },
      "sessionRequired": false
    }
  },
  {
    "name": "linear.updateIssue",
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
      "name": "linear.updateIssue",
      "methodPath": [
        "linear",
        "updateIssue"
      ],
      "description": "update Linear issue fields including labels, project, cycle, and parent",
      "category": "linear",
      "underlying": "workspace linear.updateIssue",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "LinearUpdateIssueInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "issueId": "DEV-123"
      },
      "sessionRequired": false
    }
  },
  ...linearAdditions.map((entry) => ({
    name: entry.name,
    order: ['name', 'methodPath', 'description', 'category', 'underlying', 'capabilities', 'defaultTimeout', 'inputSchema', 'outputSchema', 'command', 'exampleInput', 'sessionRequired'],
    definition: {
      name: entry.name,
      methodPath: ['linear', entry.name.slice('linear.'.length)],
      description: entry.description,
      category: 'linear',
      underlying: 'workspace ' + entry.name,
      capabilities: { readOnly: entry.readOnly, mutating: !entry.readOnly, deterministic: false, safeToRetry: entry.readOnly },
      defaultTimeout: 60000,
      inputSchema: entry.inputSchema,
      outputSchema: 'RawOutput',
      exampleInput: entry.exampleInput,
      sessionRequired: false,
    },
  })),
] as const satisfies readonly ToolSchemaContribution[];
