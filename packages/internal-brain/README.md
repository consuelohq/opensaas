# internal-brain

MCP server for the OpenAI Apps SDK. gives chatgpt access to consuelo's second brain — memories, skills, linear, github, bash sandbox, web search, slack.

## env vars

| var | required | what |
|-----|----------|------|
| `SUPABASE_URL` | yes | supabase project URL |
| `SUPABASE_KEY` | yes | supabase anon/service key |
| `LINEAR_API_KEY` | yes | linear API key |
| `GITHUB_TOKEN` | yes | github personal access token |
| `BRAVE_API_KEY` | no | brave search API key |
| `SLACK_WEBHOOK_URL` | no | slack incoming webhook |
| `GITHUB_REPO` | no | default: consuelohq/opensaas |
| `PORT` | no | default: 8000 (railway sets this) |

## local dev

```bash
pip install -r requirements.txt
npm install
python server.py
# → http://localhost:8000/mcp
```

## railway deploy

1. set `RAILWAY_DOCKERFILE_PATH=packages/internal-brain/Dockerfile`
2. set all env vars above
3. deploy — railway gives you an HTTPS URL

## chatgpt connector

1. go to chatgpt developer mode
2. create new connector
3. set MCP server URL to your railway HTTPS URL + `/mcp`
4. test with MCP inspector first: `npx @modelcontextprotocol/inspector http://localhost:8000/mcp`

## tools exposed

**brain:** brain_search, brain_remember, brain_get_memory, brain_list_skills, brain_get_skill
**sandbox:** sandbox_exec, sandbox_read_file, sandbox_write_file, sandbox_list_files
**linear:** linear_get_issue, linear_search_issues, linear_create_issue, linear_update_issue
**github:** github_get_pr, github_list_prs, github_get_file
**web:** web_search, web_fetch
**slack:** slack_post
**handoff:** handoff_save, handoff_load
