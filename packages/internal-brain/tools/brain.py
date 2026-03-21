"""brain tools — memory storage and retrieval via supabase."""

import json
import os
import urllib.parse
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def _request(method, path, data=None, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=_HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code} {e.read().decode()[:200]}"}


def search(query: str, limit: int = 10) -> str:
    """search memories by keyword. returns matching memories."""
    records = _request("GET", "memories", params={
        "content": f"ilike.%{query}%",
        "status": "eq.active",
        "order": "created_at.desc",
        "limit": str(limit),
    })
    if isinstance(records, dict) and "error" in records:
        return json.dumps(records)
    return json.dumps([{"id": r.get("id"), "content": r.get("content", ""), "category": r.get("category", "")} for r in records])


def remember(content: str, category: str = "observation", source: str = "chatgpt", title: str = "") -> str:
    """save a new memory to the brain."""
    record = {
        "title": title or content[:100],
        "content": content,
        "category": category,
        "source": source,
        "status": "active",
        "priority": "normal",
        "agent_id": "chatgpt",
    }
    result = _request("POST", "memories", data=record)
    if isinstance(result, dict) and "error" in result:
        return json.dumps(result)
    return json.dumps({"saved": True, "id": result[0].get("id") if isinstance(result, list) and result else None})


def get_memory(memory_id: str) -> str:
    """get a specific memory by id."""
    result = _request("GET", "memories", params={"id": f"eq.{memory_id}"})
    if isinstance(result, list) and result:
        return json.dumps(result[0])
    return json.dumps({"error": "not found"})


def list_skills() -> str:
    """list available skill files."""
    result = _request("GET", "skills", params={"order": "name.asc", "select": "id,name,description"})
    return json.dumps(result)


def get_skill(name: str) -> str:
    """get a skill file by name."""
    result = _request("GET", "skills", params={"name": f"eq.{name}", "select": "name,content"})
    if isinstance(result, list) and result:
        return json.dumps(result[0])
    return json.dumps({"error": f"skill '{name}' not found"})
