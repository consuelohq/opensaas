# Security stream instructions

This stream owns authentication, authorization, credentials, tenant boundaries, ingress, connector identity, provisioning, and security-sensitive runtime policy.

- Prefer fail-closed behavior when identity, authorization, tenant scope, or remote state is ambiguous.
- Test negative paths, cross-tenant isolation, replay/idempotence behavior, malformed responses, and partial-failure recovery.
- Never print secrets, bearer tokens, private keys, cookies, credential material, or customer-sensitive payloads.
- Treat live credential rotation, security-policy mutation, production ingress changes, and destructive cloud operations as explicit approval boundaries.
- Preserve unrelated rules, routes, identities, and customer state during migrations.
- Verify the real boundary after shipping: API behavior, production logs, edge routing, or the relevant security contract—not only local syntax.

Update this file only with durable Security-stream guidance. Temporary task status belongs in the workpad.
