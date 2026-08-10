import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "fs.apply_patch",
    "command": {
      "script": "task:fs",
      "subcommand": "apply-patch",
      "branchMode": "required",
      "branchArgumentStyle": "prefix",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "patchText",
          "flag": "--patch-text",
          "kind": "value"
        },
        {
          "source": "patchFile",
          "flag": "--patch-file",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "fs.list",
    "command": {
      "script": "task:fs",
      "subcommand": "list",
      "branchMode": "optional",
      "branchArgumentStyle": "prefix",
      "arguments": [
        {
          "source": "path",
          "kind": "value"
        },
        {
          "source": "pattern",
          "flag": "--find",
          "kind": "value"
        },
        {
          "source": "depth",
          "flag": "--depth",
          "kind": "value"
        },
        {
          "source": "tree",
          "flag": "--tree",
          "kind": "boolean"
        },
        {
          "source": "dirs",
          "flag": "--dirs",
          "kind": "boolean"
        },
        {
          "source": "files",
          "flag": "--files",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "fs.read",
    "command": {
      "script": "task:fs",
      "subcommand": "read",
      "branchMode": "optional",
      "branchArgumentStyle": "prefix",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "path",
          "kind": "value"
        },
        {
          "source": "filesJson",
          "flag": "--files-json",
          "kind": "value"
        },
        {
          "source": "offset",
          "flag": "--offset",
          "kind": "value"
        },
        {
          "source": "limit",
          "flag": "--limit",
          "kind": "value"
        },
        {
          "source": "from",
          "flag": "--from",
          "kind": "value"
        },
        {
          "source": "to",
          "flag": "--to",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "fs.search",
    "command": {
      "script": "task:fs",
      "subcommand": "search",
      "branchMode": "optional",
      "branchArgumentStyle": "prefix",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "pattern",
          "kind": "value",
          "required": true
        },
        {
          "source": "paths",
          "kind": "array"
        },
        {
          "source": "include",
          "flag": "--include",
          "kind": "value"
        },
        {
          "source": "context",
          "flag": "--context",
          "kind": "value"
        },
        {
          "source": "maxResults",
          "flag": "--max-results",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "fs.trash",
    "command": {
      "script": "task:fs",
      "subcommand": "trash",
      "branchMode": "required",
      "branchArgumentStyle": "prefix",
      "arguments": [
        {
          "source": "path",
          "kind": "value",
          "required": true
        }
      ]
    }
  },
  {
    "name": "fs.write",
    "command": {
      "script": "task:fs",
      "subcommand": "write",
      "branchMode": "required",
      "branchArgumentStyle": "prefix",
      "arguments": [
        {
          "source": "path",
          "kind": "value",
          "required": true
        },
        {
          "source": "content",
          "flag": "--content",
          "kind": "value"
        },
        {
          "source": "contentFile",
          "flag": "--content-file",
          "kind": "value"
        },
        {
          "source": "force",
          "flag": "--force",
          "kind": "boolean"
        },
        {
          "source": "append",
          "flag": "--append",
          "kind": "boolean"
        },
        {
          "source": "mkdirs",
          "flag": "--mkdirs",
          "kind": "boolean"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
