# Tools stream instructions

This stream owns the design and implementation of Consuelo OS tools, Workspace tools, their typed facades, lifecycle boundaries, manifests, generated contracts, and operator-facing behavior.

## Tool shape

- Prefer a narrow typed tool with one clear responsibility and an explicit input/output contract.
- Describe capabilities accurately: read-only, mutating, deterministic, safe to retry, and approval-sensitive behavior must match reality.
- Avoid overlapping public tools. A smaller unambiguous catalog improves `tools.search` and agent selection.
- Durable workflow state belongs behind typed tools. Runtime evidence, tests, builds, and diagnostics belong in `code.call`.
- Do not create a loaded-gun tool for an operation an agent can perform safely through inspection, an explicit plan, and approval.

## Effect boundaries

Use Effect when it makes sequencing, process execution, resource cleanup, dependency injection, retries, timeouts, or typed failures clearer.

A good Effect tool separates:

1. input normalization and policy;
2. configuration and path resolution;
3. process or external-system adapters;
4. the service program;
5. typed errors and stable result contracts;
6. a thin CLI/facade adapter.

Do not put an existing monolith inside `Effect.try` and call it a migration. Follow the service patterns in `code.call`, Browser, and the typed filesystem surfaces. Use Bun for the runtime unless another runtime is required by the job.

## Output policy

Output policy depends on what the payload means.

- User-authored instructions, steering, policy, and agent-control documents are exact inputs to agent behavior. Return every line in order. Do not truncate, summarize, compact, or silently rewrite them.
- External API payloads, GitHub responses, logs, traces, and diagnostic streams can become accidentally unbounded. Return structured counts, important fields, representative samples, compact summaries, and durable evidence paths when raw output is too large.
- Generated artifacts and binary/media output should return paths, metadata, validation evidence, and provenance instead of embedding the payload.
- If a command produces unexpectedly huge diagnostic output, improve the command or result contract rather than spending the caller's context window on raw data.
- Make truncation or compaction explicit in the result. Never make a partial response look complete.

## Tool economics

Optimize the whole turn, not the apparent size of one call.

- Prefer one task-shaped `code.call` evidence packet over many tiny file reads or shell commands.
- Use `batch` for independent calls that can run immediately.
- Use programmable orchestration only when later calls depend on earlier results, or when loops, retries, filtering, or joins are required.
- Use `tools.search` for genuine discovery, then call the selected tool directly. Repeated search after selection is wasted work.
- Keep evidence bounded and structured so the next agent can continue without rereading the entire repository.

## Safety and durability

- Destructive or externally durable behavior must have a narrow scope and explicit authorization.
- Preview is useful, but a preview does not make a broad destructive primitive safe to expose by default.
- Preserve other agents' branches, worktrees, files, task metadata, and uncommitted work.
- Never return credentials, tokens, cookies, secret-bearing config, or customer-sensitive payloads.
- Prefer fail-closed behavior when a tool cannot prove the requested mutation is safe.

## Validation

- Establish a behavioral contract before production edits.
- Test the service boundary with injected dependencies and failure paths.
- Test the typed facade, schemas, source manifests, generated manifests/types/docs, and OS/Workspace parity when those surfaces change.
- Run focused tests before broad review.
- Run repository review and publish verification before promotion.
- Exercise the real user workflow when practical; syntax and type checks alone do not prove tool behavior.

Update this file only with durable tool-engineering lessons. Temporary task status belongs in the workpad.
