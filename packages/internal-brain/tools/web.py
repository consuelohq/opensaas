"""web tools — search and fetch."""

import json
import os
import urllib.request
import urllib.parse

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")


def search(query: str, limit: int = 5) -> str:
    """search the web. returns titles, urls, and snippets."""
    if not BRAVE_API_KEY:
        return json.dumps({"error": "BRAVE_API_KEY not set"})
    url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count={limit}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        results = data.get("web", {}).get("results", [])
        return json.dumps([{"title": r["title"], "url": r["url"], "snippet": r.get("description", "")} for r in results[:limit]])
    except urllib.error.HTTPError as e:
        return json.dumps({"error": f"{e.code} {e.read().decode()[:200]}"})


def fetch(url: str) -> str:
    """fetch a URL and return its text content (truncated to 10k chars)."""
    req = urllib.request.Request(url, headers={"User-Agent": "Consuelo-Brain/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8", errors="replace")[:10000]
        return json.dumps({"url": url, "content": content})
    except Exception as e:
        return json.dumps({"error": str(e)})
