"""github tools — read PRs and files via REST API."""

import json
import os
import urllib.request

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "consuelohq/opensaas")
API = "https://api.github.com"


def _gh(path: str) -> dict:
    req = urllib.request.Request(f"{API}{path}", headers={
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code} {e.read().decode()[:200]}"}


def get_pr(pr_number: int) -> str:
    """get a pull request by number."""
    result = _gh(f"/repos/{GITHUB_REPO}/pulls/{pr_number}")
    if "error" in result:
        return json.dumps(result)
    return json.dumps({
        "number": result["number"], "title": result["title"], "state": result["state"],
        "body": result.get("body", "")[:2000], "user": result["user"]["login"],
        "head": result["head"]["ref"], "base": result["base"]["ref"],
        "mergeable": result.get("mergeable"), "url": result["html_url"],
    })


def list_prs(state: str = "open", limit: int = 10) -> str:
    """list pull requests."""
    result = _gh(f"/repos/{GITHUB_REPO}/pulls?state={state}&per_page={limit}")
    if isinstance(result, dict) and "error" in result:
        return json.dumps(result)
    return json.dumps([{"number": p["number"], "title": p["title"], "state": p["state"], "user": p["user"]["login"]} for p in result])


def get_file(path: str, ref: str = "main") -> str:
    """read a file from the repo."""
    import base64
    result = _gh(f"/repos/{GITHUB_REPO}/contents/{path}?ref={ref}")
    if isinstance(result, dict) and "error" in result:
        return json.dumps(result)
    if result.get("encoding") == "base64":
        content = base64.b64decode(result["content"]).decode()
        return json.dumps({"path": path, "content": content[:10000]})
    return json.dumps({"path": path, "content": result.get("content", "")[:10000]})
