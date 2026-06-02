---
name: consuelo-workspace-snapshot
description: Use when an agent needs read-only Consuelo workspace context before reports, briefs, design work, dashboards, ads analysis, or cloud artifact handoff. Includes Files and Attachments as first-class app-native object references.
---

# Consuelo Workspace Snapshot

This skill reads Consuelo app data for agents. It is the first app-connection slice for Consuelo OS.

## Rules

- Read-only only. Do not create files, upload to S3, mutate records, publish, or attach/detach objects.
- Treat Consuelo app objects as source of truth.
- Include Files and Attachments in the first snapshot because downstream artifacts, reports, and design work need app-visible file references.
- Return stable object refs that downstream skills can carry into artifacts.
- Fail safely with `MISSING_CAPABILITY`, `AUTH_FAILED`, `SCHEMA_GAP`, or `QUERY_FAILED`.
- Mirage is future evaluation only; do not depend on it in this first slice.

## Required environment

- `CONSUELO_GRAPHQL_URL`
- `CONSUELO_INTERNAL_GRAPHQL_API_KEY`

Optional:

- `CONSUELO_WORKSPACE_ID`
- `CONSUELO_USER_ID`
- `CONSUELO_WORKSPACE_SNAPSHOT_QUERY` for schema-specific override while the app GraphQL contract settles.
