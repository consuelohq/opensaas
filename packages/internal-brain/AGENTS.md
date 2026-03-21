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

## railway deploy verification — MANDATORY

after every `railway up`, you MUST verify the deploy succeeded. never fire-and-forget.

1. wait 30-60s after upload completes
2. check `railway logs --service internal-brain --build` for build errors
3. check `railway logs --service internal-brain` for runtime errors
4. hit the health endpoint: `GET https://internal-brain-production.up.railway.app/health`
5. hit the mcp endpoint: `POST /mcp` with `tools/list` to confirm tools are registered

if the build or runtime fails, read the logs, fix the issue, redeploy, and repeat. don't move on until you get a 200 from the health check.

### dockerfile path gotcha

`railway up` uploads from the package directory — the Dockerfile is at the root of the upload context. so `RAILWAY_DOCKERFILE_PATH=Dockerfile` (not `packages/internal-brain/Dockerfile`). the full path is only needed for github-triggered builds that clone the whole repo.

