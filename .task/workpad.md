# portable pi proxy agent client

branch: `task/workspace-agents/portable-pi-proxy-agent-client`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/193
started: 2026-04-25

## acceptance criteria

- [x] add a portable root `bun run agent` script that does not reference `/Users/kokayi/Dev/pi-proxy`
- [x] script calls any openai-compatible endpoint using env/config, defaulting to local pi-proxy
- [x] support prompt via args and stdin
- [x] support model override with `--model <model>` and ergonomic `--provider/model` syntax
- [x] support `--json`, `--quiet`, and `--help`
- [x] document the script in `packages/workspace/SCRIPTS.md`
- [x] smoke test against local `pi-proxy` with `hello world`
- [x] run syntax checks and review/verify before publish

## plan

1. inspect workspace script style and docs placement
2. add `packages/workspace/scripts/agent.js` as a portable openai-compatible client
3. wire root `package.json` to `bun packages/workspace/scripts/agent.js`
4. document usage, env vars, model overrides, and failure modes in `SCRIPTS.md`
5. smoke test local pi-proxy and run checks
6. publish with task scripts

## files changed

- `package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/agent.js`

## key decisions

- `bun run agent` is a portable openai-compatible client, not a wrapper around `/Users/kokayi/Dev/pi-proxy`.
- defaults target local pi-proxy: `AGENT_BASE_URL=http://127.0.0.1:11434/v1`, `AGENT_MODEL=pi-proxy`, `AGENT_API_KEY=anything`.
- real providers can be used by setting env vars instead of changing code.
- sub-agent output is treated as draft text, not repo evidence.

## notes for ko

- smoke test returned `hello world` through local pi-proxy.
- mock endpoint test confirmed `--provider/model` maps to the request model without needing nvidia latency.
- full `bun run review` reports `YOUR CHANGES: clean`; it still exits 1 because the stream has the known pre-existing `openworkspace` missing typecheck target.
- `bun run verify -- --no-review --json` passed db guardrails and wrote `.task/verify.json`.

## improvements noticed

- `task:exec` treats `--help` anywhere in raw args as its own help, so `bun run task:exec -- --area workspace-agents bun run agent -- --help` does not pass help through to the child command. use `node packages/workspace/scripts/agent.js --help` or a direct command when testing nested help output.

## errors i ran into

- stale `.task/current.json` inside `/private/tmp/opensaas-worktrees/stream-workspace-agents-sync-GXiVPA` made task scripts select the wrong workspace-agents worktree. renamed that stale file with `.stale-before-pi-proxy-agent-client`; did not delete it.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): add portable agent script" --changed
bun run task:pr
bun run task:finish
```

- 2026-04-25 23:01:30 write: `.task/workpad.md`