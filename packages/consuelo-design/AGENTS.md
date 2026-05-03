# AGENTS.md — consuelo-design

`consuelo-design` is a tooling package, not a deployed product package.

## design system source of truth

Use Consuelo's own design context:

- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/animations.md`
- `packages/consuelo-website/AGENTS.md`
- `packages/consuelo-design/AGENTS.md`

Do not import Open Design's upstream `design-systems/` directory as the Consuelo design system. That directory is vendored reference material.

## Open Design boundary

The upstream project lives at:

```text
packages/consuelo-design/upstream/open-design
```

Treat it as vendored third-party source. Keep local Open Design runtime state out of git.

## command surface

Use the Consuelo facade first:

```bash
bun run consuelo-design get-design-system
bun run consuelo-design workflows
bun run consuelo-design upstream-status
bun run consuelo-design railway:check
```

The Bun facade in `packages/workspace/scripts/consuelo-design.ts` should speak in Consuelo use cases: website, demo, image, digital e-guide, email, and motion-frame.

## Railway boundary

No Railway-deployed package should depend on `consuelo-design`. Keep Dockerfile COPY lists unchanged unless Ko explicitly approves a deployment boundary change.
