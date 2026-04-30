# Agents.md — opensaas agent instructions


## first things first

read `CODING-STANDARDS.md` before writing any code. every rule in that file is mandatory.

## project overview

Company: Consuelo
Repo:Opensaas
About:Teleommunication infrastructure.


## architecture

### tech stack

- **frontend**: React 18, TypeScript, Recoil (state management), Emotion (styling), Vite, astro
- **backend**: NestJS, TypeORM, PostgreSQL, Redis, GraphQL (with GraphQL Yoga)
- **monorepo**: Nx workspace managed with Yarn 4
- **background jobs**: BullMQ
- **telephony**: Twilio
- **billing**: Stripe
- **AI**: Groq/OpenAI (via openai SDK)
- **knowledge base**: pgvector (postgres-native embeddings)
- **deploy**: Docker, Railway, or AWS SAM (`template.yaml`)

### key development principles

- **functional components only** (no class components)
- **named exports only** (no default exports)
- **types over interfaces** (except when extending third-party interfaces)
- **string literals over enums** (except for GraphQL enums)
- **no 'any' type allowed** — strict TypeScript enforced
- **event handlers preferred over useEffect** for state updates
- **props down, events up** — unidirectional data flow
- **composition over inheritance**
- **no abbreviations** in variable names (`user` not `u`, `fieldMetadata` not `fm`)

### naming conventions

- **variables/functions**: camelCase
- **constants**: SCREAMING_SNAKE_CASE
- **types/classes**: PascalCase (suffix component props with `Props`, e.g. `ButtonProps`)
- **files/directories**: kebab-case with descriptive suffixes (`.component.tsx`, `.service.ts`, `.entity.ts`, `.dto.ts`, `.module.ts`)
- **TypeScript generics**: descriptive names (`TData` not `T`)
- **Proper upper vs lowercase all across work.**

### file structure

- components under 300 lines, services under 500 lines
- components in their own directories with tests and stories
- use `index.ts` barrel exports for clean imports
- import order: external libraries first, then internal (`@/`), then relative

### comments

- use short-form comments (`//`), not JSDoc blocks
- explain WHY (business logic), not WHAT
- do not comment obvious code
- multi-line comments use multiple `//` lines, not `/** */`

### state management (recoil)

- **atoms** for primitive state
- **selectors** for derived state
- **atom families** for dynamic collections
- component-specific state with React hooks (`useState`, `useReducer` for complex logic)
- GraphQL cache managed by Apollo Client
- use functional state updates: `setState(prev => prev + 1)`

### backend architecture

- **NestJS modules** for feature organization
- **TypeORM** for database ORM with PostgreSQL
- **GraphQL** API with code-first approach
- **Redis** for caching and session management
- **BullMQ** for background job processing

### database & migrations

- **PostgreSQL** as primary database
- **Redis** for caching and sessions
- **ClickHouse** for analytics (when enabled)
- always generate migrations when changing entity files
- migration names must be kebab-case (e.g. `add-agent-turn-evaluation`)
- include both `up` and `down` logic in migrations
- never delete or rewrite committed migrations

### utility helpers

use existing helpers from `twenty-shared` instead of manual type guards:

- `isDefined()`, `isNonEmptyString()`, `isNonEmptyArray()`


### code style

- use **Emotion** for styling with styled-components pattern
- follow **Nx** workspace conventions for imports
- use **Lingui** for internationalization
- apply security first, then formatting (sanitize before format)

### testing strategy

- **test behavior, not implementation** — focus on user perspective
- **test pyramid**: 70% unit, 20% integration, 10% E2E
- query by user-visible elements (text, roles, labels) over test IDs
- use `@testing-library/user-event` for realistic interactions
- descriptive test names: "should [behavior] when [condition]"
- clear mocks between tests with `jest.clearAllMocks()`




## deployment — railway



| service         | what it does                          | Dockerfile                                 |
| --------------- | ------------------------------------- | ------------------------------------------ |
| `opensaas`      | twenty-server (NestJS API + frontend) | `packages/twenty-docker/twenty/Dockerfile` |
| `twenty-worker` | BullMQ background job processor       | same Dockerfile, custom start command      |
| `postgres`      | PostgreSQL database                   | railway managed                            |
| `redis`         | Redis cache + sessions + BullMQ       | railway managed                            |

### railway Dockerfile configuration (twenty is just namining old old packages consuelo built on top of)

railway has TWO env vars for Dockerfile path — you need BOTH:

```
RAILWAY_DOCKERFILE_PATH=packages/twenty-docker/twenty/Dockerfile
NIXPACKS_DOCKERFILE_PATH=packages/twenty-docker/twenty/Dockerfile
```

**`RAILWAY_DOCKERFILE_PATH` is the one that actually matters.** without it, railway falls back to the root `Dockerfile` (opensaas API, uses `npm ci`) which fails because there's no `package-lock.json` — the monorepo uses yarn.

### twenty-worker service

the worker uses the same Dockerfile as the main server but with a custom start command override in railway dashboard settings:

```
/bin/sh -c "node dist/queue-worker/queue-worker"
```

the `/bin/sh -c` wrapper is required because the Dockerfile uses an ENTRYPOINT (`/app/entrypoint.sh`), and railway treats the start command as an ENTRYPOINT override — without the shell wrapper, env vars won't expand.



### yoga driver patch (DO NOT MODIFY)

`packages/twenty-server/patches/@graphql-yoga+nestjs+2.1.0.patch` — patches the yoga NestJS driver to support conditional schema merging (workspace + core schemas). this is the code path that calls `mergeSchemas()`. do not touch this file.

## consuelo internal instance — direct API access this is NOT the same as app.consuelohq.com this is our workspace for us to dev and work on and app.consuelohq.com is what we sell.

the internal consuelo instance at `consuelo.consuelohq.com` has a graphql API you can hit directly.

### graphql endpoints

- workspace data: `https://consuelo.consuelohq.com/graphql` — contacts, companies, lists, tasks, notes, etc.
- metadata: `https://consuelo.consuelohq.com/metadata` — object definitions, field metadata
- auth: `Authorization: Bearer $INTERNAL_CONSUELO_API_KEY` (workspace-scoped JWT token, in `.env`)

the workspace token can query/mutate workspace-level data (people, companies, etc.) but NOT core-level queries like `currentUser`. core queries require a user JWT from the login flow.

### database access (for admin operations)

when you need to bypass the API (bulk operations, feature flags, cache inspection):

- postgres public URL: `postgresql://postgres:<pw>@maglev.proxy.rlwy.net:21615/railway`
- redis public URL: `redis://default:<pw>@mainline.proxy.rlwy.net:46909`
- credentials are in the Railway service env vars (use `railway variables --json --service Postgres` or `--service Redis`)

### feature flags — cache invalidation is REQUIRED

feature flags are stored in `core."featureFlag"` table (per workspace). **but the server caches them in a 3-tier system:**

1. **local in-memory** (server process) — cleared on redeploy
2. **redis** (`engine:workspace:feature-flag:feature-flags-map:<workspaceId>:data` + `:hash`) — persists across deploys
3. **postgres** (source of truth)

**if you modify flags directly in postgres, you MUST also flush the redis cache:**

```javascript
// connect to redis public URL and delete:
redis.del(
  `engine:workspace:feature-flag:feature-flags-map:${workspaceId}:data`,
  `engine:workspace:feature-flag:feature-flags-map:${workspaceId}:hash`,
);
```

without this, the server reads stale data from redis and your DB changes are invisible. a server redeploy alone is NOT enough — it only clears tier 1 (local memory), not tier 2 (redis).

**the proper way** (if you have API access): use the `updateWorkspaceFeatureFlag` admin mutation, which calls `invalidateAndRecompute` internally and handles all cache tiers. but that requires `AdminPanelGuard` auth.

### workspace IDs

- consuelo (internal): `7d0894c1-bdb1-4dd6-9a00-78681b52d5f6`


## critical rules


1. **read CODING-STANDARDS.md** — contains all error tracking, logging, SQL, phone normalization, and code review rules
2. **never use `console.log/error/warn`** — use structured logger
3. **never interpolate user input into SQL** — parameterized queries only
4. **always normalize phone numbers** — use `normalizePhone()` from `@consuelo/contacts`
5. **all CLI commands support `--json` and `--quiet`** — check `isJson()` and the global quiet flag
6. **config lives at `~/.consuelo/config.json`** — loaded via `loadConfig()` from `packages/cli/src/config.ts`
7. **error format is consistent** — API: `{ error: { code, message } }`, CLI: `error()` + `process.exit(1)`



## route ordering

literal routes MUST come before param routes in the same prefix group. the framework registers routes in array order — first match wins.

```typescript
// ✅ correct — literal before param
{ path: '/v1/contacts/search', ... },
{ path: '/v1/contacts/import', ... },
{ path: '/v1/contacts/:id', ... },

// ❌ wrong — /:id catches "search" and "import" as id values
{ path: '/v1/contacts/:id', ... },
{ path: '/v1/contacts/search', ... },
```



## shared instances

don't create new service instances per request. instantiate once at module level or in the route factory function, then share across handlers.

```typescript
// ✅ correct — shared instance
export function callRoutes(): RouteDefinition[] {
  const dialer = new Dialer();
  return [
    { handler: async (req, res) => { await dialer.call(...); } },
  ];
}

// ❌ wrong — new instance per request
{ handler: async (req, res) => { const dialer = new Dialer(); ... } }
```

## Dockerfile — copy all workspace deps

when building a package that depends on other workspace packages, the Dockerfile must COPY all of them. check `package.json` dependencies for `@consuelo/*` packages.

```dockerfile
# if api depends on coaching, contacts, dialer, logger:
COPY packages/api/ packages/api/
COPY packages/coaching/ packages/coaching/
COPY packages/contacts/ packages/contacts/
COPY packages/dialer/ packages/dialer/
COPY packages/logger/ packages/logger/
```

## dependencies vs devDependencies vs peerDependencies

- **dependencies** — used at runtime, bundled with the package
- **devDependencies** — only needed for building/testing (types, test frameworks, build tools)
- **peerDependencies** — used at runtime but provided by the consuming app (e.g. `groq-sdk` in contacts — the app provides it)

if a package `import`s something in its source code (not just types), it must be in `dependencies` or `peerDependencies`, never only in `devDependencies`.

## catch typing

always use `catch (err: unknown)` with type guards, never `catch (err: any)`:

```typescript
// ✅ correct
catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'unknown error';
}

// ❌ wrong
catch (err: any) {
  error(err.message);
}
```

## peer dependencies — lazy imports only

if a package is in `peerDependencies` (not `dependencies`), it MUST be imported dynamically inside the function that uses it. never at the top level. top-level imports of optional deps crash the entire package for anyone who doesn't have them installed.

the pre-push `OPTIONAL_IMPORT` check enforces this automatically.

```typescript
// ❌ wrong — crashes if groq-sdk not installed
import Groq from 'groq-sdk';

export async function parseDocument(file: Buffer) {
  const groq = new Groq();
  // ...
}

// ✅ correct — only fails when actually called
export async function parseDocument(file: Buffer) {
  const { default: Groq } = await import('groq-sdk');
  const groq = new Groq();
  // ...
}
```

this also applies to barrel exports (`index.ts`). never re-export values from modules that depend on optional packages — it forces the dep on every consumer. use `export type` for types only.

```typescript
// ❌ wrong — importing this barrel crashes without @sentry/node
export { initSentry, Sentry } from './sentry.js';

// ✅ correct — types are safe, values need direct import
export type { SentryConfig } from './sentry.js';
// consumers: import { initSentry } from '@consuelo/api/sentry'
```

## no stub handlers

route handlers must return real data. if a handler isn't implemented yet, return `501 Not Implemented` — don't return hardcoded fake data that looks real.

the pre-push `STUB_HANDLER` check flags suspicious hardcoded responses in route files.

```typescript
// ❌ wrong — looks implemented but returns fake data
handler: async (req, res) => {
  res.status(200).json({ status: 'in-progress' });
};

// ✅ correct — clearly unfinished
handler: async (req, res) => {
  res
    .status(501)
    .json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Call status lookup not yet implemented',
      },
    });
};

// ✅ also fine — marked as intentional stub
handler: async (req, res) => {
  // STUB: replace with real call status check (DEV-xxx)
  res.status(200).json({ status: 'in-progress' });
};
```

## error recovery in cached clients

any pattern that lazily creates and caches a client (e.g. `getClient()`) must null out the cached reference on failure. otherwise a failed init leaves a broken client cached forever and retries are impossible.

```typescript
// ❌ wrong — if OpenAI() throws, this.client stays undefined
// but the error is swallowed and next call tries again with
// no way to distinguish "never tried" from "tried and failed"
private async getClient() {
  if (!this.client) {
    this.client = new OpenAI({ apiKey });
  }
  return this.client;
}

// ✅ correct — null on failure so retry is possible
private async getClient() {
  try {
    if (!this.client) {
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  } catch (err) {
    this.client = null;
    throw err;
  }
}
`

## API routes — NOT MOUNTED IN PRODUCTION (2026-04-05)

the opensaas API routes in `packages/api/src/routes/` (queues, calls, parallel) are express-style `RouteDefinition[]` arrays. they are **NOT registered in the twenty-server NestJS app**. hitting `/api/v1/queues` returns the frontend HTML (SPA catch-all), not JSON.

**DEV-1459** is the task to rewrite these as native NestJS controllers in `packages/twenty-server/src/engine/core-modules/consuelo-api/`. the controllers are thin wrappers — auth + request parsing + calling into `@consuelo/dialer` services. the business logic stays in the private packages.

**do NOT try to mount the express routes as middleware.** the decision is to go native NestJS.

## production auth flow for API testing

```bash
# sign in (on /metadata endpoint, NOT /graphql)
TOKEN=$(curl -s https://consuelo.consuelohq.com/metadata \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signIn(email: \"ryancaves22@gmail.com\", password: \"Consuelo2026!\") { tokens { accessOrWorkspaceAgnosticToken { token } } } }"}' \
  | jq -r '.data.signIn.tokens.accessOrWorkspaceAgnosticToken.token')
```

this returns a workspace-agnostic token. the auth mutations live on `/metadata`, not `/graphql`.


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

lesson 1: `railway ssh` output can swallow simple echo commands. don't use railway ssh
  -- sh -c 'echo VAR=$VAR' to check env vars — the output gets eaten. use railway ssh --
  env | grep VAR_NAME instead. the env vars ARE injected on deploy, they just don't show
  up with echo in some cases.

  lesson 2: APP_VERSION must match a version in the upgrade command's `allCommands`
  record. setting it to an arbitrary version will pass
  semver validation but fail with "No command found for version X."

  lesson 3: workspace `version` column must be set to the previous minor version. the
  upgrade command checks core.workspace.version and requires it to be at least one minor
  version behind APP_VERSION. if it's null (never upgraded), set it to the previous
  version (e.g. 1.17.0 for upgrading to 1.18.0).

  lesson 4: the standard application sync is the ONLY correct way to apply metadata
  changes to existing workspaces. manually inserting views/nav items into the DB creates
  broken shells with no view fields, filters, or field groups. never do it.

  lesson 5: custom-app view fields on standard-app views break the sync validator. fix:
  reassign those view fields to the standard app's applicationId before running sync.

  lesson 6: orphaned view fields (referencing deleted/moved field metadata) also crash
  the sync. check for them before running sync.

  lesson 7: "position" means different things. core.navigationMenuItem.position must be
  >= 0 per the sync validator. workspace record position (listMember rows) can be
  negative — that's twenty's prepend behavior.

# key commands

all commands run through `workspace.sandbox_exec({ command, timeout })`.

---

## 1. code quality — workspace review tools

`review.run` is the single quality gate. it runs 13 static checks, eslint, typecheck, spec compliance, confidence score, and tests.

### review.run

standard review — changed files against auto-detected base:

```
workspace review.run '{}'
```

scope to active task worktree:

```
workspace review.run '{"mine": true}'
```

skip tests (faster iteration):

```
workspace review.run '{"noTests": true}'
```

review against a specific base:

```
workspace review.run '{"base": "stream/workspace-agents"}'
```

auto-fix eslint issues:

```
workspace review.run '{"fix": true}'
```

review all files (full project scan):

```
workspace review.run '{"all": true}'
```

strict mode (surfaces hidden TS2564 errors):

```
workspace review.run '{"strict": true}'
```

**facade flags:** `fix`, `all`, `base`, `strict`, `mine`, `noTests` — all exposed. `--json` and `--quiet` are handled automatically by the facade.

**what it runs, in order:**

| step | check | details |
|------|-------|---------|
| 1 | 13 static checks | LOGGING, SENTRY, PHONE_NORM, SQL_PARAM, ERROR_HANDLING, TYPE_SAFETY, SECRETS, TODO_FIXME, IMPORT_SAFETY, ROUTE_ORDER, CATCH_TYPING, OPTIONAL_IMPORT, STUB_HANDLER |
| 2 | eslint | changed files (or all with `all: true`) |
| 3 | typecheck | `nx typecheck` on affected projects |
| 4 | spec compliance | checks against task spec |
| 5 | confidence score | reads decision engine state |
| 6 | tests | jest on affected packages (skip with `noTests: true`) |

findings are classified as "yours" (from your diff) vs "pre-existing" (already in the stream).

---

### verify

full safety gate. runs `review.run` internally, adds db migration safety checks, and stamps the result.

full verification:

```
workspace verify '{"base": "stream/workspace-agents"}'
```

skip review (db checks only):

```
workspace verify '{"noReview": true}'
```

db warnings only (don't fail on migration risks):

```
workspace verify '{"dbWarnOnly": true}'
```

dry run (preview without stamping):

```
workspace verify '{"dryRun": true}'
```

skip stamp (run checks but don't write verify.json):

```
workspace verify '{"noStamp": true}'
```

---

### ai review

sends diff + decision engine evidence to gemma via pi-proxy. posts structured findings to the PR on github. triggers automatically in tmux when `review.run` passes and a task PR exists.

review a PR and post to github:

```
workspace aiReview '{"pr": 226}'
```

preview only (don't post):

```
workspace aiReview '{"pr": 226, "noPost": true}'
```

---

### pr review

fetches all review comments from a PR (qodo, coderabbit, codex, ko, human reviewers) into `.task/reviews/<pr>.md`.

```
workspace prReview '{"pr": 226}'
```

print to stdout:

```
workspace prReview '{"pr": 226, "stdout": true}'
```

---

### file syntax checking

```
workspace checkFiles '{"files": ["packages/twenty-server/src/engine/core-modules/example.ts"]}'
```

---

## 2. development

start full dev environment (frontend + backend + worker):

```
workspace task.exec '{"command": ["yarn", "start"]}'
```

individual services:

```
workspace task.exec '{"command": ["npx", "nx", "start", "twenty-front"]}'
workspace task.exec '{"command": ["npx", "nx", "start", "twenty-server"]}'
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-server:worker"]}'
```

---

## 3. testing

`review.run` runs tests on affected packages by default. use these for targeted testing.

single test file (fast, preferred):

```
workspace task.exec '{"command": ["npx", "jest", "path/to/test.test.ts", "--config=packages/PROJECT/jest.config.mjs"]}'
```

all tests for a package:

```
workspace task.exec '{"command": ["npx", "nx", "test", "twenty-front"]}'
workspace task.exec '{"command": ["npx", "nx", "test", "twenty-server"]}'
```

integration tests with DB reset:

```
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-server:test:integration:with-db-reset"]}'
```

storybook:

```
workspace task.exec '{"command": ["npx", "nx", "storybook:build", "twenty-front"]}'
workspace task.exec '{"command": ["npx", "nx", "storybook:test", "twenty-front"]}'
```

when testing the UI end to end, click "Continue with Email" and use the prefilled credentials.

---

## 4. build

twenty-shared must be built first:

```
workspace task.exec '{"command": ["npx", "nx", "build", "twenty-shared"]}'
workspace task.exec '{"command": ["npx", "nx", "build", "twenty-front"]}'
workspace task.exec '{"command": ["npx", "nx", "build", "twenty-server"]}'
```

---

## 5. database operations

always run `db-backup.sh` before any migration, reset, or schema change. backups are saved to `.agent/backups/` and the last 5 are kept automatically.

backup and restore:

```
workspace task.exec '{"command": ["bash", "scripts/db-backup.sh"]}'
workspace task.exec '{"command": ["bash", "scripts/db-restore.sh"]}'
workspace task.exec '{"command": ["bash", "scripts/db-restore.sh", "<backup-file>"]}'
```

database management:

```
workspace task.exec '{"command": ["npx", "nx", "database:reset", "twenty-server"]}'
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-server:database:init:prod"]}'
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-server:database:migrate:prod"]}'
```

generate migration (replace `[name]` with kebab-case name):

```
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-server:typeorm", "migration:generate", "src/database/typeorm/core/migrations/common/[name]", "-d", "src/database/typeorm/core/core.datasource.ts"]}'
```

sync metadata:

```
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-server:command", "workspace:sync-metadata"]}'
```

---

## 6. graphql

generate GraphQL types (run after schema changes):

```
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-front:graphql:generate"]}'
workspace task.exec '{"command": ["npx", "nx", "run", "twenty-front:graphql:generate", "--configuration=metadata"]}'
```

---

## 7. deploy and observability

railway logs:

```
workspace railway.logs '{"service": "opensaas", "lines": 50}'
workspace railway.logs '{"service": "opensaas", "errors": true}'
workspace railway.logs '{"service": "twenty-worker", "lines": 20}'
```

redeploy:

```
workspace railway.redeploy '{"service": "opensaas"}'
workspace railway.redeploy '{"service": "opensaas", "dryRun": true}'
```

wait for deploy:

```
workspace wait '{"deploy": true}'
```

check deploy status:

```
workspace status
```

---

## 8. nx commands ( fallback only)

`review.run` wraps eslint and typecheck. use these only for isolated package debugging.

lint a single project against main:

```
workspace task.exec '{"command": ["npx", "nx", "lint:diff-with-main", "twenty-front"]}'
```

lint with auto-fix:

```
workspace task.exec '{"command": ["npx", "nx", "lint:diff-with-main", "twenty-front", "--configuration=fix"]}'
```

typecheck a single project:

```
workspace task.exec '{"command": ["npx", "nx", "typecheck", "twenty-front"]}'
workspace task.exec '{"command": ["npx", "nx", "typecheck", "twenty-server"]}'
```

format:

```
workspace task.exec '{"command": ["npx", "nx", "fmt", "twenty-front"]}'
```

---

## when to use what

| situation | command |
|-----------|---------|
| before pushing any code | `workspace review.run '{"noTests": true}'` |
| full pre-merge gate | `workspace verify '{"base": "stream/<area>"}'` |
| after review.run passes | ai review triggers automatically via tmux |
| addressing PR feedback | `workspace prReview '{"pr": N}'` then fix |
| debugging one package's types | `workspace task.exec '{"command": ["npx", "nx", "typecheck", "<project>"]}'` |
| debugging one package's lint | `workspace task.exec '{"command": ["npx", "nx", "lint:diff-with-main", "<project>"]}'` |
| checking deploy health | `workspace railway.logs '{"service": "opensaas", "errors": true}'` |
| running a single test | `workspace task.exec '{"command": ["npx", "jest", "<path>", "--config=packages/<pkg>/jest.config.mjs"]}'` |

