"""linear tools — read and write issues via graphql API."""

import json
import os
import urllib.request

LINEAR_API_KEY = os.environ.get("LINEAR_API_KEY", "")
LINEAR_URL = "https://api.linear.app/graphql"


def _gql(query: str, variables: dict = None) -> dict:
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(LINEAR_URL, data=body, headers={
        "Authorization": LINEAR_API_KEY,
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code} {e.read().decode()[:200]}"}


def get_issue(issue_id: str) -> str:
    """get a linear issue by identifier (e.g. DEV-123)."""
    result = _gql("""
        query($id: String!) {
            issueSearch(filter: { number: { eq: $id } }, first: 1) {
                nodes { id identifier title description state { name } priority labels { nodes { name } } assignee { name } }
            }
        }
    """, {"id": issue_id})
    # try direct identifier search
    result = _gql("""
        query($filter: IssueFilter) {
            issues(filter: $filter, first: 1) {
                nodes { id identifier title description state { name } priority labels { nodes { name } } assignee { name } }
            }
        }
    """, {"filter": {"identifier": {"eq": issue_id}}})
    data = result.get("data", {}).get("issues", {}).get("nodes", [])
    return json.dumps(data[0] if data else {"error": "not found"})


def search_issues(query: str, limit: int = 10) -> str:
    """search linear issues by text."""
    result = _gql("""
        query($term: String!, $limit: Int) {
            searchIssues(term: $term, first: $limit) {
                nodes { id identifier title state { name } priority assignee { name } }
            }
        }
    """, {"term": query, "limit": limit})
    return json.dumps(result.get("data", {}).get("searchIssues", {}).get("nodes", []))


def create_issue(title: str, team_id: str, description: str = "", label_ids: list = None, priority: int = 0) -> str:
    """create a new linear issue."""
    variables = {"input": {"title": title, "teamId": team_id, "description": description, "priority": priority}}
    if label_ids:
        variables["input"]["labelIds"] = label_ids
    result = _gql("""
        mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue { id identifier title url }
            }
        }
    """, variables)
    return json.dumps(result.get("data", {}).get("issueCreate", {}))


def update_issue(issue_id: str, title: str = None, description: str = None, state_id: str = None, priority: int = None, label_ids: list = None) -> str:
    """update an existing linear issue by UUID."""
    inp = {}
    if title:
        inp["title"] = title
    if description:
        inp["description"] = description
    if state_id:
        inp["stateId"] = state_id
    if priority is not None:
        inp["priority"] = priority
    if label_ids:
        inp["labelIds"] = label_ids
    result = _gql("""
        mutation($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
                success
                issue { id identifier title url state { name } }
            }
        }
    """, {"id": issue_id, "input": inp})
    return json.dumps(result.get("data", {}).get("issueUpdate", {}))


def comment(issue_id: str, body: str) -> str:
    """add a comment to an issue. does NOT modify the issue body."""
    result = _gql("""
        mutation($input: CommentCreateInput!) {
            commentCreate(input: $input) {
                success
                comment { id body createdAt }
            }
        }
    """, {"input": {"issueId": issue_id, "body": body}})
    return json.dumps(result.get("data", {}).get("commentCreate", {}))
