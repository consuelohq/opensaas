import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "batch",
    "command": {
      "script": "batch",
      "branchMode": "none",
      "internal": "batch",
      "arguments": []
    }
  },
  {
    "name": "checkFiles",
    "command": {
      "script": "check-files",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "files",
          "flag": "--files",
          "kind": "array",
          "required": true
        },
        {
          "source": "stopOnFirstError",
          "flag": "--stop-on-first-error",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "editFlow",
    "command": {
      "script": "edit-flow",
      "branchMode": "required",
      "branchArgumentStyle": "flag",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "branch",
          "flag": "--branch",
          "kind": "value"
        },
        {
          "source": "searchPattern",
          "flag": "--search-pattern",
          "kind": "value",
          "required": true
        },
        {
          "source": "searchPaths",
          "flag": "--search-paths",
          "kind": "array",
          "required": true
        },
        {
          "source": "from",
          "flag": "--from",
          "kind": "value",
          "required": true
        },
        {
          "source": "to",
          "flag": "--to",
          "kind": "value",
          "required": true
        },
        {
          "source": "contentFile",
          "flag": "--content-file",
          "kind": "value",
          "required": true
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
