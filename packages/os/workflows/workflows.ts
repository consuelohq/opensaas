export type WorkflowConfig = {
  id: string;
  aliases?: readonly string[];
  roles?: readonly string[];
  categories?: readonly string[];
  subscriptions?: readonly Record<string, unknown>[];
};

export const workflows = [
  {
    "id": "task",
    "aliases": [
      "repo",
      "code"
    ],
    "roles": [
      "stream.context",
      "task.start",
      "workpad.write",
      "decision.research",
      "test.run",
      "diff.inspect",
      "validation.review",
      "validation.verify",
      "task.push",
      "task.pr",
      "task.finish",
      "tool.search"
    ],
    "subscriptions": [
      {
        "event": "workflow.intent.task.detected",
        "workflow": "task"
      },
      {
        "event": "tool.preInvoke",
        "workflow": "task",
        "tool": "stream.context"
      },
      {
        "event": "tool.postInvoke",
        "workflow": "task",
        "tool": "stream.context"
      },
      {
        "event": "tool.preInvoke",
        "workflow": "task",
        "tool": "task.start"
      },
      {
        "event": "tool.postInvoke",
        "workflow": "task",
        "tool": "task.start"
      },
      {
        "event": "workflow.stage.ready",
        "workflow": "task",
        "stage": "validation"
      },
      {
        "event": "tool.preInvoke",
        "workflow": "task",
        "tool": "task.push"
      },
      {
        "event": "tool.postInvoke",
        "workflow": "task",
        "tool": "task.push"
      },
      {
        "event": "tool.postInvoke",
        "workflow": "task",
        "tool": "task.pr"
      },
      {
        "event": "workflow.stage.ready",
        "workflow": "task",
        "stage": "task-finish"
      }
    ]
  },
  {
    "id": "artifacts",
    "aliases": [],
    "roles": [
      "artifacts.publish",
      "artifacts.refresh",
      "artifacts.run",
      "artifacts.designSystem.get",
      "artifacts.skills.list",
      "artifacts.designSystems.list",
      "artifacts.upstreamStatus",
      "artifacts.railwayCheck",
      "artifacts.check",
      "artifacts.generate.website",
      "artifacts.generate.demo",
      "artifacts.generate.imageBrief",
      "artifacts.generate.digitalEguide",
      "artifacts.generate.email",
      "artifacts.generate.motionFrame",
      "artifacts.render.hyperframes",
      "artifacts.ui.background",
      "artifacts.ui.stop",
      "artifacts.ui.status",
      "artifacts.ui.logs",
      "artifacts.openDesign.build"
    ],
    "categories": [
      "artifacts"
    ],
    "subscriptions": [
      {
        "event": "workflow.intent.artifacts.detected",
        "workflow": "artifacts"
      },
      {
        "event": "artifact.postRender",
        "workflow": "artifacts"
      },
      {
        "event": "artifact.prePublish",
        "workflow": "artifacts"
      },
      {
        "event": "artifact.postPublish",
        "workflow": "artifacts"
      }
    ]
  },
  {
    "id": "media",
    "aliases": [
      "video",
      "clips",
      "youtube",
      "sports-media"
    ],
    "roles": [
      "media.probe",
      "media.compose",
      "media.qa",
      "media.workflow.runbook"
    ],
    "categories": [
      "media"
    ],
    "subscriptions": [
      {
        "event": "workflow.intent.media.detected",
        "workflow": "media"
      }
    ]
  }
] as const satisfies readonly WorkflowConfig[];
