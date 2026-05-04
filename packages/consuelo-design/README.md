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

- `packages/consuelo-website/animations.md`
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

`generate ...` starts or reuses Open Design, creates a project with the right skill and Consuelo context, opens the project URL, and lets Ko and the agent iterate in the live preview workspace. It is not a prompt/spec-only command.

Use `--dry-run --json` to inspect the exact project plan without starting runtimes or creating projects.

## workflow commands

The facade names the live Open Design sessions we care about:

| command | primary skill | behavior |
| --- | --- | --- |
| `generate website` | `saas-landing` | Starts/reuses Open Design, creates a website project, attaches base design context plus website motion/agent context, and opens the project URL. |
| `generate demo` | `web-prototype` | Starts/reuses Open Design and opens a demo/prototype project. |
| `generate image-brief` | `image-poster` | Starts/reuses Open Design and opens an image/media ideation project. |
| `generate digital-eguide` | `digital-eguide` | Starts/reuses Open Design and opens a long-form e-guide project. |
| `generate email` | `email-marketing` | Starts/reuses Open Design and opens an email artifact project. |
| `generate motion-frame` | `motion-frames` | Starts/reuses Open Design, attaches motion context, and opens a motion-frame project. |
| `render hyperframes` | `hyperframes` | Starts/reuses Open Design, attaches motion context, and opens a HyperFrames render project. |

Use `--name` to set the Open Design project name and `--prompt` to attach Ko's brief to the pending prompt.

```bash
bun run consuelo-design generate website --name "Homepage hero" --prompt "Create a sharp hero for Consuelo voice AI"
```

## first run / UI

Use the Bun facade from repo root:

```bash
bun run consuelo-design check
bun run consuelo-design run
```

`run` starts the vendored Open Design daemon and web app in the foreground. Workflow commands use the background web runtime so they can create and open projects:

```bash
bun run consuelo-design generate website
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
