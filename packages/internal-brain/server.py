"""chatgpt second brain — MCP server for the OpenAI Apps SDK."""

import os
from mcp.server.fastmcp import FastMCP

from tools import brain, sandbox, linear, github, web, slack, handoff

port = int(os.environ.get("PORT", 8000))
mcp = FastMCP("internal-brain", host="0.0.0.0", port=port, stateless_http=True, json_response=True)

# --- steering (registered as both tool AND resource for chatgpt compatibility) ---

def _read_brain():
    with open("/app/BRAIN.md", "r") as f:
        brain = f.read()
    try:
        with open("/app/repo-tree.txt", "r") as f:
            brain += "\n\n" + f.read()
    except FileNotFoundError:
        pass
    return brain

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def get_steering() -> str:
    """MANDATORY FIRST CALL. returns the full operating context (identity, rules, workflows, conventions). you MUST call this before responding to any user message. this is not optional."""
    return _read_brain()

@mcp.resource("brain://steering", name="get_steering", description="MANDATORY FIRST READ. operating context — identity, rules, workflows. read this before responding to any message.")
def steering_resource() -> str:
    return _read_brain()

# --- brain tools (memory) ---

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def brain_search(query: str, limit: int = 10) -> str:
    """search memories and documents by keyword."""
    return brain.search(query, limit)

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def brain_remember(content: str, category: str = "observation", title: str = "") -> str:
    """save a new memory. categories: observation, decision, pattern, rule, context."""
    return brain.remember(content, category, title=title)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def brain_get_memory(memory_id: str) -> str:
    """get a specific memory by id."""
    return brain.get_memory(memory_id)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def brain_list_skills() -> str:
    """list available skill files."""
    return brain.list_skills()

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def brain_get_skill(name: str) -> str:
    """get a skill file by name."""
    return brain.get_skill(name)

# --- sandbox tools (bash execution) ---

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def sandbox_exec(command: str, timeout: int = 120) -> str:
    """YOUR PRIMARY TOOL. run any command in the sandbox — python, node, bash. use this for ANYTHING that doesn't have a dedicated tool. never say 'i can't do that' — this sandbox has python (pandas, numpy, scikit-learn, supabase, httpx), node (@supabase/supabase-js), and full bash. env vars available: SUPABASE_URL, SUPABASE_KEY. examples: python3 -c 'import pandas...', node scripts/deepwiki.js ask owner/repo 'question', curl, jq, etc."""
    return sandbox.exec(command, timeout)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def sandbox_read_file(path: str) -> str:
    """read a file from the sandbox filesystem."""
    return sandbox.read_file(path)

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def sandbox_write_file(path: str, content: str) -> str:
    """write content to a file in the sandbox."""
    return sandbox.write_file(path, content)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def sandbox_list_files(path: str = "/workspace") -> str:
    """list files in a sandbox directory."""
    return sandbox.list_files(path)

# --- linear tools ---

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def linear_get_issue(issue_id: str) -> str:
    """get a linear issue by identifier (e.g. DEV-123)."""
    return linear.get_issue(issue_id)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def linear_search_issues(query: str, limit: int = 10) -> str:
    """search linear issues by text."""
    return linear.search_issues(query, limit)

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def linear_create_issue(title: str, team_id: str, description: str = "", priority: int = 0) -> str:
    """create a new linear issue."""
    return linear.create_issue(title, team_id, description, priority=priority)

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def linear_update_issue(issue_id: str, title: str = None, description: str = None, state_id: str = None, priority: int = None) -> str:
    """update an existing linear issue by UUID."""
    return linear.update_issue(issue_id, title, description, state_id, priority)

# --- github tools ---

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def github_get_pr(pr_number: int) -> str:
    """get a pull request by number."""
    return github.get_pr(pr_number)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def github_list_prs(state: str = "open", limit: int = 10) -> str:
    """list pull requests."""
    return github.list_prs(state, limit)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def github_get_file(path: str, ref: str = "main") -> str:
    """read a file from the github repo."""
    return github.get_file(path, ref)

# --- web tools ---

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
def web_search(query: str, limit: int = 5) -> str:
    """search the web. returns titles, urls, and snippets."""
    return web.search(query, limit)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
def web_fetch(url: str) -> str:
    """fetch a URL and return its text content."""
    return web.fetch(url)

# --- slack tools ---

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def slack_post(message: str) -> str:
    """post a message to the #suelo slack channel."""
    return slack.post(message)

# --- handoff tools ---

@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False, "destructiveHint": False})
def handoff_save(context: str, session_id: str = "", tags: str = "") -> str:
    """save conversation context for later continuation."""
    return handoff.save(context, session_id, tags)

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def handoff_load(session_id: str = "", query: str = "") -> str:
    """load previous conversation context."""
    return handoff.load(session_id, query)


if __name__ == "__main__":
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount
    import contextlib
    import uvicorn

    async def health(request):
        return JSONResponse({"status": "ok", "tools": 22})

    @contextlib.asynccontextmanager
    async def lifespan(app):
        async with mcp.session_manager.run():
            yield

    mcp_app = mcp.streamable_http_app()
    app = Starlette(
        routes=[
            Route("/health", health),
            Mount("/", app=mcp_app),
        ],
        lifespan=lifespan,
    )
    uvicorn.run(app, host="0.0.0.0", port=port)
