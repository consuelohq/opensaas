# Add background computer use with headless Dia

branch: `task/os-computer-use/add-background-computer-use-with-headless-dia`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2812
started: 2026-11-18

## acceptance criteria

- [x] One core computer.use tool with background desktop controls and headless Dia when installed.
- [x] Headed opt-in, named OS-managed profiles, compact steering, short Senior Engineer guidance.
- [x] Browser and native provider checks on macOS, private trace handling, and typed lock failure handling.
- [x] Publish independently reviewable changes against current main and preserve shared stream work.

## plan

1. Carry the verified feature onto current main, retain current tracing and steering contracts, exercise the real installed providers, and publish through the managed stream.

## files changed

- none yet

## key decisions

- Dedicated Dia profile for headless browsing. Chromium retained a synthetic sign-in across headed-to-headless restart. Dia lost the cookie after restart. The regular personal browser profile is untouched.
- The focused stream starts at current main. A single OS-only executable adapts Dia's nested profile layout. Confirm its executable mode in the remote tree.

## notes for ko

- Agent Desktop 1.3.1 installed and tested on the Mac. The PR pins Agent Browser 0.43.0. OS steering exposes the tool upon runtime release.

## improvements noticed

- none yet

## errors i ran into

- The existing stream PR #2656 has unrelated conflicts with main. The managed focused stream provides a separate main-based review. The first focused run caught missing implementation and exposed UI content in Trace. The green OS-package run passed 50 tests, including the typed lock failure. Both real providers passed, including Dia open, snapshot, fill, click and screenshot on a temporary local fixture.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: expose computer.use as one core tool and preserve current-main transport, trace privacy and routing. Dia runs in a dedicated headless session by default. Chromium supports sign-in across restarts.
existing local pattern: OS facade, utilities tool contribution, Effect-based provider process and resource lock.
new or changed tests: computer-use.test.ts, computer-use-trace.test.ts, steering visibility, core registry, layout and script parity.
focused red command: bun x vitest run packages/os/tests/computer-use.test.ts packages/os/tests/computer-use-trace.test.ts
expected red failure: current main lacks the new handler, schema, trace boundaries and command builder.
no-test waiver: not applicable. Implementation PR #2811 already has native provider smoke and full regression proof. This focused publication rebases the feature on main because shared PR #2656 predates unrelated conflicts.

- 2026-11-18 22:16:13 append: `.task/os-computer-use/add-background-computer-use-with-headless-dia/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 22:16:13 fs.write: `.task/os-computer-use/add-background-computer-use-with-headless-dia/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 22:18:10 `review.run`: passed — OK
- 2026-11-18 22:22:08 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
