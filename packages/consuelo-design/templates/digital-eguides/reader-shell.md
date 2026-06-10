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
- Agents fill typed JSON/content input. The renderer owns layout, typography, scroll behavior, navigation, checklist rendering, optional components, mobile behavior, text-selection copy, find-next support, and task-block Markdown copy. First-class rich components are `callout`, `metrics`, `flow`, `table`, `timeline`, `details`, `ranges`, `comparisons`, `cards`, `ledger`, `taskLedger`, and `openQuestions`.
- The reader shell tracks the roadmap mobile baseline: compact serif title scale, orange thesis treatment, right-side `Task` pill, GSAP tap-to-scroll, auto-dismissing resume chip, circular back-to-top progress, flattened card-only sections, and side line navigation.
- The reader nav gives the artifact title the flexible left column. Section links are grouped near the `Task` pill instead of taking title space.
- The right-side section rail is generated from every top-level section, typed component, and task ledger. It uses line indicators on desktop/web and opens a full-height scrollable section drawer on mobile; drawer rows display the section titles and jump to those anchors.
- Single-component sections and typed components should render flat, so tables, flow modules, callouts, and cards do not sit inside extra framed wrappers.
- The shell includes left and right side tap zones for roadmap-style incremental scroll: left steps up, right steps down.
- Task/checklist groups render a small copy button. The copied payload is Markdown with the group title, optional tag, and checklist items, so agents can transfer the exact task block to another context.
- Browser search and text transfer are shell-owned behaviors: selected text is copied automatically, and Enter advances to the next matching occurrence when the page can infer the selected search term.
