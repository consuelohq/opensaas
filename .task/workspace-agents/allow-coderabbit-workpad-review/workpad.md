# allow coderabbit workpad review

## acceptance criteria

- [x] Update `.coderabbit.yaml` so CodeRabbit keeps ignoring `.task` metadata by default.
- [x] Re-include only `.task/**/workpad.md` so task workpads are visible to review.
- [x] Validate the YAML shape and the path filter intent.
- [ ] Inspect diff and push the task PR.

## plan

1. Inspect existing CodeRabbit config.
2. Add a re-include pattern for task workpads after the broad `.task` exclusion.
3. Validate YAML shape and path-matching intent.
4. Push the task branch for review.

## notes

Started from `main` to keep this unrelated CodeRabbit config patch isolated from stream work.

Validation passed with ordered path-filter simulation:

- `.task/**/workpad.md` is included.
- `.task/**/current.json`, `.task/**/session.json`, `.task/**/verify.json`, and `.task/tasks/**/*.json` stay excluded.

The Python environment did not have PyYAML installed, so validation used exact file shape plus path-filter simulation instead of importing `yaml`.

- 2026-07-04 17:34:50 write: `.task/workspace-agents/allow-coderabbit-workpad-review/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-04 17:34:50 fs.write: `.task/workspace-agents/allow-coderabbit-workpad-review/workpad.md`

## workspace-owned: validation evidence

- 2026-07-04 17:37:54 `review.run`: passed — OK
- 2026-07-04 17:37:55 `review.run`: passed — OK
