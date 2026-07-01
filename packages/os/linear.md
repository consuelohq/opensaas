# linear API reference

this file is the single source of truth for how agents interact with linear. it covers the workspace linear tool, tokens, the graphql API, IDs, and common operations.

## workspace linear tool

the primary way to interact with linear from the workspace app:

```
workspace linear.query '{"query":"{ viewer { id name } }"}'
workspace linear.issue '{"identifier":"DEV-1489"}'
workspace linear.issues '{"search":"dialer queue"}'
workspace linear.issues '{"filter":{"priority":{"lte":2,"neq":0}}}'
workspace linear.create '{"title":"[task] add health check","description":"markdown body"}'
workspace linear.comment '{"issueId":"ISSUE-UUID","body":"looks good, merging"}'
workspace linear.update '{"issueId":"ISSUE-UUID","stateId":"d8f29981-a8ce-451d-8910-ca8c04af01b2"}'
```

through sandbox_exec:
```ts
workspace.sandbox_exec({
  command: "workspace linear.issue '{\"identifier\":\"DEV-1489\"}'",
  timeout: 120
})
```

the linear tool uses the chatgpt oauth token (`.agent/.chatgpt-token.json`). it posts as **chatgpt**, not as ko.

## tokens

| agent | token file | type | viewer name | refresh |
|-------|-----------|------|-------------|---------|
| chatgpt | `.agent/.chatgpt-token.json` | oauth (24h) | chatgpt | `bash .agent/linear-refresh.sh --chatgpt` |
| kiro | `.agent/.oauth-token.json` | oauth (24h) | kiro | `bash .agent/linear-refresh.sh` |
| ko | `$LINEAR_API_KEY` env var | personal | ko | never expires |

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
# chatgpt (state=chatgpt, client_id=9b2b83a4ca6cebc0ce9df6a2ad4ed834)
open "https://linear.app/oauth/authorize?client_id=9b2b83a4ca6cebc0ce9df6a2ad4ed834&redirect_uri=https%3A%2F%2Flinear.consuelohq.com%2Foauth%2Fcallback&response_type=code&scope=read%2Cwrite%2Cissues%3Acreate%2Ccomments%3Acreate%2Capp%3Aassignable%2Capp%3Amentionable&actor=app&prompt=consent&state=chatgpt"

# kiro (state=kiro, client_id=83e3d4cd417ac427494d5a811438c4cb)
open "https://linear.app/oauth/authorize?client_id=83e3d4cd417ac427494d5a811438c4cb&redirect_uri=https%3A%2F%2Flinear.consuelohq.com%2Foauth%2Fcallback&response_type=code&scope=read%2Cwrite%2Cissues%3Acreate%2Ccomments%3Acreate%2Capp%3Aassignable%2Capp%3Amentionable&actor=app&prompt=consent&state=kiro"
```

**gotcha:** the `state=` parameter determines which file the token is written to. `state=chatgpt` → `.chatgpt-token.json`, `state=kiro` → `.oauth-token.json`. get it wrong and you overwrite the wrong agent's token.

## graphql API

endpoint: `https://api.linear.app/graphql`

the workspace linear tool wraps this API. for raw access:
```bash
curl -s https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ issues { nodes { id title } } }"}'
```

### pagination
relay-style cursor pagination with `first`/`after`. default 50 results. use `pageInfo.hasNextPage` and `pageInfo.endCursor` to paginate:
```graphql
query { issues(first: 10, after: "cursor") { nodes { id title } pageInfo { hasNextPage endCursor } } }
```

### filtering
most list queries accept `filter`. comparators: `eq`, `neq`, `in`, `nin`, `lt`, `lte`, `gt`, `gte`, `contains`, `startsWith`. logical: `and`, `or`. example:
```graphql
query { issues(filter: { priority: { lte: 2, neq: 0 }, state: { type: { neq: "completed" } } }) { nodes { identifier title } } }
```

### attachments
link external resources to issues. URL is idempotent — same URL + same issue = update instead of create:
```graphql
mutation { attachmentCreate(input: { issueId: "UUID", title: "PR #226", url: "https://github.com/consuelohq/opensaas/pull/226" }) { success } }
```

## common operations

### issues

```bash
# list recent (dev team)
workspace linear.issues '{}'

# search
workspace linear.issues '{"search":"dialer queue"}'

# filter by priority
workspace linear.issues '{"filter":{"priority":{"lte":2,"neq":0}}}'

# get by identifier
workspace linear.issue '{"identifier":"DEV-1489"}'

# create (dev team, [task]+opensaas labels, open state — all defaults)
workspace linear.create '{"title":"[task] add health check","description":"markdown body"}'

# create with custom labels/priority
workspace linear.create '{"title":"[bug] queue crash","labels":["5676a5f9-e064-48eb-b04d-6813d7aa96b0","aed5a241-2c72-44ca-a56a-9e5eabb0644a"],"priority":1}'

# update state to in progress
workspace linear.update '{"issueId":"ISSUE-UUID","stateId":"d8f29981-a8ce-451d-8910-ca8c04af01b2"}'

# add comment
workspace linear.comment '{"issueId":"ISSUE-UUID","body":"looks good, merging"}'

# raw graphql
workspace linear.query '{"query":"{ viewer { id name } }"}'
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
- prefer `workspace linear.*` commands over raw graphql curls
