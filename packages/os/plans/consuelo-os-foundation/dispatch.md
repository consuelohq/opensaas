# Consuelo OS foundation dispatch

Updated: 2026-07-22

## Current gate

The clean-host environment harness and probe cleanup are on `main` at
`92fdaf6129a644b02d5baff5a1884189527171c1`. Worker 01 is complete.

Do not dispatch Worker 27. Its review procedure is already available through
`packages/os/scripts/subagent.ts` and is part of every worker's closeout. After
this tracked plan reaches `main`, sync each target stream and begin Wave 0.

## Wave 0 parallel dispatch

After this plan is on `main`, dispatch these five fresh workers in parallel:

- `workers/02-runtime-bundle-builder.md`
- `workers/13-web-auth-contract.md`
- `workers/18-native-platform-spike.md`
- `workers/26-tool-package-layout.md`
- `workers/28-repository-product-boundary-audit.md`

Worker 01 is not dispatched again. Worker 13 is limited to the read/test-first
contract in its brief. Worker 18 is a bounded research/prototype task. Worker
28 is read-only planning. Workers 02 and 26 have disjoint ownership and must not
edit shared/root package-script wiring; Worker 24 owns that later integration.

## Copy/paste prompt

Replace `<BRIEF_FILE>` with exactly one filename from the lists above and send
this prompt to one fresh worker task. Do not send multiple briefs to one worker.

```text
You are one worker in the Consuelo OS foundation program.

Before doing any work, bootstrap exactly once with os.get_steering() and read its full response. Then read these local files in full:

1. packages/os/plans/consuelo-os-foundation/plan.md
2. packages/os/plans/consuelo-os-foundation/environment-registry.md
3. packages/os/plans/consuelo-os-foundation/workers/<BRIEF_FILE>
4. packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md

Follow the assigned brief exactly. Start from fresh local main. Use Consuelo OS and os.call for repository and task work, create or recover the exact task session from the stream named by the brief, and pass taskSession on every task-scoped call. Do not use the old workspace connector, another computer, native git, or unscoped shell as a silent fallback.

Use TDD: write failing behavioral tests first, then implement. Preserve existing regression contracts unless the brief explicitly approves a behavior change. Use only the environment lane assigned by the plan and registry. Never install, update, reset, restart, or uninstall Consuelo OS on Ko's Mac Mini or MacBook Air; stop at a human checkpoint with the exact command and expected result.

If the assigned environment, OS task session, provider/model authentication, workspace-first route, GitHub posting path, or test lane fails, is unavailable, or differs from the registry, stop. Put the exact failure on the PR and fix or realign the environment before continuing. Do not bypass it, use another computer, silently change providers, or treat partial results as proof.

Keep the task workpad current. Push an independently reviewable task PR only to the assigned stream. Request CodeRabbit. Render the committed Grok review template to `packages/os/.tmp-reviews/<task>/grok-prompt.md` inside the task worktree and invoke the existing wrapper with `bun run --cwd packages/os subagent -- --provider grok --model grok-4.5 --bundle core --policy read --instruction-path <task-worktree>/packages/os/.tmp-reviews/<task>/grok-prompt.md --cwd <task-worktree> --task-session <task-session> --timeout-ms 900000 --output-format json --workspace-only preferred`. The wrapper maps read policy to Grok `--permission-mode plan`, bounds the run, disables memory/subagents, and requires workspace-first operation with any raw-shell fallback reported. Post the structured review, each new inline finding, and the top-level summary to GitHub. Verify every finding, fix valid findings, rerun validation, and post dispositions. GitHub is the durable source of truth; remove `packages/os/.tmp-reviews/<task>/` after posting. Do not create another product review tool.

Do not merge the task PR, promote the stream, start downstream workers, or broaden scope. Return only after every acceptance criterion is complete and every substantive result is recorded on GitHub. In chat, respond with only `done` and the PR URL.
```

## Orchestrator closeout

For each worker, independently verify the PR against the master plan and brief,
then merge the task into its stream only when green. Do not dispatch a dependent
worker until its prerequisite PR is merged into the relevant stream. Promote a
stream to `main` when another stream must consume the shared contract.
