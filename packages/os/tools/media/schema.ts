import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "media.angle.measure",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.angle.measure",
      "methodPath": [
        "media",
        "angle",
        "measure"
      ],
      "description": "Measure joint and segment angles from pose-track artifacts.",
      "category": "media",
      "underlying": "os media angle.measure",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaAngleMetrics",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.angle.measure",
      "requiredProfiles": [
        "media-vision-pose"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.audio.extract",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.audio.extract",
      "methodPath": [
        "media",
        "audio",
        "extract"
      ],
      "description": "Extract audio tracks from source media into deterministic audio artifacts.",
      "category": "media",
      "underlying": "os media audio.extract",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaAudioArtifact",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.audio.extract",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffmpeg"
      ]
    }
  },
  {
    "name": "media.audio.normalize",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.audio.normalize",
      "methodPath": [
        "media",
        "audio",
        "normalize"
      ],
      "description": "Normalize media audio loudness for rendering and QA workflows.",
      "category": "media",
      "underlying": "os media audio.normalize",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaAudioArtifact",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.audio.normalize",
      "requiredProfiles": [
        "media-audio"
      ],
      "requiredCommands": [
        "sox"
      ]
    }
  },
  {
    "name": "media.breakdown.plan",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.breakdown.plan",
      "methodPath": [
        "media",
        "breakdown",
        "plan"
      ],
      "description": "Create a structured data-backed sports-science breakdown plan.",
      "category": "media",
      "underlying": "os media breakdown.plan",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaBreakdownPlan",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.breakdown.plan",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffprobe"
      ]
    }
  },
  {
    "name": "media.camera.motion",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.camera.motion",
      "methodPath": [
        "media",
        "camera",
        "motion"
      ],
      "description": "Estimate camera movement separately from subject movement.",
      "category": "media",
      "underlying": "os media camera.motion",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaCameraMotion",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.camera.motion",
      "requiredProfiles": [
        "media-vision-light"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.clip.search",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.clip.search",
      "methodPath": [
        "media",
        "clip",
        "search"
      ],
      "description": "Search and score candidate video clips for downstream media workflows.",
      "category": "media",
      "underlying": "os media clip.search",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaClipSearchResult",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.clip.search",
      "requiredProfiles": [
        "media-youtube"
      ],
      "requiredCommands": [
        "yt-dlp"
      ]
    }
  },
  {
    "name": "media.compose",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.compose",
      "methodPath": [
        "media",
        "compose"
      ],
      "description": "Compose a timeline and media assets into a rendered draft video.",
      "category": "media",
      "underlying": "os media compose",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaRenderResult",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.compose",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffmpeg"
      ]
    }
  },
  {
    "name": "media.doctor",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.doctor",
      "methodPath": [
        "media",
        "doctor"
      ],
      "description": "Check installed media runtime dependencies and optional profile readiness.",
      "category": "media",
      "underlying": "os media doctor",
      "capabilities": {
        "readOnly": false,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaDependencyReport",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.doctor",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffmpeg",
        "ffprobe",
        "mediainfo",
        "magick",
        "exiftool"
      ]
    }
  },
  {
    "name": "media.export",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.export",
      "methodPath": [
        "media",
        "export"
      ],
      "description": "Package rendered media for YouTube Shorts, TikTok, Reels, and handoff workflows.",
      "category": "media",
      "underlying": "os media export",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaExportPackage",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.export",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffmpeg",
        "ffprobe"
      ]
    }
  },
  {
    "name": "media.frames.extract",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.frames.extract",
      "methodPath": [
        "media",
        "frames",
        "extract"
      ],
      "description": "Extract selected frames and frame manifests from a media source.",
      "category": "media",
      "underlying": "os media frames.extract",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaFrameManifest",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.frames.extract",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffmpeg"
      ]
    }
  },
  {
    "name": "media.ingest",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.ingest",
      "methodPath": [
        "media",
        "ingest"
      ],
      "description": "Ingest a source video or media URL into a deterministic media asset bundle.",
      "category": "media",
      "underlying": "os media ingest",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaIngestManifest",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.ingest",
      "requiredProfiles": [
        "media-youtube"
      ],
      "requiredCommands": [
        "yt-dlp",
        "ffprobe"
      ]
    }
  },
  {
    "name": "media.install",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.install",
      "methodPath": [
        "media",
        "install"
      ],
      "description": "Create media runtime dependency install plans and guarded install attempts.",
      "category": "media",
      "underlying": "os media install",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaInstallPlan",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.install",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "brew"
      ]
    }
  },
  {
    "name": "media.motion.track",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.motion.track",
      "methodPath": [
        "media",
        "motion",
        "track"
      ],
      "description": "Track generic motion vectors and features across a video range.",
      "category": "media",
      "underlying": "os media motion.track",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaMotionTrack",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.motion.track",
      "requiredProfiles": [
        "media-vision-light"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.object.track",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.object.track",
      "methodPath": [
        "media",
        "object",
        "track"
      ],
      "description": "Track configured objects or regions through a video range.",
      "category": "media",
      "underlying": "os media object.track",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaObjectTrack",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.object.track",
      "requiredProfiles": [
        "media-vision-light"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.overlay.render",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.overlay.render",
      "methodPath": [
        "media",
        "overlay",
        "render"
      ],
      "description": "Render declarative overlay artifacts for composition.",
      "category": "media",
      "underlying": "os media overlay.render",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaOverlay",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.overlay.render",
      "requiredProfiles": [
        "media-render-advanced"
      ],
      "requiredCommands": [
        "magick"
      ]
    }
  },
  {
    "name": "media.pose.estimate",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.pose.estimate",
      "methodPath": [
        "media",
        "pose",
        "estimate"
      ],
      "description": "Estimate human pose landmarks for sports-science analysis.",
      "category": "media",
      "underlying": "os media pose.estimate",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaPoseTrack",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.pose.estimate",
      "requiredProfiles": [
        "media-vision-pose"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.probe",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.probe",
      "methodPath": [
        "media",
        "probe"
      ],
      "description": "Inspect a media source with ffprobe and normalize codec, duration, stream, and metadata facts.",
      "category": "media",
      "underlying": "os media probe",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaAsset",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.probe",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffprobe"
      ]
    }
  },
  {
    "name": "media.qa",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.qa",
      "methodPath": [
        "media",
        "qa"
      ],
      "description": "Inspect rendered media for dimensions, duration, codec, size, captions, and basic quality checks.",
      "category": "media",
      "underlying": "os media qa",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaQaResult",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.qa",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffprobe"
      ]
    }
  },
  {
    "name": "media.scene.detect",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.scene.detect",
      "methodPath": [
        "media",
        "scene",
        "detect"
      ],
      "description": "Detect scene boundaries and candidate highlight moments.",
      "category": "media",
      "underlying": "os media scene.detect",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaSceneDetectResult",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.scene.detect",
      "requiredProfiles": [
        "media-vision-light"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.screenshot.render",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.screenshot.render",
      "methodPath": [
        "media",
        "screenshot",
        "render"
      ],
      "description": "Render a local screenshot into a deterministic social/X-ready PNG with configurable Consuelo themes, spacing, fit, and line patterns.",
      "category": "media",
      "underlying": "os media screenshot.render",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MediaScreenshotRenderInput",
      "outputSchema": "MediaScreenshotResult",
      "exampleInput": {
        "input": "screenshots/chatgpt.png",
        "out": "renders/chatgpt-x.png",
        "theme": "dark",
        "accent": "#0000F2",
        "pattern": "grid"
      },
      "sessionRequired": false,
      "workflowRole": "media.screenshot.render",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "ffmpeg"
      ]
    }
  },
  {
    "name": "media.sports-science.metrics",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.sports-science.metrics",
      "methodPath": [
        "media",
        "sports-science",
        "metrics"
      ],
      "description": "Compute sports-science metrics from pose and motion artifacts.",
      "category": "media",
      "underlying": "os media sports-science.metrics",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaSportsScienceMetrics",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.sports-science.metrics",
      "requiredProfiles": [
        "media-vision-pose"
      ],
      "requiredCommands": [
        "python3"
      ]
    }
  },
  {
    "name": "media.svg",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.svg",
      "methodPath": [
        "media",
        "svg"
      ],
      "description": "Primitive SVG structure, render, measure, edit, and verify tool with snapshots, visible-pixel bounding boxes, editable text operations, and color-scheme rendering.",
      "category": "media",
      "underlying": "os media:svg",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MediaSvgInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "verify",
        "input": "asset.svg",
        "checks": [
          {
            "check": "renderable"
          }
        ],
        "render": {
          "colorScheme": "light"
        }
      },
      "sessionRequired": false,
      "workflowRole": "media.svg",
      "requiredProfiles": [
        "media-core"
      ],
      "requiredCommands": [
        "python3",
        "rsvg-convert"
      ]
    }
  },
  {
    "name": "media.svg.convert",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.svg.convert",
      "methodPath": [
        "media",
        "svg",
        "convert"
      ],
      "description": "Convert raster images into SVG assets using exact wrapper and vector trace strategies.",
      "category": "media",
      "underlying": "os media svg.convert",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MediaSvgConvertInput",
      "outputSchema": "MediaSvgResult",
      "exampleInput": {
        "input": "image.png",
        "out": "image.svg",
        "strategy": "both",
        "traceEngine": "auto"
      },
      "sessionRequired": false,
      "workflowRole": "media.svg.convert",
      "requiredProfiles": [
        "media-render-advanced"
      ],
      "requiredCommands": [
        "ffmpeg",
        "potrace"
      ]
    }
  },
  {
    "name": "media.timeline.validate",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.timeline.validate",
      "methodPath": [
        "media",
        "timeline",
        "validate"
      ],
      "description": "Validate a media timeline contract and referenced artifacts.",
      "category": "media",
      "underlying": "os media timeline.validate",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": true,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "MediaTimelineValidationResult",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.timeline.validate",
      "requiredProfiles": [],
      "requiredCommands": []
    }
  },
  {
    "name": "media.transcribe",
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
      "requiredProfiles",
      "requiredCommands"
    ],
    "definition": {
      "name": "media.transcribe",
      "methodPath": [
        "media",
        "transcribe"
      ],
      "description": "Create transcript artifacts from a media audio or video source.",
      "category": "media",
      "underlying": "os media transcribe",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": true,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "MediaTranscribeInput",
      "outputSchema": "MediaTranscript",
      "exampleInput": {
        "input": "media/input.wav",
        "mode": "fixture",
        "dryRun": true
      },
      "sessionRequired": false,
      "workflowRole": "media.transcribe",
      "requiredProfiles": [
        "media-audio"
      ],
      "requiredCommands": [
        "ffmpeg"
      ]
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
