# Worker 27: Existing Grok 4.5 Review Procedure

Status: procedure integrated. Do not dispatch Worker 27 as a separate implementation task.

## Mandatory context

Every implementation worker bootstraps exactly once with `os.get_steering()`, then reads `packages/os/plans/consuelo-os-foundation/plan.md`, its assigned brief, and `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md` in full. All task work uses `os.call` with the task session from the assigned stream.

## Mission

Use the existing OS subagent wrapper to run an independent, read-only Grok 4.5 teammate review for every implementation PR. Do not create a new product review tool, MCP method, or durable local review subsystem for this initiative.

## Existing execution surface

The implementation already exists at `packages/os/scripts/subagent.ts` and is exposed by the OS package's `subagent` Bun script. It accepts the provider, model, read policy, instruction path, working directory, task session, timeout, output format, and workspace-first routing required here. Read policy maps to Grok `--permission-mode auto`, uses bounded turns, disables memory and subagents, and denies built-in edit, write, and shell tools while keeping workspace MCP reads available. Cancelled, incomplete, and empty Grok runs fail closed.

For each task, the implementation worker:

1. Creates `packages/os/.tmp-reviews/<task>/grok-prompt.md` inside the task worktree by rendering `grok-review-template.md` with the PR, plan, brief, diff, validation, existing comments, CI, and relevant repo context. This directory is ignored by Git and satisfies the subagent's repo/worktree instruction-path boundary.
2. Runs the existing wrapper from the repository root:

   ```bash
   bun run --cwd packages/os subagent -- \
     --provider grok \
     --model grok-4.5 \
     --bundle core \
     --policy read \
     --instruction-path <task-worktree>/packages/os/.tmp-reviews/<task>/grok-prompt.md \
     --cwd <absolute-task-worktree> \
     --task-session <task-session> \
     --timeout-ms 900000 \
     --output-format json \
     --workspace-only preferred
   ```

3. Parses the structured review object. Grok remains read-only and does not merge or edit code.
4. Posts every new inline finding, the structured review object, the concise top-level summary, and the consolidated agent-fix prompt to the task PR on GitHub.
5. Verifies findings against the current head, fixes valid issues, records stale/skipped reasons on GitHub, reruns validation, and requests a new review when code changed materially.
6. Removes `packages/os/.tmp-reviews/<task>/` after the GitHub record is complete. GitHub is the durable source of truth; generated local review artifacts are not release evidence.

## Environment stop rule

If the OS task session, Grok authentication, `grok-4.5` model, subagent wrapper, workspace-first route, GitHub posting path, or assigned test environment fails, is unavailable, or does not match the registry, stop the task and report the exact failure on the PR. Fix or realign the environment before implementation continues. Do not bypass the environment, switch computers, silently fall back to another provider, or declare review complete from partial output.

## Review contract

The prompt must include and Grok must inspect:

- PR title, number, author, base/head, state, size, and URL;
- the full final master plan and exact assigned worker brief;
- current diff plus relevant surrounding implementation and tests;
- existing PR comments/review threads so findings are not duplicated;
- focused tests, broader checks, CI status, workspace review output, and known gaps;
- task, stream, and Linear context when available;
- nearby Consuelo patterns needed to judge architecture fit.

The output follows the complete schema and severity/category rules in `grok-review-template.md`. Findings are limited to high-signal merge risks. Every finding includes a GitHub-ready inline comment and an agent-fix prompt.

## CodeRabbit contract

- Request CodeRabbit when available and read existing comments before adding findings.
- A rate limit or outage is recorded on GitHub but does not skip Grok review.
- Verify every CodeRabbit and Grok finding against the latest commit.
- Neither reviewer is authorized to merge.

## Tests and validation

- `grok models` must list `grok-4.5` as available before review; model fallback warnings fail the smoke.
- The plan validator proves the review template contains the structured schema, inline-comment contract, agent-fix prompt, exact signoffs, GitHub authority, environment stop rule, and existing-wrapper command.
- Smoke the exact existing wrapper with a temporary read-only prompt and explicit `grok-4.5` model before dispatching Wave 0.
- Confirm stdout contains a model response while diagnostics remain outside the review object.
- Confirm cancelled, incomplete, empty, unauthenticated, model-unavailable, or non-JSON output does not count as a completed review.
- Confirm no secret-bearing prompt or generated review artifact is staged or committed.

## Acceptance gates

- Review requires no new product tool or separately dispatched Worker 27 task.
- Every implementation PR has GitHub inline comments when findings exist and one top-level review summary with exactly `☑️ approved` or `☑️ issues found`.
- All open findings appear in the consolidated agent-fix prompt.
- Stale or already-fixed existing comments are not reposted as new findings.
- If the environment is broken, the worker stops until it is repaired.
- The Grok wrapper returns the required structured JSON to the implementation worker. If Grok is run as a standalone user-facing review task, it may close with only `done` and the PR URL after the structured review is durable on GitHub. Implementation workers must instead return the concise task summary required by the master plan.

## Completion report

This procedure is complete when the tracked plan validates and the existing Grok wrapper smoke succeeds. It is then inherited by every worker and is not dispatched independently.
