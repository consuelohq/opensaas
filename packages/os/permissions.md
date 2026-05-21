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

