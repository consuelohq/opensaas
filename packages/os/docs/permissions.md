# Permissions

Every Consuelo OS skill declares a permission level in the manifest.

| Level | Meaning | Approval |
| --- | --- | --- |
| `read` | Read workspace, integration, or artifact data. | Usually not required. |
| `draft` | Create proposed content, records, or actions. | Required before commit. |
| `write` | Modify customer workspace records. | Required unless policy grants it. |
| `execute` | Run an internal process or workflow. | Depends on side effects. |
| `external` | Trigger external systems, providers, or human-facing communication. | Required. |
| `admin` | Change configuration, permissions, secrets, deployment, billing, or database state. | Required. |

Manifest fields:

```json
{
  "permission": "read",
  "requiresApproval": false,
  "writesRecords": false,
  "externalSideEffects": false
}
```

Approval policy should be visible before execution. Skills that need approval should return proposed writes or proposed actions before committing changes.

