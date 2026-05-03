# consuelo-design

`consuelo-design` is Consuelo's internal design tooling package.

It vendors [nexu-io/open-design](https://github.com/nexu-io/open-design) under:

```text
packages/consuelo-design/upstream/open-design
```

The package exposes a Consuelo-specific facade so agents and scripts can use Open Design without coupling product code to upstream internals.

## design system

Consuelo's design system comes from our repo docs:

- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/animations.md`
- `packages/consuelo-website/AGENTS.md`
- `packages/consuelo-design/AGENTS.md`

Open Design's upstream `design-systems/` directory is vendored reference material. It is not the Consuelo design system for this first integration.

## commands

```bash
yarn workspace consuelo-design get-design-system
yarn workspace consuelo-design get-design-system -- --json
yarn workspace consuelo-design workflows
yarn workspace consuelo-design upstream:status
yarn workspace consuelo-design railway:check
yarn workspace consuelo-design check
```

## facade use cases

The facade names the workflows we care about:

| workflow | purpose |
| --- | --- |
| `website` | Generate or evaluate website design work against Consuelo's design system. |
| `demo` | Shape demo assets and prototype briefs. |
| `image` | Prepare image-generation briefs grounded in Consuelo design rules. |
| `digital-eguide` | Prepare long-form e-guide artifacts. |
| `email` | Prepare email design/content artifacts. |
| `motion-frame` | Prepare motion frame briefs and future HyperFrames/GSAP handoff material. |

These workflows are descriptors in this first package pass. Generation behavior should be added behind the facade as use cases become concrete.

## upstream usage

Open Design expects Node `~24` and pnpm `>=10.33.2 <11`. Run upstream commands inside the upstream folder when intentionally testing Open Design itself:

```bash
cd packages/consuelo-design/upstream/open-design
pnpm install
pnpm tools-dev
```

Generated runtime state belongs in `.od/`, `out/`, or `artifacts/`; those are ignored by this package.

## Railway

`consuelo-design` is tooling-only. It should stay outside Railway app and worker dependency graphs. Run:

```bash
yarn workspace consuelo-design railway:check
```

before review when changing dependencies or Dockerfiles.
