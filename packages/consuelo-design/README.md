# consuelo-design

`consuelo-design` is Consuelo's internal Bun-first design tooling package.

It vendors [nexu-io/open-design](https://github.com/nexu-io/open-design) under:

```text
packages/consuelo-design/upstream/open-design
```

The package exposes a Consuelo-specific facade so agents and scripts can use Open Design without coupling product code to upstream internals.

## design system

Consuelo's base design system comes from our repo docs:

- `packages/consuelo-website/DESIGN.md`
- `areas/consuelo-design/AGENTS.md`

Website-specific sessions also attach:

- `areas/website/animations.md`
- `areas/website/AGENTS.md`

Open Design's upstream `design-systems/` directory is vendored reference material. It is not Consuelo truth unless Ko explicitly asks for a reference skin.

## commands

Run from repo root. These are Bun-first operator commands.

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

`generate ...` returns a headless work order by default. The work order includes Ko's brief, selected template, reader shell, and Consuelo design context. The agent then creates or edits local artifact source directly, validates it, and publishes with `design.publish`. Use `--live` only when Ko explicitly wants the old headed Open Design UI session.

Use `--dry-run --json` to inspect the work order without writing it to disk. Use `--live --dry-run --json` to inspect the headed UI-session plan.

## workflow commands

The facade names the artifact workflows we care about:

| command | primary skill | behavior |
| --- | --- | --- |
| `generate website` | `saas-landing` | Creates a headless website work order with base design context plus website motion/agent context. |
| `generate demo` | `web-prototype` | Creates a headless work order for a demo/prototype project. |
| `generate image-brief` | `image-poster` | Creates a headless work order for an image/media ideation project. |
| `generate digital-eguide` | `digital-eguide` | Creates a headless work order for a long-form e-guide project. |
| `generate email` | `email-marketing` | Creates a headless work order for an email artifact project. |
| `generate motion-frame` | `motion-frames` | Creates a headless motion-frame work order with motion context. |
| `render hyperframes` | `hyperframes` | Creates a headless HyperFrames render work order with motion context. |

Use `--name` to set the artifact/work-order name, `--prompt` to attach Ko's brief to the generated work order, and `--template <research|spec|plan>` with `generate digital-eguide` when the e-guide type is known.

```bash
bun run consuelo-design generate digital-eguide --template spec --name "Workspace agent spec" --prompt "Create a rich HTML spec for ..."
```

Digital e-guide templates live in `packages/consuelo-design/templates/digital-eguides/`:

- `research` for research lessons, source-grounded explainers, paper walkthroughs, and daily deep ideas.
- `spec` for product specs, engineering specs, RFCs, design docs, and architecture proposals. Decisions are baked into the spec.
- `plan` for execution plans, implementation plans, rollout plans, and operating plans. Decisions are an ongoing section inside the plan.

The command returns a headless work order by default. The template shapes the local artifact the agent should create/edit directly. Use `--live` only when Ko explicitly wants a headed Open Design UI session.

## first run / UI

Use the Bun facade from repo root:

```bash
bun run consuelo-design check
bun run consuelo-design run
```

`run` starts the vendored Open Design daemon and web app in the foreground. Use `--live` when a workflow should create/open a headed Open Design project:

```bash
bun run consuelo-design generate website --live
bun run consuelo-design ui:status
bun run consuelo-design ui:logs
bun run consuelo-design ui:stop
```

The facade may invoke `corepack pnpm ...` inside `packages/consuelo-design/upstream/open-design` because upstream Open Design pins pnpm. Do not call pnpm directly from Consuelo workflow scripts unless you are intentionally debugging upstream internals.

## upstream usage

Open Design expects Node `~24` and pnpm `>=10.33.2 <11`, but that pnpm usage is isolated behind the Bun facade. Run upstream commands inside the upstream folder when intentionally testing Open Design itself:

```bash
cd packages/consuelo-design/upstream/open-design
pnpm install
pnpm tools-dev
```

Generated runtime state belongs in `.od/`, `out/`, or `artifacts/`; those are ignored by this package.

## Railway

`consuelo-design` is tooling-only. It should stay outside Railway app and worker dependency graphs. `bun run consuelo-design check` includes the Railway exclusion guard before review when changing dependencies or Dockerfiles.


## Consuelo Wiki archive

Every `design.publish` call records the published artifact in the private Consuelo Wiki. Pass `--name` for the human-readable artifact title and `--template <research|spec|plan>` when the artifact is a templated e-guide so the Consuelo Wiki can filter it correctly. Artifacts under `/website/...` also appear under the top-level Website filter. The Consuelo Wiki is automatically regenerated and published at `/design-wiki`, sorted by `updatedAt` so republished artifacts return to the top.

`design.publish` returns and records both HTTPS Serve URLs and direct tailnet HTTP URLs. The Consuelo Wiki links prefer the direct tailnet HTTP URL so mobile reading does not depend on iOS accepting the HTTPS Serve path.

The publish path is durable. `design.publish` materializes local file or directory targets under the Open Design archive before registering the route, then points Tailscale Serve at the managed archive server. This avoids macOS path-serving restrictions and avoids per-artifact temporary servers. The Consuelo Wiki and every archived artifact are served by the same tailnet archive server.

## Headless artifact execution

`generate ...` commands default to a headless work order. The generated prompt is a spec for the agent, not a message to send into Open Design chat. The agent should read `packages/consuelo-website/DESIGN.md`, read the selected template, create/edit local artifact source, validate with browser tools, then publish with `design.publish`. Use `--live` only when Ko explicitly wants a headed Open Design UI/operator session.
