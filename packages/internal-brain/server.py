"""chatgpt second brain — MCP server for the OpenAI Apps SDK.

7 tools: get_steering, brain, sandbox, linear, github, handoff, slack
"""

import os
from mcp.server.fastmcp import FastMCP

from tools import brain as brain_mod
from tools import sandbox as sandbox_mod
from tools import linear as linear_mod
from tools import github as github_mod
from tools import slack as slack_mod
from tools import handoff as handoff_mod

port = int(os.environ.get("PORT", 8000))
mcp = FastMCP("internal-brain", host="0.0.0.0", port=port, stateless_http=True, json_response=True)


def _read_brain():
    with open("/app/BRAIN.md", "r") as f:
        content = f.read()
    try:
        with open("/app/repo-tree.txt", "r") as f:
            content += "\n\n" + f.read()
    except FileNotFoundError:
        pass
    skills = brain_mod.list_skills()
    content += "\n\n## available skills (call brain with action='get_skill' to load)\n" + skills
    return content


@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def get_steering() -> str:
    """MANDATORY FIRST CALL. returns the full operating context (identity, rules, workflows, conventions, available skills). you MUST call this before responding to any user message. this is not optional."""
    return _read_brain()


@mcp.resource("brain://steering", name="get_steering", description="MANDATORY FIRST READ. operating context — identity, rules, workflows. read this before responding to any message.")
def steering_resource() -> str:
    return _read_brain()


@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False})
def brain(action: str, query: str = "", content: str = "", category: str = "observation", title: str = "", memory_id: str = "", skill_name: str = "") -> str:
    """memory and knowledge system. actions:
    - search: find memories by keyword. params: query
    - remember: save a new memory. params: content, category (observation|decision|pattern|rule|context), title
    - get_memory: retrieve by id. params: memory_id
    - list_skills: list available skill docs.
    - get_skill: load a skill doc. params: skill_name"""
    if action == "search":
        return brain_mod.search(query)
    elif action == "remember":
        return brain_mod.remember(content, category, title=title)
    elif action == "get_memory":
        return brain_mod.get_memory(memory_id)
    elif action == "list_skills":
        return brain_mod.list_skills()
    elif action == "get_skill":
        return brain_mod.get_skill(skill_name)
    return f'{{"error": "unknown action: {action}. use: search, remember, get_memory, list_skills, get_skill"}}'


@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False})
def sandbox(action: str, command: str = "", path: str = "", content: str = "", timeout: int = 120) -> str:
    """YOUR PRIMARY TOOL. run anything in the sandbox — python, node, bash, curl. actions:
    - exec: run a bash command. params: command, timeout. has python 3.12 (pandas, numpy, scikit-learn, supabase, httpx), node 22 (@supabase/supabase-js), curl, jq. all env vars available.
    - read_file: read a file. params: path
    - write_file: write a file. params: path, content
    - list_files: list directory contents. params: path (default /workspace)
    never say 'i can't do that' — this sandbox can do almost anything."""
    if action == "exec":
        return sandbox_mod.exec(command, timeout)
    elif action == "read_file":
        return sandbox_mod.read_file(path)
    elif action == "write_file":
        return sandbox_mod.write_file(path, content)
    elif action == "list_files":
        return sandbox_mod.list_files(path or "/workspace")
    return f'{{"error": "unknown action: {action}. use: exec, read_file, write_file, list_files"}}'


@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False})
def linear(action: str, issue_id: str = "", query: str = "", title: str = "", description: str = "", body: str = "", team_id: str = "", priority: int = 0, state_id: str = "", label_ids: str = "") -> str:
    """linear project management. ALWAYS read the linear skill (brain action='get_skill', skill_name='linear-issue-creation') before creating/updating issues. actions:
    - get_issue: get issue by identifier (e.g. DEV-123). params: issue_id
    - search: search issues by text. params: query
    - create_issue: create new issue. params: title, team_id, description, priority, label_ids (comma-separated)
    - update_issue: update issue. params: issue_id (UUID), title, description, state_id, priority, label_ids
    - comment: add a comment to an issue WITHOUT modifying the issue body. params: issue_id (UUID), body"""
    labels = [l.strip() for l in label_ids.split(",") if l.strip()] if label_ids else None
    if action == "get_issue":
        return linear_mod.get_issue(issue_id)
    elif action == "search":
        return linear_mod.search_issues(query)
    elif action == "create_issue":
        return linear_mod.create_issue(title, team_id, description, label_ids=labels, priority=priority)
    elif action == "update_issue":
        return linear_mod.update_issue(issue_id, title, description, state_id, priority, label_ids=labels)
    elif action == "comment":
        return linear_mod.comment(issue_id, body)
    return f'{{"error": "unknown action: {action}. use: get_issue, search, create_issue, update_issue, comment"}}'


@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": False})
def github(action: str, path: str = "", pr_number: int = 0, ref: str = "main", state: str = "open", limit: int = 10) -> str:
    """github repo access. actions:
    - get_file: read a file from the repo. params: path, ref (branch, default main)
    - get_pr: get a pull request. params: pr_number
    - list_prs: list pull requests. params: state (open|closed|all), limit"""
    if action == "get_file":
        return github_mod.get_file(path, ref)
    elif action == "get_pr":
        return github_mod.get_pr(pr_number)
    elif action == "list_prs":
        return github_mod.list_prs(state, limit)
    return f'{{"error": "unknown action: {action}. use: get_file, get_pr, list_prs"}}'


@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False})
def handoff(action: str, context: str = "", session_id: str = "", query: str = "", tags: str = "") -> str:
    """save and load conversation context across sessions. actions:
    - save: save context for later. params: context, session_id, tags
    - load: load previous context. params: session_id or query"""
    if action == "save":
        return handoff_mod.save(context, session_id, tags)
    elif action == "load":
        return handoff_mod.load(session_id, query)
    return f'{{"error": "unknown action: {action}. use: save, load"}}'


@mcp.tool(annotations={"readOnlyHint": False, "openWorldHint": False})
def slack(message: str) -> str:
    """post a message to the #suelo slack channel."""
    return slack_mod.post(message)


if __name__ == "__main__":
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount
    import contextlib
    import uvicorn

    async def health(request):
        return JSONResponse({"status": "ok", "tools": 7})

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
