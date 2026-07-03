## First things first

Read `CODING-STANDARDS.md` before writing code. Those rules are mandatory.

This file contains repo-specific knowledge for the OpenSaaS codebase. It does not replace the task workflow skill or worker-agent engineering standards skill.

Use this file for architecture, package conventions, deployment facts, production/internal-instance details, and known repo gotchas.

## Project overview

Company: Consuelo  
Repo: OpenSaaS  
Purpose: telecommunication infrastructure and Consuelo product development.

This repo is built on top of Twenty. Some package names still contain `twenty-*`; those are historical naming artifacts. Treat Consuelo behavior and current repo conventions as the source of truth.

## Architecture

### Tech stack

- Frontend: React 18, TypeScript, Recoil, Emotion, Vite, Astro
- Backend: NestJS, TypeORM, PostgreSQL, Redis, GraphQL with GraphQL Yoga
- Monorepo: Nx workspace managed with Yarn 4
- Background jobs: BullMQ
- Telephony: Twilio
- Billing: Stripe
- AI: Groq/OpenAI via OpenAI SDK-compatible clients
- Knowledge base: pgvector
- Deploy: Docker, Railway, AWS SAM where applicable

### Major runtime services

| Service         | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `opensaas`      | Main Twenty/Consuelo server, NestJS API, frontend |
| `twenty-worker` | BullMQ background job processor                   |
| `postgres`      | Railway-managed PostgreSQL                        |
| `redis`         | Railway-managed Redis for cache, sessions, BullMQ |

## Core codebase rules

These are repo-specific reminders. Full style and implementation standards live in `CODING-STANDARDS.md`.

- Functional React components only.
- Named exports only.
- Prefer `type` over `interface`, except when extending third-party interfaces.
- Prefer string literal unions over enums, except GraphQL enums.
- No `any` or `as any`.
- Use `catch (err: unknown)` with type guards.
- Use event handlers and derived state before reaching for `useEffect`.
- Props down, events up.
- Composition over inheritance.
- No unclear abbreviations.
- Keep proper uppercase/lowercase naming across the codebase.
- Use short `//` comments that explain why, not what.
- Do not use `console.log`, `console.warn`, or `console.error` in runtime code. Use structured logging.
- Never interpolate user input into SQL. Use parameterized queries.
- Always normalize phone numbers with `normalizePhone()` from `@consuelo/contacts` where phone normalization is needed.

## Naming conventions

- Variables/functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/classes: `PascalCase`
- Component props: suffix with `Props`, for example `ButtonProps`
- Files/directories: kebab-case with descriptive suffixes:
  - `.component.tsx`
  - `.service.ts`
  - `.entity.ts`
  - `.dto.ts`
  - `.module.ts`
- TypeScript generics: descriptive names like `TData`, not bare `T` unless the meaning is obvious and local.

## Structure conventions

- Components should usually stay under 300 lines.
- Services should usually stay under 500 lines.
- Components should live in their own directories with tests and stories when applicable.
- Use `index.ts` barrel exports for clean imports, but do not re-export values from modules that depend on optional peer dependencies.
- Import order:
  1. External libraries
  2. Internal aliases such as `@/`
  3. Relative imports

## Frontend conventions

- Use Emotion for styling with the project’s styled-components pattern.
- Use Lingui for internationalization.
- Query by user-visible elements in tests: text, roles, labels.
- Prefer `@testing-library/user-event` for realistic interactions.
- Test behavior, not implementation details.
- Use descriptive test names: `should [behavior] when [condition]`.
- Clear mocks between tests with `jest.clearAllMocks()`.

## State management

- Use Recoil atoms for primitive shared state.
- Use selectors for derived state.
- Use atom families for dynamic collections.
- Use component-local React state for local state.
- Use `useReducer` for complex local transitions.
- Use functional state updates: `setState((previousValue) => nextValue)`.
- GraphQL cache is managed by Apollo Client.

## Backend conventions

- Use NestJS modules for feature organization.
- Use TypeORM with PostgreSQL.
- Use GraphQL code-first patterns where the existing package does.
- Use Redis for caching and sessions.
- Use BullMQ for background processing.
- Keep domain logic separated from side effects.
- Prefer existing module/service patterns over new architecture.

## Database and migrations

- PostgreSQL is the primary database.
- Redis is used for caching, sessions, and BullMQ.
- ClickHouse is used for analytics when enabled.
- Always generate migrations when changing entity files.
- Migration names must be kebab-case, for example `add-agent-turn-evaluation`.
- Include both `up` and `down` logic in migrations.
- Never delete or rewrite committed migrations.
- Run a database backup before migration, reset, or schema-changing operations.

## Useful helpers

Use existing helpers from `twenty-shared` instead of manual type guards when applicable:

- `isDefined()`
- `isNonEmptyString()`
- `isNonEmptyArray()`

## API routes — current production reality

The Express-style OpenSaaS API routes in:

```text
packages/api/src/routes/
```

are `RouteDefinition[]` arrays.

They are not registered in the production Twenty Server NestJS app. Hitting paths such as `/api/v1/queues` may return frontend HTML via the SPA catch-all, not JSON.

The chosen direction is to rewrite these as native NestJS controllers in:

```text
packages/twenty-server/src/engine/core-modules/consuelo-api/
```

The controllers should be thin wrappers:

```text
auth + request parsing + call into @consuelo/* services
```

Business logic should stay in the private Consuelo packages.

Do not try to mount the Express routes as middleware. The decision is native NestJS.

Related task: `DEV-1459`.

### Route ordering

Literal routes must come before parameter routes in the same prefix group. The framework registers routes in array order, and first match wins.

Correct:

```ts
{ path: '/v1/contacts/search', ... },
{ path: '/v1/contacts/import', ... },
{ path: '/v1/contacts/:id', ... },
```

Wrong:

```ts
{ path: '/v1/contacts/:id', ... },
{ path: '/v1/contacts/search', ... },
{ path: '/v1/contacts/import', ... },
```

`/:id` catches `"search"` and `"import"` if it comes first.

### Shared service instances

Do not create new service instances per request unless the service is intentionally request-scoped.

Correct:

```ts
export function callRoutes(): RouteDefinition[] {
  const dialer = new Dialer();

  return [
    {
      handler: async (request, response) => {
        await dialer.call(...);
      },
    },
  ];
}
```

Wrong:

```ts
{
  handler: async (request, response) => {
    const dialer = new Dialer();
    await dialer.call(...);
  },
}
```

### Dockerfile workspace dependency rule

When building a package that depends on other workspace packages, the Dockerfile must copy all runtime workspace dependencies.

Check `package.json` for `@consuelo/*` dependencies.

Example:

```dockerfile
COPY packages/api/ packages/api/
COPY packages/coaching/ packages/coaching/
COPY packages/contacts/ packages/contacts/
COPY packages/dialer/ packages/dialer/
COPY packages/logger/ packages/logger/
```

If a copied package imports another workspace package at runtime, that dependency must also be copied.

### dependencies vs devDependencies vs peerDependencies

- `dependencies`: used at runtime and bundled with the package.
- `devDependencies`: only needed for local build/test/type tooling.
- `peerDependencies`: used at runtime but provided by the consuming app.

If source code imports a package as a runtime value, it must be in `dependencies` or `peerDependencies`, never only `devDependencies`.

Type-only imports can be backed by dev dependencies when they are not required at runtime.

### Peer dependencies require lazy imports

If a package is in `peerDependencies`, import it dynamically inside the function that uses it. Do not import it at the top level.

Wrong:

```ts
import Groq from 'groq-sdk';

export async function parseDocument(file: Buffer) {
  const groq = new Groq();
}
```

Correct:

```ts
export async function parseDocument(file: Buffer) {
  const { default: Groq } = await import('groq-sdk');
  const groq = new Groq();
}
```

This also applies to barrel exports. Do not re-export runtime values from modules that depend on optional packages.

Wrong:

```ts
export { initSentry, Sentry } from './sentry.js';
```

Correct:

```ts
export type { SentryConfig } from './sentry.js';
```

Consumers that need runtime values should import from the explicit module path that owns the optional dependency.

The pre-push `OPTIONAL_IMPORT` check enforces this.

### No stub handlers

Route handlers must return real data.

If a handler is not implemented, return `501 Not Implemented`. Do not return fake hardcoded data that looks real.

Wrong:

```ts
handler: async (request, response) => {
  response.status(200).json({ status: 'in-progress' });
};
```

Correct:

```ts
handler: async (request, response) => {
  response.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Call status lookup not yet implemented',
    },
  });
};
```

Intentional temporary stubs must be clearly marked with `STUB:` and a ticket.

```ts
handler: async (request, response) => {
  // STUB: replace with real call status check (DEV-xxx)
  response.status(200).json({ status: 'in-progress' });
};
```

The pre-push `STUB_HANDLER` check flags suspicious hardcoded responses in route files.

### Error recovery in cached clients

Any pattern that lazily creates and caches a client must reset the cached reference on initialization failure.

Wrong:

```ts
private async getClient() {
  if (!this.client) {
    this.client = new OpenAI({ apiKey });
  }

  return this.client;
}
```

Correct:

```ts
private async getClient() {
  try {
    if (!this.client) {
      this.client = new OpenAI({ apiKey });
    }

    return this.client;
  } catch (err: unknown) {
    this.client = null;
    throw err;
  }
}
```

Without this, failed initialization can leave a broken or ambiguous cached client state and make retries unreliable.

### Error format

Keep errors consistent.

API error shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

CLI errors should use the project error helper and exit non-zero.

All CLI commands should support `--json` and `--quiet` where the command is part of the project CLI surface.

### Config location

Consuelo CLI config lives at:

```text
~/.consuelo/config.json
```

Load it through `loadConfig()` from:

```text
packages/cli/src/config.ts
```

Do not hand-roll parallel config loading.

## Railway deployment

### Services

| Service         | Purpose                | Dockerfile                                 |
| --------------- | ---------------------- | ------------------------------------------ |
| `opensaas`      | Twenty/Consuelo server | `packages/twenty-docker/twenty/Dockerfile` |
| `twenty-worker` | BullMQ worker          | Same Dockerfile, custom start command      |
| `postgres`      | PostgreSQL             | Railway managed                            |
| `redis`         | Redis                  | Railway managed                            |

### Dockerfile path env vars

Railway has two Dockerfile path env vars. Set both:

```env
RAILWAY_DOCKERFILE_PATH=packages/twenty-docker/twenty/Dockerfile
NIXPACKS_DOCKERFILE_PATH=packages/twenty-docker/twenty/Dockerfile
```

`RAILWAY_DOCKERFILE_PATH` is the one that actually matters.

Without it, Railway may fall back to the root Dockerfile, which can fail because this monorepo uses Yarn and does not have a root `package-lock.json`.

### twenty-worker start command

The worker uses the same Dockerfile as the main server but needs a custom Railway start command:

```sh
/bin/sh -c "node dist/queue-worker/queue-worker"
```

The `/bin/sh -c` wrapper is required because the Dockerfile uses an entrypoint:

```text
/app/entrypoint.sh
```

Railway treats the start command as an entrypoint override. Without the shell wrapper, env vars may not expand correctly.

### Railway SSH lesson

`railway ssh` output can swallow simple `echo` commands.

Do not use:

```sh
railway ssh -- sh -c 'echo VAR=$VAR'
```

to verify env vars.

Use:

```sh
railway ssh -- env | grep VAR_NAME
```

Env vars may be injected correctly even when `echo` output appears missing.

### Yoga driver patch (DO NOT MODIFY)

packages/twenty-server/patches/@graphql-yoga+nestjs+2.1.0.patch — patches the yoga NestJS driver to support conditional schema merging (workspace + core schemas). this is the code path that calls mergeSchemas(). do not touch this file.

## Internal Consuelo instance

The internal Consuelo workspace is:

```text
https://consuelo.consuelohq.com
```

This is not the same as:

```text
https://app.consuelohq.com
```

`consuelo.consuelohq.com` is the internal development/work workspace. `app.consuelohq.com` is the product customers use.

### GraphQL endpoints

Workspace data:

```text
https://consuelo.consuelohq.com/graphql
```

Contacts, companies, lists, tasks, notes, and other workspace-level data.

Metadata:

```text
https://consuelo.consuelohq.com/metadata
```

Object definitions, field metadata, and auth mutations.

Auth:

```http
Authorization: Bearer $INTERNAL_CONSUELO_API_KEY
```

The workspace token can query/mutate workspace-level data but cannot run core-level queries like `currentUser`. Core queries require a user JWT from the login flow.

### Production auth flow for API testing

Auth mutations live on `/metadata`, not `/graphql`.

```sh
TOKEN=$(curl -s https://consuelo.consuelohq.com/metadata \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signIn(email: \"<email>\", password: \"<password>\") { tokens { accessOrWorkspaceAgnosticToken { token } } } }"}' \
  | jq -r '.data.signIn.tokens.accessOrWorkspaceAgnosticToken.token')
```

Do not hardcode real credentials in committed files or chat-visible artifacts.

### Database access for admin operations

Use direct database or Redis access only when the API path is insufficient, such as:

- Bulk operations
- Feature flags
- Cache inspection
- Emergency admin repair

Credentials are in Railway service env vars. Retrieve through Railway tooling rather than hardcoding secrets.

Services:

- Postgres
- Redis

Use Railway variables or the workspace deployment tooling to inspect connection values. Do not paste full credentials into logs, PRs, or workpads.

### Workspace IDs

Internal Consuelo workspace:

```text
7d0894c1-bdb1-4dd6-9a00-78681b52d5f6
```

## Feature flags and cache invalidation

Feature flags are stored in:

```text
core."featureFlag"
```

They are cached in three tiers:

1. Local in-memory server process
2. Redis
3. PostgreSQL source of truth

Redis keys:

```text
engine:workspace:feature-flag:feature-flags-map:<workspaceId>:data
engine:workspace:feature-flag:feature-flags-map:<workspaceId>:hash
```

If feature flags are modified directly in PostgreSQL, Redis cache must also be flushed. A server redeploy only clears local memory, not Redis.

When possible, use the admin mutation that calls `invalidateAndRecompute`, because it handles cache invalidation correctly. That path requires `AdminPanelGuard` auth.

If direct Redis invalidation is required, delete both keys for the workspace.

## Standard application sync lessons

The standard application sync is the correct way to apply metadata changes to existing workspaces.

Do not manually insert views, navigation items, or related metadata rows into the database to simulate a standard app update. Manual insertion can create broken shells with missing view fields, filters, or field groups.

Known sync lessons:

1. `APP_VERSION` must match a version in the upgrade command’s `allCommands` record. An arbitrary semver-valid value can still fail with `No command found for version X`.
2. `core.workspace.version` must be set to the previous minor version before upgrade. If it is null, set it to the previous version, for example `1.17.0` when upgrading to `1.18.0`.
3. Standard application sync is the only correct way to apply metadata changes to existing workspaces.
4. Custom-app view fields on standard-app views break the sync validator. Reassign those view fields to the standard app’s `applicationId` before running sync.
5. Orphaned view fields referencing deleted or moved field metadata can crash sync. Check for them before running sync.
6. `position` means different things in different tables:
   - `core.navigationMenuItem.position` must be `>= 0`.
   - Workspace record positions such as `listMember` rows can be negative because Twenty prepends records.

## Nx guidance

This repo uses Nx.

For navigating projects, targets, dependencies, and affected tasks, prefer Nx-aware tooling where available.

When running tasks such as build, lint, test, typecheck, or e2e, prefer Nx targets over invoking underlying tools directly.

Use the repo package manager rather than a global Nx install.

Examples:

```sh
yarn nx run twenty-front:test
yarn nx run twenty-server:typecheck
yarn nx affected --target=typecheck
```

Do not guess unfamiliar Nx flags. Check help or Nx docs first.

For scaffolding or generators, use the dedicated Nx generation workflow/tooling before changing project structure manually.

## Build and generation notes

Build `twenty-shared` before packages that depend on it when doing isolated builds.

GraphQL type generation is required after schema changes. Use the existing Nx targets for the relevant frontend/server package.

Do not manually edit generated GraphQL artifacts unless the generator is broken and the workaround is documented.

## Testing strategy

Use the smallest meaningful test first, then broader gates.

General target shape:

- Unit tests for pure logic
- Integration tests for service boundaries
- E2E tests for user-visible or multi-service behavior
- Service-backed E2E for callbacks, queues, locks, jobs, external providers, and runtime side effects

Testing guidelines:

- Test behavior, not implementation.
- Prefer user-visible queries over test IDs.
- Use realistic user events.
- Clear mocks between tests.
- Include both success and failure paths when the code owns failure handling.

## Deployment and observability

Use workspace deployment tools for Railway logs, redeploys, and status checks where available.

Relevant services:

- `opensaas`
- `twenty-worker`
- `postgres`
- `redis`

When debugging production or Railway behavior:

- Check the deployed commit
- Check service-specific logs
- Check worker logs separately from server logs
- Verify env vars through Railway-safe methods
- Avoid printing secrets
- Redact phone numbers and tokens

## Security and secrets

- Never hardcode secrets.
- Never paste full tokens, passwords, database URLs, or phone numbers into committed files.
- Prefer presence checks, suffix checks, counts, and redacted values.
- Sanitize before formatting.
- Security first, formatting second.

## Documentation package

Public docs live in `packages/documentation`, the Bun-owned Astro/Starlight app for `docs.consuelohq.com`. Before docs work, read `packages/documentation/README.md`. Do not edit or recreate legacy Mintlify docs, generated `docs.json`, or committed machine-translated locale trees.
