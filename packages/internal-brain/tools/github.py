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


def _gh_post(path: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{API}{path}", data=body, headers={
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code} {e.read().decode()[:200]}"}


def _gh_patch(path: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{API}{path}", data=body, method="PATCH", headers={
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
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


def push_files(branch: str, files_json: str, message: str) -> str:
    """push files to a branch via blob->tree->commit->ref. files_json: [{"path":"...","content":"..."}]"""
    import base64
    try:
        files = json.loads(files_json)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"invalid files JSON: {e}"})

    # get current HEAD
    ref = _gh(f"/repos/{GITHUB_REPO}/git/ref/heads/{branch}")
    if "error" in ref:
        return json.dumps(ref)
    head_sha = ref["object"]["sha"]
    tree_sha = _gh(f"/repos/{GITHUB_REPO}/git/commits/{head_sha}")["tree"]["sha"]

    # create blobs
    tree_items = []
    for f in files:
        blob = _gh_post(f"/repos/{GITHUB_REPO}/git/blobs", {
            "content": base64.b64encode(f["content"].encode()).decode(),
            "encoding": "base64",
        })
        if "error" in blob:
            return json.dumps({"error": f"blob failed for {f['path']}: {blob['error']}"})
        tree_items.append({"path": f["path"], "mode": "100644", "type": "blob", "sha": blob["sha"]})

    # create tree
    new_tree = _gh_post(f"/repos/{GITHUB_REPO}/git/trees", {"base_tree": tree_sha, "tree": tree_items})
    if "error" in new_tree:
        return json.dumps(new_tree)

    # create commit
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    commit = _gh_post(f"/repos/{GITHUB_REPO}/git/commits", {
        "message": message,
        "tree": new_tree["sha"],
        "parents": [head_sha],
        "author": {"name": "kokayicobb", "email": "kokayicobb@users.noreply.github.com", "date": now},
        "committer": {"name": "suelo-kiro[bot]", "email": "260422584+suelo-kiro[bot]@users.noreply.github.com", "date": now},
    })
    if "error" in commit:
        return json.dumps(commit)

    # update ref
    update = _gh_patch(f"/repos/{GITHUB_REPO}/git/refs/heads/{branch}", {"sha": commit["sha"]})
    return json.dumps({"success": True, "sha": commit["sha"][:8], "message": message, "files": len(files)})
