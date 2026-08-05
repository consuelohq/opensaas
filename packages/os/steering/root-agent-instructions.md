# OS Steering Instructions Rewrite

You have an app connected called `os`. This is where all repo work happens.

At the start of every conversation, before responding to the user:

1. Call OS's `get_steering` tool exactly once.
2. Read the full response. It contains your identity, repo structure, rules, Linear config, workspace tool manifest, and examples for using the workspace tools.
3. Follow that steering for the rest of the conversation.

Do not respond to the user until `get_steering` has succeeded and you have internalized the response.

## Primary Rule

After `get_steering` succeeds, all repo operations must go through `os.call`.

`os.call` is the interface for:

- reading files
- searching files
- listing files
- writing files
- patching files
- running repo commands
- starting or recovering task sessions
- validating work
- pushing work
- creating or promoting PRs
- checking status
- using browser, GitHub, Linear, Railway, Sentry, review, or verification helpers when the workspace manifest provides them

Do not use native/basic file tools, direct shell commands, editor tools, or raw git commands for repo work when the workspace manifest has a matching tool.

## Tool Discovery Rule

Do not use `tool_search` to rediscover workspace tools after `get_steering`.

The workspace steering response is the source of truth for workspace tools. If the steering manifest already includes `code.call`, `batch`, `task.*`, `verify`, `review.*`, `github`, `linear`, `railway`, or any other workspace tool, call it through `workspace.call` directly.

Use `tool_search` only when all of these are true:

- the needed capability is not a os repo operation;
- the capability is not listed in the steering manifest;
- the active tool list does not already expose it;
- and the user explicitly asked for that external/deferred capability or the task cannot proceed without it.

Never use `tool_search` for normal repo operations such as file reads, searches, edits, tests, typechecks, git status, commits, pushes, PRs, reviews, or verification. Those go through `os.call`.

## Preferred os Tools

Prefer `code.call` through `workspace.call` for repo work:

- `mode: "read"` for reading/searching/inspecting repo files
- `mode: "edit"` for repo edits or mutating repo commands
- `mode: "verify"` for tests, checks, typechecks, status, and read-only command verification

Use the os `batch` tool when multiple os calls can run in parallel.

Do not use deprecated or stale tool names from older instructions. In particular, do not invent `task.exec` if the steering manifest says to use `code.call`.

## Task-Scoped Repo Work

For task-scoped repo work:

1. Start or identify the task through `os.call`.
2. Capture the returned `taskSession`.
3. Pass `taskSession` on every task-scoped `os.call`.

If `taskSession` is required and missing, start or recover the task session through `os.call`. Do not bypass the requirement with native tools.

## Failure Handling

If a `os.call` fails:

1. Inspect the returned envelope.
2. Fix the typed input, mode, cwd, task session, or arguments.
3. Use another `os.call` to diagnose.
4. Do not silently switch to native file/shell/git tools.

If the os facade is unavailable at the transport layer, retry once. If it still fails, state that the os facade is unavailable and use native tools only for the minimum necessary non-repo machine inspection or user-approved emergency action.

## Native Tool Fallbacks

Raw shell or native file operations are allowed only when:

- inspecting non-repo machine state;
- reading/writing a non-repo temporary file such as `/tmp/...`;
- the workspace manifest has no matching operation;
- or the workspace facade itself is unavailable and the action is necessary to continue safely.

When using any fallback, state why the workspace facade was insufficient.

## Steering Freshness

Only call `get_steering` once per conversation unless:

- Ko explicitly asks to refresh it;
- the workspace session restarts;
- the original call failed;
- or there is concrete evidence the steering response is stale.

Do not call `tool_search` as a substitute for refreshing or reading the steering response.