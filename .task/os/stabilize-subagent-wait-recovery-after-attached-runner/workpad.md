# stabilize subagent wait recovery after attached runner

pr: 2317

Revert runner process.exit (it raced tests). Wait for the owned exit marker before injecting completion_unknown. Surface grok failure status in the assertion.

36 pass locally.

- 2026-08-30 20:39:49 write: `.task/os/stabilize-subagent-wait-recovery-after-attached-runner/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 20:39:49 fs.write: `.task/os/stabilize-subagent-wait-recovery-after-attached-runner/workpad.md`
