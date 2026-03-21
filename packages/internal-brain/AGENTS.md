# AGENTS.md — internal-brain

## what this is

MCP server for the OpenAI Apps SDK. gives chatgpt access to consuelo's second brain — memories, skills, linear, github, bash sandbox, web search, slack.

## architecture

python MCP server (FastMCP) + just-bash (WASM sandbox via npm). deployed as its own railway service, independent from the main opensaas deploy.

## key files

| file | what |
|------|------|
| `server.py` | main entry — registers all 22 MCP tools, runs streamable-http transport |
| `tools/brain.py` | supabase memory (search, remember, get, skills) |
| `tools/sandbox.py` | just-bash CLI wrapper (exec, read, write, list) |
| `tools/linear.py` | linear graphql API (get, search, create, update) |
| `tools/github.py` | github REST API (PRs, files) |
| `tools/web.py` | brave search + url fetch |
| `tools/slack.py` | slack webhook post |
| `tools/handoff.py` | conversation context save/load via supabase |

## env vars

`SUPABASE_URL`, `SUPABASE_KEY`, `LINEAR_API_KEY`, `GITHUB_TOKEN` (required)
`BRAVE_API_KEY`, `SLACK_WEBHOOK_URL` (optional)

## local dev

```bash
pip install -r requirements.txt && npm install && python server.py
```

## deploy

separate railway service: `RAILWAY_DOCKERFILE_PATH=packages/internal-brain/Dockerfile`

## adding tools

1. create `tools/your_tool.py` with functions that return JSON strings
2. import in `server.py` and add `@mcp.tool()` wrappers with annotations
3. annotations are required: `readOnlyHint`, `openWorldHint`, `destructiveHint`
