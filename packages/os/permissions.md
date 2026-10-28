# Permissions

Consuelo OS uses manifest-declared permission levels.

## Levels

| Level | Meaning | Approval expectation |
| --- | --- | --- |
| `read` | Read existing workspace or integration data. | Usually no approval. |
| `draft` | Create proposed content or proposed records without committing them. | Approval required before committing downstream writes. |
| `write` | Modify records in the customer workspace. | Approval required unless a policy explicitly grants it. |
| `execute` | Run an internal process or workflow. | Approval depends on side effects. |
| `external` | Contact an external system, person, provider, or public API in a way that can have outside impact. | Approval required. |
| `admin` | Change OS configuration, secrets, permissions, deployment, billing, or database-level state. | Approval required. |

## Manifest fields

Every skill entry must declare:

- `permission`
- `requiresApproval`
- `writesRecords`
- `externalSideEffects`

These fields make the permission decision visible before a skill executes.

## Connection authorization

An authenticated MCP connection receives permission to enter the OS facade separately from permission to perform a specific action.

- `route:/mcp:read` permits access to the MCP route and discovery surface.
- `os:tools` permits calls to tools that exist in the generated OS tool manifest.
- `mcp:call` is the compatibility grant for existing OS OAuth connections and has the same facade-entry meaning for known tools.
- Exact scopes such as `tool:status:read` and category wildcards such as `tool:*:write` remain available for deliberately restricted credentials.

The facade grant never makes an unknown tool valid and never grants a non-tool route. Tool names and action categories are resolved from the generated manifest before the connection grant is evaluated.

## Action authorization

After a connection is authorized to call a known tool, the tool still enforces its own action contract. This includes manifest permissions, `requiresApproval`, input validation, task-session binding, verification stamps, explicit approval fields, provider permissions, and dangerous-operation guardrails.

Connection scopes answer: **may this authenticated client call the OS facade?**

Tool policy answers: **may this exact action execute with these inputs and approvals?**

Do not add tool-by-tool exceptions to connection scope matching. Add action-specific safety to the tool or policy layer that owns the action.

