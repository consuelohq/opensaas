# reader shell

Canonical reader-shell behavior is implemented in TypeScript, not in this Markdown file.

Source of truth:

```text
packages/consuelo-design/scripts/render-consuelo-reader.ts
```

Use the renderer through the repo scripts:

```bash
bun run wiki:render -- --template <spec|plan|guide> --input <content.json> --out <index.html>
bun run wiki:validate -- --input <index.html>
```

Rules:

- Do not freehand reader-shell HTML from this Markdown file.
- Do not create another reader shell or a roadmap-specific shell.
- Roadmaps are `plan` documents.
- `spec`, `plan`, and `guide` use the TypeScript reader shell.
- `uncategorized` artifacts do not use the reader shell automatically.
- Agents fill typed JSON/content input. The renderer owns layout, typography, scroll behavior, navigation, checklist rendering, optional components, and mobile behavior. First-class rich components are `callout`, `metrics`, `flow`, `table`, `timeline`, `details`, `ranges`, `comparisons`, `cards`, and `ledger`.
- The reader shell tracks the roadmap mobile baseline: compact serif title scale, orange thesis treatment, right-side `Task` pill, GSAP tap-to-scroll, auto-dismissing resume chip, circular back-to-top progress, and flattened card-only sections.
- The reader nav gives the artifact title the flexible left column. Section links are grouped near the `Task` pill instead of taking title space.
- Single-component sections and typed components should render flat, so tables, flow modules, callouts, and cards do not sit inside extra framed wrappers.
- The shell includes left and right side tap zones for roadmap-style incremental scroll: left steps up, right steps down.
