# openworkspace

openworkspace is a production-ready MCP server that gives chatgpt desktop or any MCP client a real development workspace: filesystem, terminal, git, github, memory, handoffs, and agent spawning.

it is designed for people who want local-machine power without throwing away safety. the server runs on your machine, exposes a small set of focused tools, blocks destructive commands in the sandbox, and can be fronted by cloudflare so the endpoint is never directly exposed.

## what makes it different

- real host-machine sandbox, not a container mock
- command guardrails with audit logging and `trash` rewrites for deletes
- supabase-backed memory with semantic search via nvidia embeddings
- progressive loading for steering + skills so clients do not need the whole world up front
- optional Langfuse tracing on every tool call with local SQLite fallback
- cloudflare tunnel + WAF workflow for safe exposure to chatgpt connectors

## quick start

### 1. clone and bootstrap

```bash
git clone https://github.com/<your-org>/openworkspace.git
cd openworkspace
bash setup.sh
```

`setup.sh` creates a virtualenv, installs dependencies, copies `.env.example` to `.env` when needed, copies `BRAIN.example.md` to `BRAIN.md` when needed, and generates launchd/cloudflare helper files under `scripts/generated/`.

### 2. configure `.env`

```dotenv
PORT=8850
WORKSPACE_DIR=/path/to/the/repo-you-want-chatgpt-to-work-in
GITHUB_REPO=owner/repo
STEERING_FILE=/absolute/path/to/BRAIN.md
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
GITHUB_TOKEN=your-github-token
NVIDIA_API_KEY=your-nvidia-api-key
```

minimum required vars depend on which tools you plan to use. filesystem and sandbox tools work without github, slack, or supabase. github tools need `GITHUB_TOKEN`. memory tools need supabase and nvidia credentials.

### 3. start the server

```bash
.venv/bin/python3 server.py
```

the MCP endpoint is exposed at `/mcp` and the health endpoint is `/health`.

## architecture

### cloudflare tunnel

the recommended deployment pattern is:

1. run the MCP server locally
2. expose it through `cloudflared tunnel`
3. put a cloudflare WAF rule in front of the hostname
4. connect chatgpt to `https://your-hostname/mcp`

`setup.sh` writes a starter cloudflared config to `scripts/generated/cloudflared-config.yml`.

### WAF allowlist with `chatgpt-connectors.json`

openai publishes connector egress IP ranges at `https://openai.com/chatgpt-connectors.json`. the safest pattern is to create a WAF rule that blocks all traffic to your MCP hostname unless the source IP is in that published allowlist.

example rule shape:

```
(http.host eq "your-mcp.example.com") and not (ip.src in {<openai CIDRs>})
```

that gives you an internet-routable hostname for chatgpt while keeping the endpoint effectively private from everything else.

### guardrails

the sandbox layer blocks destructive operations before they hit the shell.

blocked examples:

- `rm -rf /`, `rm -rf ~`, `rm -rf *`
- `git push --force`
- `npm publish`
- `shutdown`, `reboot`, `mkfs`
- writes into protected paths like `/etc/` and `~/.ssh/`

rewritten examples:

- `rm file.txt` becomes `trash file.txt`

every command is logged to `/tmp/sandbox-audit.jsonl` with timestamp, command prefix, exit code, and any guardrail block reason.

### Langfuse observability

Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` to send remote tool-call generation observations to Langfuse. `WORKSPACE_OBSERVABILITY_PROVIDER` defaults to `langfuse`; set it to `none` to disable remote observability or `langsmith` to use the legacy LangSmith path explicitly.

Workspace observations attach estimated token usage through Langfuse `usage_details` so Langfuse consumption dashboards can show token usage. Cost details are not emitted.

Local `context.trace` SQLite logging still runs independently, so workspace tool history and estimated input/output/total token counts remain queryable even when the remote provider is unavailable.

### memory + progressive loading

`get_steering` loads the steering markdown once for bootstrap. After bootstrap, clients should use `workspace.call` for every typed workspace operation.

this keeps the initial context compact while still making larger skill libraries usable.

### optional repo tree loading

there is no checked-in `repo-tree.txt`. if you want one, generate it for your own repo and point `REPO_TREE_FILE` at it.

example:

```bash
fd . "$WORKSPACE_DIR" -d 3 > /tmp/repo-tree.txt
export REPO_TREE_FILE=/tmp/repo-tree.txt
```

## tools

| tool | purpose |
|------|---------|
| `get_steering` | bootstrap steering once per server process |
| `call` | run a manifest-backed typed workspace tool with `{ tool, input, taskSession, timeout }` |
| task sessions | `task.start` creates a tmux-backed `taskSession`; pass it to every task-scoped `workspace.call` instead of relying on shared root task metadata |

## contributed files in this package

- `BRAIN.example.md` — generic steering template
- `.env.example` — documented environment variables
- `setup.sh` — local bootstrap + helper file generation
- `CONTRIBUTING.md` — contribution workflow
- `LICENSE` — apache-2.0

## license

apache-2.0. see `LICENSE`.
