"""github tools — read pull requests and files via the REST api."""

import base64
import json
import os
import subprocess
import urllib.error
import urllib.request

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
API = 'https://api.github.com'


def _configured_repo() -> str:
    explicit_repo = os.environ.get('GITHUB_REPO') or os.environ.get('REPO_NAME')
    if explicit_repo:
        return explicit_repo
    workspace_dir = os.environ.get('WORKSPACE_DIR', '').strip()
    if not workspace_dir:
        return ''
    try:
        result = subprocess.run(
            ['git', '-C', workspace_dir, 'remote', 'get-url', 'origin'],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return ''
        remote_url = result.stdout.strip()
        if remote_url.endswith('.git'):
            remote_url = remote_url[:-4]
        if remote_url.startswith('git@github.com:'):
            return remote_url.split(':', 1)[1]
        if 'github.com/' in remote_url:
            return remote_url.split('github.com/', 1)[1]
    except Exception:
        return ''
    return ''


def _require_repo() -> str | None:
    repo = _configured_repo()
    return repo or None


def _gh(path: str) -> dict:
    req = urllib.request.Request(
        f'{API}{path}',
        headers={
            'Authorization': f'Bearer {GITHUB_TOKEN}',
            'Accept': 'application/vnd.github+json',
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return {'error': f"{exc.code} {exc.read().decode()[:200]}"}


def _gh_post(path: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f'{API}{path}',
        data=body,
        headers={
            'Authorization': f'Bearer {GITHUB_TOKEN}',
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return {'error': f"{exc.code} {exc.read().decode()[:200]}"}


def _gh_patch(path: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f'{API}{path}',
        data=body,
        method='PATCH',
        headers={
            'Authorization': f'Bearer {GITHUB_TOKEN}',
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return {'error': f"{exc.code} {exc.read().decode()[:200]}"}


def get_pr(pr_number: int) -> str:
    repo = _require_repo()
    if repo is None:
        return json.dumps({'error': 'GITHUB_REPO or REPO_NAME is not configured and could not be inferred from WORKSPACE_DIR'})
    result = _gh(f'/repos/{repo}/pulls/{pr_number}')
    if 'error' in result:
        return json.dumps(result)
    return json.dumps(
        {
            'number': result['number'],
            'title': result['title'],
            'state': result['state'],
            'body': result.get('body', '')[:2000],
            'user': result['user']['login'],
            'head': result['head']['ref'],
            'base': result['base']['ref'],
            'mergeable': result.get('mergeable'),
            'url': result['html_url'],
            'repo': repo,
        }
    )


def list_prs(state: str = 'open', limit: int = 10) -> str:
    repo = _require_repo()
    if repo is None:
        return json.dumps({'error': 'GITHUB_REPO or REPO_NAME is not configured and could not be inferred from WORKSPACE_DIR'})
    result = _gh(f'/repos/{repo}/pulls?state={state}&per_page={limit}')
    if isinstance(result, dict) and 'error' in result:
        return json.dumps(result)
    return json.dumps(
        [
            {'number': pr['number'], 'title': pr['title'], 'state': pr['state'], 'user': pr['user']['login']}
            for pr in result
        ]
    )


def get_file(path: str, ref: str = 'main') -> str:
    repo = _require_repo()
    if repo is None:
        return json.dumps({'error': 'GITHUB_REPO or REPO_NAME is not configured and could not be inferred from WORKSPACE_DIR'})
    result = _gh(f'/repos/{repo}/contents/{path}?ref={ref}')
    if isinstance(result, dict) and 'error' in result:
        return json.dumps(result)
    if result.get('encoding') == 'base64':
        content = base64.b64decode(result['content']).decode()
        return json.dumps({'path': path, 'content': content[:10000], 'repo': repo})
    return json.dumps({'path': path, 'content': result.get('content', '')[:10000], 'repo': repo})


def push_files(branch: str, files_json: str, message: str) -> str:
    repo = _require_repo()
    if repo is None:
        return json.dumps({'error': 'GITHUB_REPO or REPO_NAME is not configured and could not be inferred from WORKSPACE_DIR'})
    try:
        files = json.loads(files_json)
    except json.JSONDecodeError as exc:
        return json.dumps({'error': f'invalid files JSON: {exc}'})

    ref = _gh(f'/repos/{repo}/git/ref/heads/{branch}')
    if 'error' in ref:
        return json.dumps(ref)
    head_sha = ref['object']['sha']
    tree_sha = _gh(f'/repos/{repo}/git/commits/{head_sha}')['tree']['sha']

    tree_items = []
    for file_payload in files:
        blob = _gh_post(
            f'/repos/{repo}/git/blobs',
            {
                'content': base64.b64encode(file_payload['content'].encode()).decode(),
                'encoding': 'base64',
            },
        )
        if 'error' in blob:
            return json.dumps({'error': f"blob failed for {file_payload['path']}: {blob['error']}"})
        tree_items.append({'path': file_payload['path'], 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})

    new_tree = _gh_post(f'/repos/{repo}/git/trees', {'base_tree': tree_sha, 'tree': tree_items})
    if 'error' in new_tree:
        return json.dumps(new_tree)

    commit = _gh_post(
        f'/repos/{repo}/git/commits',
        {
            'message': message,
            'tree': new_tree['sha'],
            'parents': [head_sha],
        },
    )
    if 'error' in commit:
        return json.dumps(commit)

    update = _gh_patch(f'/repos/{repo}/git/refs/heads/{branch}', {'sha': commit['sha']})
    if 'error' in update:
        return json.dumps(update)
    return json.dumps({'success': True, 'sha': commit['sha'][:8], 'message': message, 'files': len(files), 'repo': repo})
