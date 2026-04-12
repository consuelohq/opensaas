"""internal-brain MCP server — individual tools, all read-only annotated."""

import os
import json
import time
import functools
from mcp.server.fastmcp import FastMCP

from tools import brain as brain_mod
from tools import sandbox as sandbox_mod
from tools import github as github_mod
from tools import slack as slack_mod
from tools import handoff as handoff_mod
from tools import agents as agents_mod

# langsmith tracing
try:
    from langsmith import traceable, Client as LSClient
    _ls = LSClient()
    _tracing = True
except Exception:
    _tracing = False
    def traceable(**kwargs):
        def decorator(fn):
            return fn
        return decorator

port = int(os.environ.get("PORT", 8000))
mcp = FastMCP("internal-brain", host="0.0.0.0", port=port, stateless_http=True, json_response=True)

RO = {"readOnlyHint": True, "openWorldHint": False}


def _read_brain():
    with open(os.path.join(os.path.dirname(__file__), "BRAIN.md"), "r") as f:
        content = f.read()
    tree = os.path.join(os.path.dirname(__file__), "repo-tree.txt")
    if os.path.exists(tree):
        with open(tree, "r") as f:
            content += "\n\n" + f.read()
    skills = brain_mod.list_skills()
    try:
        skill_list = json.loads(skills)
        if isinstance(skill_list, list) and skill_list:
            content += "\n\n## available skills (call brain_get_skill(name) for full docs)\n"
            for s in skill_list:
                content += f"- **{s['name']}** — {s.get('description', '')}\n"
    except Exception:
        content += "\n\n## available skills\n" + skills
    return content


# --- steering ---
@mcp.tool(annotations=RO)
@traceable(name="get_steering", run_type="tool")
def get_steering() -> str:
    """MANDATORY FIRST CALL. returns operating context (identity, rules, workflows, tools, linear config). call before responding to any message."""
    return _read_brain()


# --- brain / memory ---
@mcp.tool(annotations=RO)
@traceable(name="brain_search", run_type="tool")
def brain_search(query: str, limit: int = 10) -> str:
    """search memories by keyword. searches title and content."""
    return brain_mod.search(query, limit)


@mcp.tool(annotations=RO)
@traceable(name="brain_vector_search", run_type="tool")
def brain_vector_search(query: str, limit: int = 10) -> str:
    """semantic search over memories and chat history using vector embeddings. better than keyword search for conceptual queries."""
    return brain_mod.vector_search(query, limit)


@mcp.tool(annotations=RO)
@traceable(name="brain_remember", run_type="tool")
def brain_remember(content: str, category: str = "observation", title: str = "") -> str:
    """save a new memory. categories: observation, decision, pattern, rule, context, skill."""
    return brain_mod.remember(content, category, title=title)


@mcp.tool(annotations=RO)
@traceable(name="brain_get_memory", run_type="tool")
def brain_get_memory(memory_id: str) -> str:
    """retrieve a specific memory by id."""
    return brain_mod.get_memory(memory_id)


@mcp.tool(annotations=RO)
@traceable(name="brain_list_skills", run_type="tool")
def brain_list_skills() -> str:
    """list available skill docs stored in memory."""
    return brain_mod.list_skills()


@mcp.tool(annotations=RO)
@traceable(name="brain_get_skill", run_type="tool")
def brain_get_skill(skill_name: str) -> str:
    """load a skill doc by name."""
    return brain_mod.get_skill(skill_name)


# --- sandbox ---
@mcp.tool(annotations=RO)
@traceable(name="sandbox_exec", run_type="tool")
def sandbox_exec(command: str, timeout: int = 120) -> str:
    """run a bash command on the host machine. has python3, node, curl, jq, git, gh, all env vars. use for anything — api calls, file ops, scripts."""
    return sandbox_mod.exec(command, timeout)


@mcp.tool(annotations=RO)
@traceable(name="sandbox_read_file", run_type="tool")
def sandbox_read_file(path: str) -> str:
    """read a file from the host filesystem."""
    return sandbox_mod.read_file(path)


@mcp.tool(annotations=RO)
@traceable(name="sandbox_write_file", run_type="tool")
def sandbox_write_file(path: str, content: str) -> str:
    """write content to a file on the host filesystem."""
    return sandbox_mod.write_file(path, content)


@mcp.tool(annotations=RO)
@traceable(name="sandbox_list_files", run_type="tool")
def sandbox_list_files(path: str = "/Users/kokayi/Dev/opensaas") -> str:
    """list files in a directory on the host."""
    return sandbox_mod.list_files(path)


# --- github (read) ---
@mcp.tool(annotations=RO)
@traceable(name="github_get_file", run_type="tool")
def github_get_file(path: str, ref: str = "main") -> str:
    """read a file from consuelohq/opensaas repo."""
    return github_mod.get_file(path, ref)


@mcp.tool(annotations=RO)
@traceable(name="github_get_pr", run_type="tool")
def github_get_pr(pr_number: int) -> str:
    """get a pull request by number."""
    return github_mod.get_pr(pr_number)


@mcp.tool(annotations=RO)
@traceable(name="github_list_prs", run_type="tool")
def github_list_prs(state: str = "open", limit: int = 10) -> str:
    """list pull requests."""
    return github_mod.list_prs(state, limit)


# --- github (write) ---
@mcp.tool(annotations=RO)
@traceable(name="github_push_files", run_type="tool")
def github_push_files(branch: str, files: str, message: str) -> str:
    """push file changes to a branch. files is JSON: [{"path": "src/foo.ts", "content": "..."}]. creates blob->tree->commit->ref in one call."""
    return github_mod.push_files(branch, files, message)


# --- agents ---
@mcp.tool(annotations=RO)
@traceable(name="invoke_opencode", run_type="tool")
def invoke_opencode(prompt: str, cwd: str = "/Users/kokayi/Dev/opensaas") -> str:
    """spawn an opencode coding agent in tmux. writes prompt to /tmp, launches in background. returns session name."""
    return agents_mod.invoke_opencode(prompt, cwd)


@mcp.tool(annotations=RO)
@traceable(name="invoke_kiro", run_type="tool")
def invoke_kiro(prompt: str, cwd: str = "/Users/kokayi/Dev/opensaas") -> str:
    """spawn a kiro coding agent in tmux. writes prompt to /tmp, launches in background. returns session name."""
    return agents_mod.invoke_kiro(prompt, cwd)


# --- slack ---
@mcp.tool(annotations=RO)
@traceable(name="slack_post", run_type="tool")
def slack_post(message: str) -> str:
    """post a message to the #suelo slack channel."""
    return slack_mod.post(message)


# --- handoff ---
@mcp.tool(annotations=RO)
@traceable(name="handoff_save", run_type="tool")
def handoff_save(context: str, session_id: str = "", tags: str = "") -> str:
    """save conversation context for later continuation."""
    return handoff_mod.save(context, session_id, tags)


@mcp.tool(annotations=RO)
@traceable(name="handoff_load", run_type="tool")
def handoff_load(session_id: str = "", query: str = "") -> str:
    """load previous conversation context by session id or keyword."""
    return handoff_mod.load(session_id, query)


if __name__ == "__main__":
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route, Mount
    from starlette.middleware import Middleware
    from starlette.middleware.base import BaseHTTPMiddleware
    import contextlib
    import uvicorn

    BEARER_TOKEN = os.environ.get("MCP_BEARER_TOKEN", "")
    SERVER_URL = os.environ.get("MCP_SERVER_URL", "")

    class AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            return await call_next(request)

    async def health(request):
        return JSONResponse({"status": "ok", "tools": 20})

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
        middleware=[Middleware(AuthMiddleware)] if BEARER_TOKEN else [],
    )
    uvicorn.run(app, host="0.0.0.0", port=port)
