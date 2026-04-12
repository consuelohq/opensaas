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


NVIDIA_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5"


def _get_embedding(text, input_type="query"):
    body = json.dumps({"input": [text[:2000]], "model": NVIDIA_EMBED_MODEL, "input_type": input_type, "encoding_format": "float"}).encode()
    req = urllib.request.Request("https://integrate.api.nvidia.com/v1/embeddings", data=body, headers={
        "Authorization": f"Bearer {NVIDIA_KEY}", "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["data"][0]["embedding"]


def search(query: str, limit: int = 10) -> str:
    """search memories by keyword (searches title and content). returns matching memories."""
    records = _request("GET", "memories", params={
        "or": f"(title.ilike.%{query}%,content.ilike.%{query}%)",
        "status": "eq.active",
        "order": "created_at.desc",
        "limit": str(limit),
    })
    if isinstance(records, dict) and "error" in records:
        return json.dumps(records)
    return json.dumps([{"id": r.get("id"), "content": r.get("content", ""), "category": r.get("category", "")} for r in records])


def vector_search(query: str, limit: int = 10) -> str:
    """semantic search using vector embeddings."""
    try:
        emb = _get_embedding(query, "query")
    except Exception as e:
        return json.dumps({"error": f"embedding failed: {e}"})
    body = json.dumps({"query_embedding": json.dumps(emb), "match_threshold": 0.3, "match_count": limit}).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/rpc/match_memories", data=body, headers={
        "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            results = json.loads(resp.read())
        return json.dumps([{"title": r.get("title", ""), "content": r.get("content", "")[:500], "category": r.get("category", ""), "similarity": r.get("similarity", 0)} for r in results])
    except urllib.error.HTTPError as e:
        return json.dumps({"error": f"{e.code} {e.read().decode()[:200]}"})


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
    """list available skills stored in memory."""
    result = _request("GET", "memories", params={
        "category": "eq.skill",
        "status": "eq.active",
        "order": "title.asc",
        "select": "id,title,content",
    })
    if isinstance(result, dict) and "error" in result:
        return json.dumps(result)
    skills = []
    for r in result:
        content = r.get("content", "")
        # extract first meaningful line as description
        desc = ""
        for line in content.split("\n"):
            line = line.strip().lstrip("#").strip().lstrip("-").strip()
            if len(line) > 20 and not line.startswith("name:") and not line.startswith("description:") and not line.startswith("---"):
                desc = line[:120]
                break
        skills.append({"name": r.get("title"), "description": desc})
    return json.dumps(skills)


def get_skill(name: str) -> str:
    """get a skill by name. tries exact match first, then fuzzy."""
    # exact match first
    result = _request("GET", "memories", params={
        "category": "eq.skill",
        "title": f"eq.{name}",
        "status": "eq.active",
        "select": "title,content",
    })
    if isinstance(result, list) and result:
        return json.dumps({"name": result[0].get("title"), "content": result[0].get("content")})
    # fuzzy match
    result = _request("GET", "memories", params={
        "category": "eq.skill",
        "title": f"ilike.%{name}%",
        "status": "eq.active",
        "select": "title,content",
    })
    if isinstance(result, list) and result:
        return json.dumps({"name": result[0].get("title"), "content": result[0].get("content")})
    return json.dumps({"error": f"skill '{name}' not found"})
