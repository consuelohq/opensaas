# document swamp application integration

branch: `task/documentation/document-swamp-application-integration`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2555/document-swamp-application-integration
github pr: https://github.com/consuelohq/opensaas/pull/2555
started: 2026-09-23

## acceptance criteria

- [x] Add exactly one product documentation file under `Connect > Applications` for Swamp.
- [x] Follow the saved technical-writing guidance: product-first, short, concrete, direct, customer language before implementation detail, and no hype or false shipped-state claims.
- [x] Document the shipped native discovery path for existing Swamp models and workflows.
- [x] Keep the current OS support boundary explicit: discovery requires the local Swamp CLI and a workspace containing `.swamp.yaml`.
- [x] Validate the page with the Connect documentation contract, documentation validator, and a production build.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Complete. Added the Swamp application page only; no navigation, component, styling, runtime, or test source was changed.

## files changed

- `packages/documentation/src/content/docs/connect/apps-and-services/swamp.mdx`


## workspace-owned: files changed

- `packages/documentation/src/content/docs/connect/apps-and-services/swamp.mdx`

## workspace-owned: activity log

- 2026-09-23 01:41:37 fs.write: `.task/documentation/document-swamp-application-integration/workpad.md`
- 2026-09-23 01:42:03 fs.write: `packages/documentation/src/content/docs/connect/apps-and-services/swamp.mdx`
- 2026-09-23 01:46:45 fs.write: `packages/documentation/src/content/docs/connect/apps-and-services/swamp.mdx`

## workspace-owned: validation evidence

- `cd packages/os && bun run test -- tests/runtime-tool-providers-swamp.test.ts`: passed — 10/10 Swamp runtime-provider tests.
- `bun run test:connect && bun run validate`: passed — 8/8 Connect tests, 520 expectations, 105 selected documentation pages.
- `bun run build`: passed — Astro production build generated `/connect/apps-and-services/swamp/` and indexed 121 HTML files.
- 2026-09-23 01:44:57 `review.run`: passed — OK
- 2026-09-23 01:44:58 `review.run`: passed — OK

## key decisions

- Keep Swamp as the execution engine; document Consuelo as the discovery, typed-tool, authorization, and approval layer.
- Document the runtime provider as available because it is already present on current main and covered by the Swamp runtime-provider tests.
- Honor the user's one-file product scope; do not edit the Applications index or sidebar navigation in this task.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: A single new Connect > Applications page documents how Consuelo can discover and expose an existing Swamp installation without claiming the native adapter already ships.
existing local pattern: Provider application pages use frontmatter, an explicit native-tool/available-today status block, a short customer-first explanation, an Ask your agent prompt, setup/verification guidance, safety boundaries, and official documentation links.
new or changed tests: No new test file. This is a content-only page and the user explicitly requested one application file; existing documentation validation/build contracts are the appropriate coverage.
focused red command: no-test waiver
expected red failure: not applicable
no-test waiver: Content-only documentation addition with no runtime, navigation, component, or styling behavior change. Validate the MDX and documentation package after writing.

- 2026-09-23 01:41:37 append: `.task/documentation/document-swamp-application-integration/workpad.md`

- 2026-09-23 01:42:03 write: `packages/documentation/src/content/docs/connect/apps-and-services/swamp.mdx`

## workspace-owned: files read

- `packages/documentation/package.json`
- `packages/documentation/src/content/docs/connect/apps-and-services/swamp.mdx`
- `packages/os/package.json`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/runtime-tool-registry.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`

- 2026-09-23 01:47:27 apply-patch: `.task/documentation/document-swamp-application-integration/workpad.md`