import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "browser",
    "command": {
      "script": "browser",
      "branchMode": "none",
      "arguments": [
        {
          "source": "command",
          "kind": "value"
        },
        {
          "source": "url",
          "kind": "value"
        },
        {
          "source": "args",
          "kind": "array"
        }
      ]
    }
  },
  {
    "name": "browser.app",
    "command": {
      "script": "browser",
      "subcommand": "app",
      "branchMode": "none",
      "arguments": [
        {
          "source": "headed",
          "flag": "--headed",
          "kind": "boolean"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        },
        {
          "source": "preset",
          "flag": "--preset",
          "kind": "value"
        },
        {
          "source": "device",
          "flag": "--device",
          "kind": "value"
        },
        {
          "source": "provider",
          "flag": "--provider",
          "kind": "value"
        },
        {
          "source": "width",
          "flag": "--width",
          "kind": "value"
        },
        {
          "source": "height",
          "flag": "--height",
          "kind": "value"
        },
        {
          "source": "colorScheme",
          "flag": "--color-scheme",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.click",
    "command": {
      "script": "browser",
      "subcommand": "click",
      "branchMode": "none",
      "arguments": [
        {
          "source": "ref",
          "kind": "value",
          "required": true
        }
      ]
    }
  },
  {
    "name": "browser.clipboard",
    "command": {
      "script": "browser",
      "subcommand": "clipboard",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "text",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.close",
    "command": {
      "script": "browser",
      "subcommand": "close",
      "branchMode": "none",
      "arguments": []
    }
  },
  {
    "name": "browser.consuelo",
    "command": {
      "script": "browser",
      "subcommand": "consuelo",
      "branchMode": "none",
      "arguments": [
        {
          "source": "headed",
          "flag": "--headed",
          "kind": "boolean"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        },
        {
          "source": "preset",
          "flag": "--preset",
          "kind": "value"
        },
        {
          "source": "device",
          "flag": "--device",
          "kind": "value"
        },
        {
          "source": "provider",
          "flag": "--provider",
          "kind": "value"
        },
        {
          "source": "width",
          "flag": "--width",
          "kind": "value"
        },
        {
          "source": "height",
          "flag": "--height",
          "kind": "value"
        },
        {
          "source": "colorScheme",
          "flag": "--color-scheme",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.cookies",
    "command": {
      "script": "browser",
      "subcommand": "cookies",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value"
        },
        {
          "source": "name",
          "kind": "value"
        },
        {
          "source": "value",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.dialog",
    "command": {
      "script": "browser",
      "subcommand": "dialog",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "text",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.download",
    "command": {
      "script": "browser",
      "subcommand": "download",
      "branchMode": "none",
      "arguments": [
        {
          "source": "ref",
          "kind": "value",
          "required": true
        },
        {
          "source": "path",
          "kind": "value",
          "required": true
        }
      ]
    }
  },
  {
    "name": "browser.eval",
    "command": {
      "script": "browser",
      "subcommand": "eval",
      "branchMode": "none",
      "arguments": [
        {
          "source": "js",
          "kind": "value",
          "required": true
        }
      ]
    }
  },
  {
    "name": "browser.fill",
    "command": {
      "script": "browser",
      "subcommand": "fill",
      "branchMode": "none",
      "arguments": [
        {
          "source": "ref",
          "kind": "value",
          "required": true
        },
        {
          "source": "text",
          "kind": "value",
          "required": true
        }
      ]
    }
  },
  {
    "name": "browser.find",
    "command": {
      "script": "browser",
      "subcommand": "find",
      "branchMode": "none",
      "arguments": [
        {
          "source": "by",
          "kind": "value",
          "required": true
        },
        {
          "source": "value",
          "kind": "value",
          "required": true
        },
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "text",
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
    "name": "browser.get",
    "command": {
      "script": "browser",
      "subcommand": "get",
      "branchMode": "none",
      "arguments": [
        {
          "source": "target",
          "kind": "value",
          "required": true
        },
        {
          "source": "selector",
          "kind": "value"
        },
        {
          "source": "attribute",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.headed",
    "command": {
      "script": "browser",
      "subcommand": "headed",
      "branchMode": "none",
      "arguments": [
        {
          "source": "url",
          "kind": "value",
          "required": true
        },
        {
          "source": "provider",
          "flag": "--provider",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.network",
    "command": {
      "script": "browser",
      "subcommand": "network",
      "branchMode": "none",
      "arguments": [
        {
          "source": "args",
          "kind": "array",
          "required": true
        }
      ]
    }
  },
  {
    "name": "browser.open",
    "command": {
      "script": "browser",
      "subcommand": "open",
      "branchMode": "none",
      "arguments": [
        {
          "source": "url",
          "kind": "value",
          "required": true
        },
        {
          "source": "headed",
          "flag": "--headed",
          "kind": "boolean"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        },
        {
          "source": "preset",
          "flag": "--preset",
          "kind": "value"
        },
        {
          "source": "device",
          "flag": "--device",
          "kind": "value"
        },
        {
          "source": "provider",
          "flag": "--provider",
          "kind": "value"
        },
        {
          "source": "width",
          "flag": "--width",
          "kind": "value"
        },
        {
          "source": "height",
          "flag": "--height",
          "kind": "value"
        },
        {
          "source": "colorScheme",
          "flag": "--color-scheme",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.raw",
    "command": {
      "script": "browser",
      "subcommand": "raw",
      "branchMode": "none",
      "arguments": [
        {
          "source": "args",
          "kind": "array",
          "required": true
        }
      ]
    }
  },
  {
    "name": "browser.screenshot",
    "command": {
      "script": "browser",
      "subcommand": "screenshot",
      "branchMode": "none",
      "arguments": [
        {
          "source": "name",
          "kind": "value"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        },
        {
          "source": "preset",
          "flag": "--preset",
          "kind": "value"
        },
        {
          "source": "device",
          "flag": "--device",
          "kind": "value"
        },
        {
          "source": "provider",
          "flag": "--provider",
          "kind": "value"
        },
        {
          "source": "width",
          "flag": "--width",
          "kind": "value"
        },
        {
          "source": "height",
          "flag": "--height",
          "kind": "value"
        },
        {
          "source": "colorScheme",
          "flag": "--color-scheme",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.snap",
    "command": {
      "script": "browser",
      "subcommand": "snap",
      "branchMode": "none",
      "arguments": []
    }
  },
  {
    "name": "browser.status",
    "command": {
      "script": "browser",
      "subcommand": "status",
      "branchMode": "none",
      "arguments": []
    }
  },
  {
    "name": "browser.tabs",
    "command": {
      "script": "browser",
      "subcommand": "tabs",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value"
        },
        {
          "source": "target",
          "kind": "value"
        },
        {
          "source": "url",
          "kind": "value"
        },
        {
          "source": "label",
          "flag": "--label",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.test",
    "command": {
      "script": "browser",
      "subcommand": "open",
      "branchMode": "none",
      "arguments": [
        {
          "source": "url",
          "kind": "value",
          "required": true
        },
        {
          "source": "headed",
          "flag": "--headed",
          "kind": "boolean"
        },
        {
          "source": "full",
          "flag": "--full",
          "kind": "boolean"
        },
        {
          "source": "preset",
          "flag": "--preset",
          "kind": "value"
        },
        {
          "source": "device",
          "flag": "--device",
          "kind": "value"
        },
        {
          "source": "provider",
          "flag": "--provider",
          "kind": "value"
        },
        {
          "source": "width",
          "flag": "--width",
          "kind": "value"
        },
        {
          "source": "height",
          "flag": "--height",
          "kind": "value"
        },
        {
          "source": "colorScheme",
          "flag": "--color-scheme",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.trace",
    "command": {
      "script": "browser",
      "subcommand": "trace",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "path",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "browser.wait",
    "command": {
      "script": "browser",
      "subcommand": "wait",
      "branchMode": "none",
      "arguments": [
        {
          "source": "target",
          "kind": "value"
        },
        {
          "source": "text",
          "flag": "--text",
          "kind": "value"
        },
        {
          "source": "url",
          "flag": "--url",
          "kind": "value"
        },
        {
          "source": "load",
          "flag": "--load",
          "kind": "value"
        },
        {
          "source": "conditionScript",
          "flag": "--fn",
          "kind": "value"
        },
        {
          "source": "download",
          "flag": "--download",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "doctor",
    "command": {
      "script": "doctor",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "git.status",
    "command": {
      "script": "status",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "research.ingest",
    "command": {
      "script": "research:ingest",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "source",
          "kind": "value",
          "required": true
        },
        {
          "source": "question",
          "flag": "--question",
          "kind": "value"
        },
        {
          "source": "mode",
          "flag": "--mode",
          "kind": "value"
        },
        {
          "source": "visual",
          "flag": "--visual",
          "kind": "boolean"
        },
        {
          "source": "slidesMax",
          "flag": "--slides-max",
          "kind": "value"
        },
        {
          "source": "videoMode",
          "flag": "--video-mode",
          "kind": "value"
        },
        {
          "source": "keep",
          "flag": "--keep",
          "kind": "boolean"
        },
        {
          "source": "outDir",
          "flag": "--out-dir",
          "kind": "value"
        },
        {
          "source": "summarizeBin",
          "flag": "--summarize-bin",
          "kind": "value"
        },
        {
          "source": "memoryTitle",
          "flag": "--memory-title",
          "kind": "value"
        },
        {
          "source": "memoryCategory",
          "flag": "--memory-category",
          "kind": "value"
        },
        {
          "source": "noMemorySave",
          "flag": "--no-memory-save",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "server",
    "command": {
      "script": "consuelo-reload",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        }
      ]
    }
  },
  {
    "name": "status",
    "command": {
      "script": "status",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "tmp",
    "command": {
      "script": "tmp",
      "branchMode": "none",
      "arguments": [
        {
          "source": "action",
          "kind": "value",
          "required": true
        },
        {
          "source": "name",
          "kind": "value"
        },
        {
          "source": "content",
          "kind": "value"
        },
        {
          "source": "ext",
          "flag": "--ext",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "wait",
    "command": {
      "script": "wait",
      "branchMode": "none",
      "arguments": [
        {
          "source": "seconds",
          "kind": "value"
        },
        {
          "source": "duration",
          "flag": "--duration",
          "kind": "value"
        },
        {
          "source": "detached",
          "flag": "--detach",
          "kind": "boolean"
        },
        {
          "source": "status",
          "flag": "--status",
          "kind": "value"
        },
        {
          "source": "list",
          "flag": "--list",
          "kind": "boolean"
        },
        {
          "source": "reason",
          "flag": "--reason",
          "kind": "value"
        },
        {
          "source": "deploy",
          "flag": "--deploy",
          "kind": "boolean"
        },
        {
          "source": "pr",
          "flag": "--pr",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "website.deploy",
    "command": {
      "script": "website:deploy",
      "branchMode": "none",
      "arguments": [
        {
          "source": "preview",
          "flag": "--preview",
          "kind": "boolean"
        },
        {
          "source": "buildOnly",
          "flag": "--build-only",
          "kind": "boolean"
        }
      ]
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
