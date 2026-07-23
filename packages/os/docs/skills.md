# OS skills

Consuelo OS skills are instruction resources under `packages/os/skills/`. Callable tools are separate: they are defined by canonical TypeScript packages under `packages/os/tools/<domain>/` and published through `packages/os/manifests/generated/tool.manifest.json`.

Skill metadata is generated into `packages/os/skills/skills.json`. A skill may route users toward one or more callable tools without creating a same-named legacy action.

The Artifacts skill uses the canonical `scripts/artifacts.ts` CLI and the `artifacts.*` tool family. Task, research, media, sites, and other skills similarly load instructions while typed tool execution remains manifest-driven.
