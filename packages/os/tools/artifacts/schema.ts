import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "artifacts.check",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.check",
      "methodPath": [
        "artifacts",
        "check"
      ],
      "description": "run artifacts package boundary and Railway checks",
      "category": "artifacts",
      "underlying": "OS artifacts check",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.check",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.generateDemo",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.generateDemo",
      "methodPath": [
        "artifacts",
        "generateDemo"
      ],
      "description": "create a headless Open Design work order for a demo artifact; pass live=true only for a headed UI session",
      "category": "artifacts",
      "underlying": "OS artifacts generate-demo",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsSessionInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.generate.demo",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.generateDigitalEguide",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.generateDigitalEguide",
      "methodPath": [
        "artifacts",
        "generateDigitalEguide"
      ],
      "description": "create a headless Open Design work order for a digital e-guide artifact, optionally using a named Consuelo e-guide template",
      "category": "artifacts",
      "underlying": "OS artifacts generate-digital-eguide",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsDigitalEguideInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.generate.digitalEguide",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.generateEmail",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.generateEmail",
      "methodPath": [
        "artifacts",
        "generateEmail"
      ],
      "description": "create a headless Open Design work order for a email artifact; pass live=true only for a headed UI session",
      "category": "artifacts",
      "underlying": "OS artifacts generate-email",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsSessionInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.generate.email",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.generateImageBrief",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.generateImageBrief",
      "methodPath": [
        "artifacts",
        "generateImageBrief"
      ],
      "description": "create a headless Open Design work order for a image/media artifact; pass live=true only for a headed UI session",
      "category": "artifacts",
      "underlying": "OS artifacts generate-image-brief",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsSessionInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.generate.imageBrief",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.generateMotionFrame",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.generateMotionFrame",
      "methodPath": [
        "artifacts",
        "generateMotionFrame"
      ],
      "description": "create a headless Open Design work order for a motion-frame artifact; pass live=true only for a headed UI session",
      "category": "artifacts",
      "underlying": "OS artifacts generate-motion-frame",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsSessionInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.generate.motionFrame",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.generateWebsite",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.generateWebsite",
      "methodPath": [
        "artifacts",
        "generateWebsite"
      ],
      "description": "create a headless Open Design work order for a website artifact; pass live=true only for a headed UI session",
      "category": "artifacts",
      "underlying": "OS artifacts generate-website",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsSessionInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.generate.website",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.getDesignSystem",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.getDesignSystem",
      "methodPath": [
        "artifacts",
        "getDesignSystem"
      ],
      "description": "return base Consuelo DESIGN.md and artifacts AGENTS.md only",
      "category": "artifacts",
      "underlying": "OS artifacts get-design-system",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.designSystem.get",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.listDesignSystems",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.listDesignSystems",
      "methodPath": [
        "artifacts",
        "listDesignSystems"
      ],
      "description": "list Consuelo default design system and upstream reference systems",
      "category": "artifacts",
      "underlying": "OS artifacts list-design-systems",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.designSystems.list",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.listSkills",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.listSkills",
      "methodPath": [
        "artifacts",
        "listSkills"
      ],
      "description": "list upstream Open Design skills and Consuelo workflow mappings",
      "category": "artifacts",
      "underlying": "OS artifacts list-skills",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.skills.list",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.odBuild",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.odBuild",
      "methodPath": [
        "artifacts",
        "odBuild"
      ],
      "description": "build the vendored Open Design daemon CLI through the Bun facade",
      "category": "artifacts",
      "underlying": "OS artifacts od:build",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "ArtifactsUiInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.openDesign.build",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.publish",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.publish",
      "methodPath": [
        "artifacts",
        "publish"
      ],
      "description": "publish a design artifact through private Tailscale Serve and update the artifact catalog",
      "category": "artifacts",
      "underlying": "OS artifacts publish",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "ArtifactsPublishInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "portlessName": "design.localhost",
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.publish",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.railwayCheck",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.railwayCheck",
      "methodPath": [
        "artifacts",
        "railwayCheck"
      ],
      "description": "verify artifacts is excluded from Railway deploy paths",
      "category": "artifacts",
      "underlying": "OS artifacts railway:check",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.railwayCheck",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.refresh",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.refresh",
      "methodPath": [
        "artifacts",
        "refresh"
      ],
      "description": "regenerate and publish the existing Consuelo Artifacts archive without adding an artifact",
      "category": "artifacts",
      "underlying": "OS artifacts refresh",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "ArtifactsRefreshInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.refresh",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.renderHyperframes",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.renderHyperframes",
      "methodPath": [
        "artifacts",
        "renderHyperframes"
      ],
      "description": "create a headless Open Design work order for a HyperFrames render artifact; pass live=true only for a headed UI session",
      "category": "artifacts",
      "underlying": "OS artifacts render-hyperframes",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsSessionInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.render.hyperframes",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.run",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.run",
      "methodPath": [
        "artifacts",
        "run"
      ],
      "description": "start Open Design daemon and web UI in the foreground through the Bun facade",
      "category": "artifacts",
      "underlying": "OS artifacts run",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ArtifactsUiInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.run",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.uiBg",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.uiBg",
      "methodPath": [
        "artifacts",
        "uiBg"
      ],
      "description": "start Open Design managed runtimes in the background through the Bun facade",
      "category": "artifacts",
      "underlying": "OS artifacts ui:bg",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "ArtifactsUiInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.ui.background",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.uiLogs",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.uiLogs",
      "methodPath": [
        "artifacts",
        "uiLogs"
      ],
      "description": "show Open Design managed runtime logs through the Bun facade",
      "category": "artifacts",
      "underlying": "OS artifacts ui:logs",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.ui.logs",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.uiStatus",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.uiStatus",
      "methodPath": [
        "artifacts",
        "uiStatus"
      ],
      "description": "show Open Design managed runtime status through the Bun facade",
      "category": "artifacts",
      "underlying": "OS artifacts ui:status",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.ui.status",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.uiStop",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.uiStop",
      "methodPath": [
        "artifacts",
        "uiStop"
      ],
      "description": "stop Open Design managed runtimes through the Bun facade",
      "category": "artifacts",
      "underlying": "OS artifacts ui:stop",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "ArtifactsUiInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "artifacts.ui.stop",
      "workflowAliases": []
    }
  },
  {
    "name": "artifacts.upstreamStatus",
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
      "workflowRole",
      "workflowAliases"
    ],
    "definition": {
      "name": "artifacts.upstreamStatus",
      "methodPath": [
        "artifacts",
        "upstreamStatus"
      ],
      "description": "show vendored Open Design metadata and runtime requirements",
      "category": "artifacts",
      "underlying": "OS artifacts upstream-status",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 30000,
      "inputSchema": "ArtifactsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false,
      "workflowRole": "artifacts.upstreamStatus",
      "workflowAliases": []
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
