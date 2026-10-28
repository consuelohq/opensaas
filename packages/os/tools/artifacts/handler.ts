import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "artifacts.check",
    "command": {
      "script": "artifacts",
      "subcommand": "check",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.generateDemo",
    "command": {
      "script": "artifacts",
      "subcommand": "generate-demo",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.generateDigitalEguide",
    "command": {
      "script": "artifacts",
      "subcommand": "generate-digital-eguide",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "template",
          "flag": "--template",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.generateEmail",
    "command": {
      "script": "artifacts",
      "subcommand": "generate-email",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.generateImageBrief",
    "command": {
      "script": "artifacts",
      "subcommand": "generate-image-brief",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.generateMotionFrame",
    "command": {
      "script": "artifacts",
      "subcommand": "generate-motion-frame",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.generateWebsite",
    "command": {
      "script": "artifacts",
      "subcommand": "generate-website",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.getDesignSystem",
    "command": {
      "script": "artifacts",
      "subcommand": "get-design-system",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.listDesignSystems",
    "command": {
      "script": "artifacts",
      "subcommand": "list-design-systems",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.listSkills",
    "command": {
      "script": "artifacts",
      "subcommand": "list-skills",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.odBuild",
    "command": {
      "script": "artifacts",
      "subcommand": "od:build",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.publish",
    "command": {
      "script": "artifacts",
      "subcommand": "publish",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "target",
          "flag": "--target",
          "kind": "value"
        },
        {
          "source": "portlessName",
          "flag": "--portless-name",
          "kind": "value"
        },
        {
          "source": "path",
          "flag": "--path",
          "kind": "value"
        },
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "category",
          "flag": "--category",
          "kind": "value"
        },
        {
          "source": "template",
          "flag": "--template",
          "kind": "value"
        },
        {
          "source": "tailscaleBin",
          "flag": "--tailscale-bin",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "artifacts.railwayCheck",
    "command": {
      "script": "artifacts",
      "subcommand": "railway:check",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.refresh",
    "command": {
      "script": "artifacts",
      "subcommand": "refresh",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "tailscaleBin",
          "flag": "--tailscale-bin",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "artifacts.renderHyperframes",
    "command": {
      "script": "artifacts",
      "subcommand": "render-hyperframes",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "name",
          "flag": "--name",
          "kind": "value"
        },
        {
          "source": "prompt",
          "flag": "--prompt",
          "kind": "value"
        },
        {
          "source": "live",
          "flag": "--live",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "artifacts.run",
    "command": {
      "script": "artifacts",
      "subcommand": "run",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.uiBg",
    "command": {
      "script": "artifacts",
      "subcommand": "ui:bg",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.uiLogs",
    "command": {
      "script": "artifacts",
      "subcommand": "ui:logs",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.uiStatus",
    "command": {
      "script": "artifacts",
      "subcommand": "ui:status",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.uiStop",
    "command": {
      "script": "artifacts",
      "subcommand": "ui:stop",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  },
  {
    "name": "artifacts.upstreamStatus",
    "command": {
      "script": "artifacts",
      "subcommand": "upstream-status",
      "branchMode": "none",
      "executionScope": "runtime",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": []
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
