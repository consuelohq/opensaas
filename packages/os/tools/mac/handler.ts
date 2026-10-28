import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "mac.call",
    "command": {
      "script": "mac",
      "subcommand": "exec",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "command",
          "kind": "value",
          "required": true
        },
        {
          "source": "cwd",
          "flag": "--cwd",
          "kind": "value"
        },
        {
          "source": "timeout",
          "flag": "--timeout",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "mac.exec",
    "command": {
      "script": "mac",
      "subcommand": "exec",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "command",
          "kind": "value",
          "required": true
        },
        {
          "source": "cwd",
          "flag": "--cwd",
          "kind": "value"
        },
        {
          "source": "timeout",
          "flag": "--timeout",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "mac.list",
    "command": {
      "script": "mac",
      "subcommand": "list",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "path",
          "kind": "value"
        },
        {
          "source": "depth",
          "flag": "--depth",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "mac.port",
    "command": {
      "script": "mac",
      "subcommand": "port",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "port",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "mac.process",
    "command": {
      "script": "mac",
      "subcommand": "process",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "pid",
          "flag": "--pid",
          "kind": "value"
        },
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "mac.read",
    "command": {
      "script": "mac",
      "subcommand": "read",
      "branchMode": "none",
      "jsonFlag": "--json",
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
    "name": "mac.search",
    "command": {
      "script": "mac",
      "subcommand": "search",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "pattern",
          "kind": "value",
          "required": true
        },
        {
          "source": "path",
          "kind": "value"
        },
        {
          "source": "include",
          "flag": "--include",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "mac.write",
    "command": {
      "script": "mac",
      "subcommand": "write",
      "branchMode": "none",
      "jsonFlag": "--json",
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
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
