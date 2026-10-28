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

If an assigned environment, task-session route, provider authentication,
workspace-first route, GitHub path, or test lane fails, pause product
implementation and diagnose the failure through Consuelo OS.

A failed tool call is not a terminal blocker. Retry with corrected typed input,
inspect traces, and repair or realign the route when it is within the worker's
scope.

Return blocked only when:
- recovery requires human judgment,
- recovery would exceed the assigned ownership boundary,
- a required external credential or environment is unavailable, or
- the same failure remains after the prescribed recovery paths.

Record both the original failure and every recovery attempt on the PR.
Do not bypass the failed route with native git, unscoped shell, another
computer, provider substitution, or the legacy workspace connector.

Keep the task workpad current. Push an independently reviewable task PR only to the assigned stream. Request CodeRabbit. Render the committed Grok review template to `packages/os/.tmp-reviews/<task>/grok-prompt.md` inside the task worktree and invoke the existing wrapper with `bun run --cwd packages/os subagent -- --provider grok --model grok-4.5 --bundle core --policy read --instruction-path <task-worktree>/packages/os/.tmp-reviews/<task>/grok-prompt.md --cwd <task-worktree> --task-session <task-session> --timeout-ms 900000 --output-format json --workspace-only preferred`. The wrapper maps read policy to Grok `--permission-mode auto`, bounds the run, disables memory/subagents, and denies built-in edit, write, and shell tools while leaving workspace MCP reads available. Cancelled, incomplete, and empty Grok runs fail closed. Post the structured review, each new inline finding, and the top-level summary to GitHub. Verify every finding, fix valid findings, rerun validation, and post dispositions. GitHub is the durable source of truth; remove `packages/os/.tmp-reviews/<task>/` after posting. Do not create another product review tool.

Merge the task PR into its assigned stream, do not promote the stream to main,
do not start downstream workers, and do not broaden scope. Return only after
every acceptance criterion is complete and every substantive result is recorded
on GitHub.

Your user-facing closeout must be concise but informative. Include:

1. the task PR URL and assigned stream;
2. exactly what changed;
3. tests, CI, CodeRabbit, Grok, and finding dispositions;
4. how this work advances the larger foundation plan; and
5. remaining blockers, risks, or downstream integration work.

Do not reply with only `done`. That short closeout is reserved for a standalone
Grok review task after its structured review is already durable on GitHub.
```

## Orchestrator closeout

For each worker, independently verify the PR against the master plan and brief,
then merge the task into its stream only when green. Do not dispatch a dependent
worker until its prerequisite PR is merged into the relevant stream. Promote a
stream to `main` when another stream must consume the shared contract.
