# Fix wiki render protocol root command

branch: `task/design/fix-wiki-render-protocol-root-command`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/664/fix-wiki-render-protocol-root-command
github pr: https://github.com/consuelohq/opensaas/pull/664
started: 2026-05-31

## acceptance criteria

- [x] Add repo-root `wiki:render` script so the render protocol works from the repository root.
- [x] Add repo-root `wiki:validate` script so validation also works from the repository root.
- [x] Add repo-root `test:reader` script for the existing reader tests.
- [x] Update `spec.md` and `research.md` to explicitly state the commands run from the repository root.
- [x] Validate exact root command flow: render, validate, and reader tests.

## plan

1. Read design workflow docs, root package scripts, package-local scripts, and template protocol.
2. Add root package scripts that forward to `packages/consuelo-design`.
3. Patch the protocol docs to make repo-root invocation explicit.
4. Run root-level render/validate/test commands.
5. Run full verify and push.

## current status

- Fix implemented and root commands validated. Ready for verify / push.

## files changed

- `.task/design/fix-wiki-render-protocol-root-command/current.json`
- `.task/design/fix-wiki-render-protocol-root-command/evidence-log.json`
- `.task/design/fix-wiki-render-protocol-root-command/read-log.json`
- `.task/design/fix-wiki-render-protocol-root-command/session.json`
- `.task/design/fix-wiki-render-protocol-root-command/workpad.md`
- `.task/tasks/design/fix-wiki-render-protocol-root-command.json`
- `package.json`
- `packages/consuelo-design/templates/digital-eguides/research.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

## workspace-owned: files changed

- `.task/design/fix-wiki-render-protocol-root-command/current.json`
- `.task/design/fix-wiki-render-protocol-root-command/evidence-log.json`
- `.task/design/fix-wiki-render-protocol-root-command/read-log.json`
- `.task/design/fix-wiki-render-protocol-root-command/session.json`
- `.task/design/fix-wiki-render-protocol-root-command/workpad.md`
- `.task/tasks/design/fix-wiki-render-protocol-root-command.json`
- `package.json`
- `packages/consuelo-design/templates/digital-eguides/research.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

## workspace-owned: activity log

- 2026-05-31 11:37:30 fs.write: `.task/design/fix-wiki-render-protocol-root-command/workpad.md`
- 2026-05-31: Added root `wiki:render`, `wiki:validate`, and `test:reader` scripts.
- 2026-05-31: Initial `bun --cwd ... run ...` forwarding looked successful but only printed Bun help and did not create output; fixed by using `bun run --cwd packages/consuelo-design ...` form.
- 2026-05-31: Started task from `stream/design` for Codex P2 fix.
- 2026-05-31: Updated spec and research render protocols to say commands run from the repo root.
- 2026-05-31: Validated root render and validate commands create shell HTML and pass validation.

## workspace-owned: validation evidence

- `bun run test:reader` from repo root passed: 3 tests, 25 assertions.
- `bun run wiki:render -- --template spec --input <content.json> --out <index.html>` from repo root passed and produced `window.__readerShell` HTML.
- `bun run wiki:validate -- --input <index.html>` from repo root passed with `missing: []`.

## key decisions

- Use root scripts instead of telling agents to `cd packages/consuelo-design`.
- Use `bun run --cwd packages/consuelo-design <script>` because `bun --cwd packages/consuelo-design run <script>` printed help and failed to render while exiting 0.

## notes for ko

- Codex was correct. The protocol now matches the design workflow expectation that operators start from the repo root.

## improvements noticed

- Add regression coverage later for root script forwarding specifically; the existing reader unit tests verify renderer behavior but not root package forwarding.

## issues and recovery

- First root-script attempt used `bun --cwd packages/consuelo-design run ...`; it exited 0 but printed Bun help and did not create output. Recovered by testing variants and switching to `bun run --cwd packages/consuelo-design ...`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(design): expose wiki render at repo root" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `package.json`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/templates/digital-eguides/research.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

- 2026-05-31 11:37:30 write: `.task/design/fix-wiki-render-protocol-root-command/workpad.md`
