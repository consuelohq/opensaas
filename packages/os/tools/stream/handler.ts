import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "stream.context",
    "command": {
      "script": "stream:context",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "area",
          "flag": "--area",
          "kind": "value",
          "required": true
        },
        {
          "source": "stream",
          "flag": "--stream",
          "kind": "value"
        },
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "stream.create",
    "command": {
      "script": "stream:create",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "area",
          "flag": "--area",
          "kind": "value",
          "required": true
        },
        {
          "source": "sourceBranch",
          "flag": "--source-branch",
          "kind": "value"
        },
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "stream.list",
    "command": {
      "script": "stream:list",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "stream.sync",
    "command": {
      "script": "stream:sync",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "area",
          "flag": "--area",
          "kind": "value",
          "required": true
        },
        {
          "source": "stream",
          "flag": "--stream",
          "kind": "value"
        },
        {
          "source": "repo",
          "flag": "--repo",
          "kind": "value"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
