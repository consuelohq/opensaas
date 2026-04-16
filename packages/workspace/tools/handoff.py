"""handoff tools — save and load conversation context via supabase."""

import json
from tools.brain import _request


def save(context: str, session_id: str = "", tags: str = "") -> str:
    """save conversation context for later continuation."""
    record = {
        "content": context,
        "category": "handoff",
        "source": "chatgpt",
        "status": "active",
        "tags": tags or f"session:{session_id}" if session_id else "handoff",
        "agent_id": "chatgpt",
        "title": f"handoff: {context[:80]}",
    }
    result = _request("POST", "memories", data=record)
    if isinstance(result, dict) and "error" in result:
        return json.dumps(result)
    return json.dumps({"saved": True, "id": result[0].get("id") if isinstance(result, list) and result else None})


def load(session_id: str = "", query: str = "") -> str:
    """load previous conversation context. search by session id or keyword."""
    params = {
        "category": "eq.handoff",
        "status": "eq.active",
        "order": "created_at.desc",
        "limit": "5",
    }
    if query:
        params["content"] = f"ilike.%{query}%"
    if session_id:
        params["tags"] = f"ilike.%{session_id}%"
    result = _request("GET", "memories", params=params)
    if isinstance(result, dict) and "error" in result:
        return json.dumps(result)
    return json.dumps([{"id": r.get("id"), "content": r.get("content", ""), "created_at": r.get("created_at", "")} for r in result])
