# AGENTS.md — consuelo-design

`consuelo-design` is Consuelo's Bun-first design tooling facade over the vendored Open Design project. It is a tooling package, not a deployed product package.

## core decisions

- The canonical Consuelo facade lives in `packages/workspace/scripts/consuelo-design.ts`.
- The package-local script at `packages/consuelo-design/scripts/consuelo-design.ts` is only a thin Bun passthrough.
- Human commands start from the repo root with `bun run consuelo-design ...`.
- Tool calls go through the typed workspace facade as `workspace consueloDesign.*`.
- Open Design upstream remains vendored at `packages/consuelo-design/upstream/open-design`.
- `pnpm` is not a Consuelo-facing workflow tool. It is used only behind the Bun facade because upstream Open Design pins `pnpm@10.33.2`.
- `generate <workflow>` means start/create/open a live Open Design working session. It must not degrade into a dead-end prompt/spec generator.
- Open Design bundled design systems are reference skins only. Consuelo truth comes from our repo.
- `consuelo-design` must remain outside Railway deployment graphs.

## source of truth for design context

Base Consuelo design system context is exactly:

- `packages/consuelo-website/DESIGN.md`
- `areas/consuelo-design/AGENTS.md`

`get-design-system` must return only those files.

Website-specific context is attached only when starting website or motion-oriented sessions:

- `packages/consuelo-website/animations.md`
- `areas/website/AGENTS.md`

Do not include `animations.md` or website `AGENTS.md` in base `get-design-system`. They are workflow context, not global design-system truth.

## Open Design mental model

Open Design is a live design workspace, not a static prompt generator.

The loop is:

```text
start Open Design
  -> browser UI opens
  -> pick/use skill
  -> pick/use design system context
  -> create project/session
  -> agent works in the project folder
  -> artifact renders live
  -> Ko and the agent iterate together
```

The Consuelo facade should preserve that loop. If a command says `generate website`, it should start or reuse Open Design, create/open a project, attach the right Consuelo prompt context, and take Ko to the working session.

## operator commands

Use these from the repo root:

```bash
bun run consuelo-design run
bun run consuelo-design generate website
bun run consuelo-design generate demo
bun run consuelo-design generate image-brief
bun run consuelo-design generate digital-eguide
bun run consuelo-design generate email
bun run consuelo-design generate motion-frame
bun run consuelo-design render hyperframes
bun run consuelo-design list-skills
bun run consuelo-design list-design-systems
bun run consuelo-design check
```

`run` starts the Open Design UI in the foreground. `generate ...` and `render hyperframes` should be smart enough to start the background web runtime and open the correct project URL.

## typed tool facade

Every important operator command must have a typed workspace tool entry.

Expected tool names:

```text
consueloDesign.run
consueloDesign.getDesignSystem
consueloDesign.listSkills
consueloDesign.listDesignSystems
consueloDesign.check
consueloDesign.railwayCheck
consueloDesign.generateWebsite
consueloDesign.generateDemo
consueloDesign.generateImageBrief
consueloDesign.generateDigitalEguide
consueloDesign.generateEmail
consueloDesign.generateMotionFrame
consueloDesign.renderHyperframes
consueloDesign.uiStatus
consueloDesign.uiLogs
consueloDesign.uiStop
consueloDesign.odBuild
```

When adding commands, update:

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- generated `packages/workspace/TOOLS.md`
- generated `packages/workspace/src/generated/workspace.d.ts`

Then run `bun run --cwd packages/workspace generate-docs` and `bun run --cwd packages/workspace generate-types`.

## workflow mapping

Use this mapping unless Ko changes it:

| Consuelo command | Primary Open Design skill | Notes |
| --- | --- | --- |
| `generate website` | `saas-landing` | Include `DESIGN.md`, `consuelo-design/AGENTS.md`, website `animations.md`, and website `AGENTS.md`. |
| `generate demo` | `web-prototype` | Use base Consuelo design context. |
| `generate image-brief` | `image-poster` | Use image/media surfaces when available; fall back to magazine/social/video prototype skills. |
| `generate digital-eguide` | `digital-eguide` | Use base Consuelo design context. |
| `generate email` | `email-marketing` | Use base Consuelo design context. |
| `generate motion-frame` | `motion-frames` | Include motion/website context. |
| `render hyperframes` | `hyperframes` | Include motion/website context and prepare for HTML-to-MP4 work. |

## Railway boundary

No Railway-deployed package should depend on `consuelo-design`.

`bun run consuelo-design check` should include Railway exclusion. `railway:check` may exist as a lower-level command, but it is not a normal design operator command.

Keep `packages/consuelo-design` absent from Railway Dockerfile COPY lists unless Ko explicitly approves a deployment boundary change.

## upstream boundary

Do not edit vendored Open Design internals to encode Consuelo-specific behavior unless the task explicitly says to patch upstream behavior. Put Consuelo behavior in the facade.

Generated Open Design state belongs under ignored runtime paths such as `.od/`, `out/`, or `artifacts/`.

## validation

For facade changes, run at minimum:

```bash
bun run consuelo-design check
bun run consuelo-design list-skills --json
bun run consuelo-design list-design-systems --json
bun run consuelo-design generate website --dry-run --json
bun run consuelo-design render hyperframes --dry-run --json
bun run --cwd packages/workspace workspace consueloDesign.generateWebsite '{"dryRun":true}'
bun run --cwd packages/workspace generate-docs
bun run --cwd packages/workspace generate-types
```

Also run branch-local review before publishing.
