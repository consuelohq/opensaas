# linear API reference

this file is the single source of truth for how agents interact with linear. it covers tokens, the graphql API, IDs, and common operations.

## tokens

| agent | token file | type | refresh |
|-------|-----------|------|---------|
| kiro | `.agent/.oauth-token.json` | oauth (24h) | `bash .agent/linear-refresh.sh` |
| chatgpt | `.agent/.chatgpt-token.json` | oauth (24h) | `bash .agent/linear-refresh.sh --chatgpt` |
| ko | `$LINEAR_API_KEY` env var | personal | never expires |

**rule: never use `$LINEAR_API_KEY` for writes.** that posts as ko. agents use their own oauth tokens.

### reading a token
```bash
TOKEN=$(jq -r '.access_token' /Users/kokayi/Dev/opensaas/.agent/.chatgpt-token.json)
```

### refreshing
tokens auto-refresh every 12h via cron. manual refresh:
```bash
cd /Users/kokayi/Dev/opensaas && bash .agent/linear-refresh.sh --chatgpt
```

### if a token dies completely
the webhook-receiver at port 8848 handles oauth callbacks. re-authorize:
```bash
# chatgpt (state=chatgpt)
open "https://linear.app/oauth/authorize?client_id=9b2b83a4ca6cebc0ce9df6a2ad4ed834&redirect_uri=https%3A%2F%2Flinear.consuelohq.com%2Foauth%2Fcallback&response_type=code&scope=read%2Cwrite%2Cissues%3Acreate%2Ccomments%3Acreate%2Capp%3Aassignable%2Capp%3Amentionable&actor=app&prompt=consent&state=chatgpt"

# kiro (state=kiro, different oauth app)
open "https://linear.app/oauth/authorize?client_id=83e3d4cd417ac427494d5a811438c4cb&redirect_uri=https%3A%2F%2Flinear.consuelohq.com%2Foauth%2Fcallback&response_type=code&scope=read%2Cwrite%2Cissues%3Acreate%2Ccomments%3Acreate%2Capp%3Aassignable%2Capp%3Amentionable&actor=app&prompt=consent&state=kiro"
```

## graphql API

endpoint: `https://api.linear.app/graphql`

```bash
curl -s https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ viewer { id name } }"}'
```

helper function:
```bash
linear() {
  curl -s "https://api.linear.app/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"query\": \"$1\"}" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))"
}
```

## common operations

### issues

```bash
# list recent (dev team)
linear '{ issues(first: 20, filter: { team: { id: { eq: "29f5c661-da6c-4bfb-bd48-815a006ccaac" } } }, orderBy: updatedAt) { nodes { identifier title state { name } priority assignee { name } } } }'

# get by identifier
linear '{ issue(id: "DEV-123") { identifier title description state { name } labels { nodes { name } } comments { nodes { body user { name } createdAt } } } }'

# create (dev team, [task] + opensaas labels, open state)
linear 'mutation { issueCreate(input: { teamId: "29f5c661-da6c-4bfb-bd48-815a006ccaac", title: "[task] title here", description: "markdown body", stateId: "1160621c-7a00-4945-9093-47ba33862b7e", labelIds: ["756f365d-b523-4ebb-9827-fed6e64309ce", "aed5a241-2c72-44ca-a56a-9e5eabb0644a"] }) { success issue { identifier url } } }'

# update state
linear 'mutation { issueUpdate(id: "ISSUE-UUID", input: { stateId: "d8f29981-a8ce-451d-8910-ca8c04af01b2" }) { success } }'

# search
linear '{ issueSearch(query: "search terms", first: 10) { nodes { identifier title state { name } } } }'
```

### comments

```bash
# add comment
linear 'mutation { commentCreate(input: { issueId: "ISSUE-UUID", body: "markdown" }) { success } }'

# list comments
linear '{ issue(id: "DEV-123") { comments(first: 20) { nodes { body user { name } createdAt } } } }'
```

### documents

```bash
# list
linear '{ documents(first: 20) { nodes { id title project { name } updatedAt } } }'

# get
linear '{ document(id: "DOC-UUID") { id title content project { name } } }'

# create
linear 'mutation { documentCreate(input: { title: "title", content: "markdown", projectId: "PROJECT-UUID" }) { success document { id url } } }'

# update
linear 'mutation { documentUpdate(id: "DOC-UUID", input: { content: "updated markdown" }) { success } }'
```

### projects

```bash
# list
linear '{ projects(first: 20) { nodes { id name state } } }'

# get with issues and docs
linear '{ project(id: "PROJECT-UUID") { name documents { nodes { id title } } issues(first: 50) { nodes { identifier title state { name } } } } }'
```

### labels and states

```bash
# all labels
linear '{ issueLabels(first: 50) { nodes { id name } } }'

# workflow states (dev team)
linear '{ workflowStates(filter: { team: { id: { eq: "29f5c661-da6c-4bfb-bd48-815a006ccaac" } } }) { nodes { id name type } } }'
```

## IDs

### teams
| team | key | id |
|------|-----|----|
| development | DEV | `29f5c661-da6c-4bfb-bd48-815a006ccaac` |
| growth | GROW | `d923f357-397d-4416-832f-2ec2e822acdf` |

### workflow states (DEV)
| state | type | id |
|-------|------|----|
| backlog | backlog | `1b358abc-63f8-423c-815c-2f47968e4b95` |
| open | unstarted | `1160621c-7a00-4945-9093-47ba33862b7e` |
| in progress | started | `d8f29981-a8ce-451d-8910-ca8c04af01b2` |
| in review | started | `9646d767-0fa0-4163-8315-1c2a4fa9fad0` |
| done | completed | `3dce5724-2643-4151-a66b-7f7b8d152bd2` |
| canceled | canceled | `d748a0f1-9c01-4f93-b18f-de51799531de` |
| triage | triage | `113983ef-c9ed-483a-9c42-99286e6dc70b` |

### type labels
| label | id |
|-------|----|
| [task] | `756f365d-b523-4ebb-9827-fed6e64309ce` |
| [bug] | `5676a5f9-e064-48eb-b04d-6813d7aa96b0` |
| [feature] | `dd48c9f8-eedb-46fa-8508-5c8ac16ed89e` |
| [phase] | `8aedf8ef-fb52-4669-be03-3826e5bbc9bc` |
| [epic] | `888d99f4-f3e1-491e-ae65-8ef20d456f4f` |
| [spike] | `78660073-718c-407b-ae0a-db741c36886c` |
| [doc] | `2d4c1f4a-adfd-472c-a84a-8c366b9a1c87` |
| [review] | `b89ec107-7019-4ce9-90cc-770067a892cd` |
| [gtm] | `5165dbcd-f8e9-4769-81ba-6f1d4dbc2de6` |
| [skill] | `7091f9ba-b5c8-43b4-bbe1-e9626067c121` |

### repo labels
| label | id |
|-------|----|
| opensaas | `aed5a241-2c72-44ca-a56a-9e5eabb0644a` |
| web | `341245ac-397b-422c-b4b7-ea63b7f683fc` |

### projects
| project | id |
|---------|----|
| website | `a1f12448-7588-4c5f-bd22-f2d93d880d4e` |
| landing page | `4289d84f-8fd3-4a1a-9862-44dfbe1a068d` |
| agents | `af1e1d47-cf1d-449c-b25b-b947c0038435` |

## rules

- every issue gets at minimum a **type label** + **repo label**
- title format: `[type] description` (e.g. `[task] add health check endpoint`)
- default team: DEV, default state: open
- never post as ko — use the agent's own oauth token
