import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "task.cleanup",
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
      "name": "task.cleanup",
      "methodPath": [
        "task",
        "cleanup"
      ],
      "description": "preview or remove stale task worktrees and branches",
      "category": "task lifecycle",
      "underlying": "workspace task.cleanup",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "TaskCleanupInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "preview": true,
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "task.current",
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
      "name": "task.current",
      "methodPath": [
        "task",
        "current"
      ],
      "description": "resolve the current task branch without running a mutating command",
      "category": "task lifecycle",
      "underlying": "branch resolver",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "EmptyInput",
      "outputSchema": "TaskCurrentOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "task.ensureSynced",
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
      "name": "task.ensureSynced",
      "methodPath": [
        "task",
        "ensureSynced"
      ],
      "description": "check whether the task stream appears synced",
      "category": "task lifecycle",
      "underlying": "workspace task.ensureSynced",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 60000,
      "inputSchema": "BranchInput",
      "outputSchema": "TaskEnsureSyncedOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "task.finish",
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
      "name": "task.finish",
      "methodPath": [
        "task",
        "finish"
      ],
      "description": "finish a task branch after merge",
      "category": "task lifecycle",
      "underlying": "workspace task.finish",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "BranchInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "dryRun": true
      },
      "sessionRequired": true,
      "workflowRole": "task.finish"
    }
  },
  {
    "name": "task.init",
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
      "name": "task.init",
      "methodPath": [
        "task",
        "init"
      ],
      "description": "write task metadata for an existing worktree",
      "category": "task lifecycle",
      "underlying": "workspace task.init",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "TaskInitInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "area": "workspace-agents",
        "branch": "task/workspace-agents/example",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "task.merge",
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
      "name": "task.merge",
      "methodPath": [
        "task",
        "merge"
      ],
      "description": "merge a pull request through the workspace task merge script",
      "category": "task lifecycle",
      "underlying": "workspace task.merge",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "TaskMergeInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "pr": 225,
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "task.pr",
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
      "name": "task.pr",
      "methodPath": [
        "task",
        "pr"
      ],
      "description": "merge task to stream and create or refresh the stream review PR",
      "category": "task lifecycle",
      "underlying": "workspace task.pr",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "TaskPrInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "taskOnly": true,
        "dryRun": true
      },
      "sessionRequired": true,
      "workflowRole": "task.pr"
    }
  },
  {
    "name": "task.prs",
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
      "name": "task.prs",
      "methodPath": [
        "task",
        "prs"
      ],
      "description": "show task and review PR links",
      "category": "task lifecycle",
      "underlying": "workspace task.prs",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "BranchInput",
      "outputSchema": "RawOutput",
      "search": {"keywords":["links","pr links","pull request links"]},
      "exampleInput": {
        "branch": "task/workspace-agents/example"
      },
      "sessionRequired": true
    }
  },
  {
    "name": "task.push",
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
      "name": "task.push",
      "methodPath": [
        "task",
        "push"
      ],
      "description": "push changed task files to the task branch through GitHub API",
      "category": "task lifecycle",
      "underlying": "workspace task.push",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "TaskPushInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "branch": "task/workspace-agents/example",
        "message": "feat(workspace): example",
        "changed": true,
        "dryRun": true
      },
      "sessionRequired": true,
      "workflowRole": "task.push"
    }
  },
  {
    "name": "session.start",
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
      "name": "session.start",
      "methodPath": [
        "session",
        "start"
      ],
      "description": "Start a Consuelo session. Use kind=task for repo work that needs a branch/worktree/PR, or kind=work for metadata-only work rooted at an existing directory.",
      "category": "session lifecycle",
      "underlying": "os session.start",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "SessionStartInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "kind": "task",
        "stream": "stream/workspace-agent",
        "title": "example task",
        "workflow": "task"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "task.start",
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
      "name": "task.start",
      "methodPath": [
        "task",
        "start"
      ],
      "description": "Call this directly at the beginning of every scoped repo task, before tools.search or any search for task-start tooling. It creates the task branch, worktree, task PR, and real taskSession, then returns the selected workflow bundle and post-start lifecycle guidance.",
      "category": "task lifecycle",
      "underlying": "os task.start",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "TaskStartInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "stream": "stream/workspace-agents",
        "title": "example task",
        "dryRun": true,
        "workflow": "task"
      },
      "sessionRequired": false,
      "workflowRole": "task.start"
    }
  },
  {
    "name": "taskMeta.smoke",
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
      "name": "taskMeta.smoke",
      "methodPath": [
        "taskMeta",
        "smoke"
      ],
      "description": "run the task metadata smoke suite",
      "category": "task lifecycle",
      "underlying": "workspace taskMeta.smoke",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
