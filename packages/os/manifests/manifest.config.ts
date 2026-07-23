export const manifestConfig = {
  "version": 1,
  "outputs": {
    "full": "packages/os/manifests/generated/tool.manifest.json",
    "core": "packages/os/manifests/generated/core.manifest.json",
    "workflows": "packages/os/workflows/generated/workflow-bundles.json"
  },
  "core": {
    "includeNames": [
      "batch",
      "code.call",
      "memory",
      "explore",
      "github",
      "task.start",
      "review.run",
      "tools.search",
      "tmp"
    ],
    "includePrefixes": [
      "fs.",
      "stream."
    ],
    "includeCategories": [],
    "excludeNames": [
      "mac.call",
      "mac.exec",
      "fs.list",
      "fs.write",
      "gh",
      "decideNext",
      "exploit",
      "confidenceScore",
      "confirm",
      "audit",
      "doctor",
      "status",
      "mac.read",
      "mac.write",
      "mac.search",
      "mac.list",
      "mac.port",
      "mac.process",
      "fs.read",
      "fs.search",
      "git.diff",
      "git.status",
      "stream.list",
      "stream.create",
      "checkFiles",
      "verify"
    ],
    "excludePrefixes": [
      "browser.",
      "linear.",
      "railway.",
      "sentry.",
      "task.",
      "website.",
      "mac.",
      "artifacts."
    ],
    "excludeCategories": [
      "browser",
      "linear",
      "railway",
      "sentry",
      "artifacts"
    ]
  }
} as const;

export type ManifestConfig = typeof manifestConfig;
