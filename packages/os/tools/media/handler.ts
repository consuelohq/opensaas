import type { ToolHandlerContribution } from '../package';

export const toolHandlers = [
  {
    "name": "media.angle.measure",
    "command": {
      "script": "media",
      "subcommand": "angle:measure",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.audio.extract",
    "command": {
      "script": "media",
      "subcommand": "audio:extract",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.audio.normalize",
    "command": {
      "script": "media",
      "subcommand": "audio:normalize",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.breakdown.plan",
    "command": {
      "script": "media",
      "subcommand": "breakdown:plan",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.camera.motion",
    "command": {
      "script": "media",
      "subcommand": "camera:motion",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.clip.search",
    "command": {
      "script": "media",
      "subcommand": "clip:search",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.compose",
    "command": {
      "script": "media",
      "subcommand": "compose",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.doctor",
    "command": {
      "script": "media",
      "subcommand": "doctor",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.export",
    "command": {
      "script": "media",
      "subcommand": "export",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.frames.extract",
    "command": {
      "script": "media",
      "subcommand": "frames:extract",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.ingest",
    "command": {
      "script": "media",
      "subcommand": "ingest",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.install",
    "command": {
      "script": "media",
      "subcommand": "install",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.motion.track",
    "command": {
      "script": "media",
      "subcommand": "motion:track",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.object.track",
    "command": {
      "script": "media",
      "subcommand": "object:track",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.overlay.render",
    "command": {
      "script": "media",
      "subcommand": "overlay:render",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.pose.estimate",
    "command": {
      "script": "media",
      "subcommand": "pose:estimate",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.probe",
    "command": {
      "script": "media",
      "subcommand": "probe",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.qa",
    "command": {
      "script": "media",
      "subcommand": "qa",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.scene.detect",
    "command": {
      "script": "media",
      "subcommand": "scene:detect",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.screenshot.render",
    "command": {
      "script": "media",
      "subcommand": "screenshot:render",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "input",
          "flag": "--input",
          "kind": "value",
          "required": true
        },
        {
          "source": "out",
          "flag": "--out",
          "kind": "value",
          "required": true
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
          "source": "theme",
          "flag": "--theme",
          "kind": "value"
        },
        {
          "source": "accent",
          "flag": "--accent",
          "kind": "value"
        },
        {
          "source": "background",
          "flag": "--background",
          "kind": "value"
        },
        {
          "source": "padding",
          "flag": "--padding",
          "kind": "value"
        },
        {
          "source": "fit",
          "flag": "--fit",
          "kind": "value"
        },
        {
          "source": "pattern",
          "flag": "--pattern",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "media.sports-science.metrics",
    "command": {
      "script": "media",
      "subcommand": "sports-science:metrics",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.svg",
    "command": {
      "script": "media:svg",
      "branchMode": "none",
      "jsonFlag": "--json",
      "dryRunFlag": "--dry-run",
      "arguments": [
        {
          "source": "action",
          "kind": "value"
        },
        {
          "source": "input",
          "flag": "--input",
          "kind": "value"
        },
        {
          "source": "output",
          "flag": "--output",
          "kind": "value"
        },
        {
          "source": "svg",
          "flag": "--svg",
          "kind": "value"
        },
        {
          "source": "svgFile",
          "flag": "--svg-file",
          "kind": "value"
        },
        {
          "source": "documentJson",
          "flag": "--document-json",
          "kind": "value"
        },
        {
          "source": "operationsJson",
          "flag": "--operations-json",
          "kind": "value"
        },
        {
          "source": "checksJson",
          "flag": "--checks-json",
          "kind": "value"
        },
        {
          "source": "renderJson",
          "flag": "--render-json",
          "kind": "value"
        },
        {
          "source": "selectorsJson",
          "flag": "--selectors-json",
          "kind": "value"
        },
        {
          "source": "snapshot",
          "flag": "--snapshot",
          "kind": "boolean"
        },
        {
          "source": "snapshotName",
          "flag": "--snapshot-name",
          "kind": "value"
        },
        {
          "source": "restoreFrom",
          "flag": "--restore-from",
          "kind": "value"
        }
      ]
    }
  },
  {
    "name": "media.svg.convert",
    "command": {
      "script": "media",
      "subcommand": "svg:convert",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": [
        {
          "source": "input",
          "flag": "--input",
          "kind": "value",
          "required": true
        },
        {
          "source": "out",
          "flag": "--out",
          "kind": "value",
          "required": true
        },
        {
          "source": "strategy",
          "flag": "--strategy",
          "kind": "value"
        },
        {
          "source": "traceEngine",
          "flag": "--trace-engine",
          "kind": "value"
        },
        {
          "source": "optimize",
          "flag": "--optimize",
          "kind": "boolean"
        }
      ]
    }
  },
  {
    "name": "media.timeline.validate",
    "command": {
      "script": "media",
      "subcommand": "timeline:validate",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  },
  {
    "name": "media.transcribe",
    "command": {
      "script": "media",
      "subcommand": "transcribe",
      "branchMode": "none",
      "jsonFlag": "--json",
      "arguments": []
    }
  }
] as const satisfies readonly ToolHandlerContribution[];
