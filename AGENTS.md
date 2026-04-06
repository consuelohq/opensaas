# CLAUDE.md — opensaas agent instructions

## first things first

read `CODING-STANDARDS.md` before writing any code. every rule in that file is mandatory.

## project overview

Consuelo - Teleommunication infrastructure.

## key commands

### development

```bash
# start development environment (frontend + backend + worker)
yarn start

# individual package development
npx nx start twenty-front     # frontend dev server (vite, HMR)
npx nx start twenty-server    # backend server (nestjs)
npx nx run twenty-server:worker  # background worker
```

### testing

```bash
# preferred: run a single test file (fast)
npx jest path/to/test.test.ts --config=packages/PROJECT/jest.config.mjs

# run all tests for a package
npx nx test twenty-front      # frontend unit tests
npx nx test twenty-server     # backend unit tests
npx nx run twenty-server:test:integration:with-db-reset  # integration tests with DB reset

# storybook
npx nx storybook:build twenty-front
npx nx storybook:test twenty-front

# when testing the UI end to end, click on "Continue with Email" and use the prefilled credentials.
```

### code quality

```bash
# linting (diff with main — fastest, always prefer this)
npx nx lint:diff-with-main twenty-front
npx nx lint:diff-with-main twenty-server
npx nx lint:diff-with-main twenty-front --configuration=fix  # auto-fix

# linting (full project — slower, use only when needed)
npx nx lint twenty-front
npx nx lint twenty-server

# type checking
npx nx typecheck twenty-front
npx nx typecheck twenty-server

# format code
npx nx fmt twenty-front
npx nx fmt twenty-server
```

### build

```bash
# twenty-shared must be built first
npx nx build twenty-shared
npx nx build twenty-front
npx nx build twenty-server
```

### database operations

> **IMPORTANT:** always run `bash scripts/db-backup.sh` before any migration, reset, or schema change. backups are saved to `.agent/backups/` and the last 5 are kept automatically.

```bash
# backup/restore (run backup BEFORE any db work)
bash scripts/db-backup.sh                    # snapshot current database
bash scripts/db-restore.sh                   # list available backups
bash scripts/db-restore.sh <backup-file>     # restore from backup

# database management
npx nx database:reset twenty-server         # reset database
npx nx run twenty-server:database:init:prod # initialize database
npx nx run twenty-server:database:migrate:prod # run migrations

# generate migration (replace [name] with kebab-case descriptive name)
npx nx run twenty-server:typeorm migration:generate src/database/typeorm/core/migrations/common/[name] -d src/database/typeorm/core/core.datasource.ts

# sync metadata
npx nx run twenty-server:command workspace:sync-metadata
```

### graphql

```bash
# generate GraphQL types (run after schema changes)
npx nx run twenty-front:graphql:generate
npx nx run twenty-front:graphql:generate --configuration=metadata
```

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

### auth system (twenty's built-in JWT)

single `APP_SECRET` env var. per-token secrets derived via `sha256(APP_SECRET + workspaceId + tokenType)`. implemented in `packages/twenty-server/src/engine/core-modules/jwt/services/jwt-wrapper.service.ts`.

- access token: 30m expiry, payload: `{ sub, type: "ACCESS", userId, workspaceId, workspaceMemberId, userWorkspaceId, authProvider, isImpersonating }`
- refresh token: 60d expiry, stored in DB as AppToken entities with reuse detection
- frontend stores tokens in cookies (key: `tokenPair`), NOT localStorage
- no clerk, no separate auth provider

## development workflow

IMPORTANT: Use Context7 for code generation, setup or configuration steps, or library/API documentation. Automatically use the Context7 MCP tools to resolve library IDs and get library docs without waiting for explicit requests.

### before making changes

1. always run linting (`lint:diff-with-main`) and type checking after code changes
2. test changes with relevant test suites (prefer single-file test runs)
3. ensure database migrations are generated for entity changes
4. check that GraphQL schema changes are backward compatible
5. run `graphql:generate` after any GraphQL schema changes

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

### CI environment (GitHub Actions)

when running in CI, the dev environment is **not** pre-configured. dependencies are installed but builds, env files, and databases are not set up.

- **before running tests, builds, lint, type checks, or DB operations**, run: `bash packages/twenty-utils/setup-dev-env.sh`
- **skip the setup script** for tasks that only read code — architecture questions, code review, documentation, etc.
- the script is idempotent and safe to run multiple times.

### keyboard shortcuts

twenty has a full hotkey system built in. **always use it** — never raw `addEventListener` for keyboard shortcuts.

| hook                         | use case                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| `useGlobalHotkeys`           | single key or modifier combos (e.g. `m` for mute)            |
| `useGlobalHotkeysSequence`   | two-key sequences (e.g. `g` then `s` = go to settings)       |
| `useGoToHotkeys`             | navigation via `g+key` (wraps sequence hook + `useNavigate`) |
| `useHotkeysOnFocusedElement` | context-scoped (only fires when specific element focused)    |

all hooks live in `packages/twenty-front/src/modules/ui/utilities/hotkey/hooks/`.

dialer shortcuts use `useDialerHotkeys` hook (`packages/twenty-front/src/modules/dialer/hooks/useDialerHotkeys.ts`) — takes callbacks, registers via `useGlobalHotkeys`.

**full shortcut reference + planned shortcuts for all phases:** `.kiro/docs/KEYBOARD-SHORTCUTS.md`

## deployment — railway

production is deployed on railway at `app.consuelohq.com`. four services:

| service         | what it does                          | Dockerfile                                 |
| --------------- | ------------------------------------- | ------------------------------------------ |
| `opensaas`      | twenty-server (NestJS API + frontend) | `packages/twenty-docker/twenty/Dockerfile` |
| `twenty-worker` | BullMQ background job processor       | same Dockerfile, custom start command      |
| `postgres`      | PostgreSQL database                   | railway managed                            |
| `redis`         | Redis cache + sessions + BullMQ       | railway managed                            |

### railway Dockerfile configuration

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

### railway CLI cheat sheet

```bash
railway logs --service opensaas          # runtime logs
railway logs --service opensaas --build  # build logs
railway variables --service opensaas     # list env vars
railway variables --set "KEY=value" --service opensaas  # set env var
railway redeploy --service opensaas      # trigger redeploy
```

note: the railway CLI cannot delete env vars or set start commands. use the dashboard for those. use this, stop suggesting we do things when this is in your tool kit, mainly for logs and verification. and make sure we are on the right deploy, not a prior deploy

## patches & workarounds

### @graphql-tools/merge — null fields in applyExtensions (feb 2026)

**patch file:** `packages/twenty-server/patches/@graphql-tools+merge+9.1.7.patch`

`mergeSchemas()` crashes with `Cannot convert undefined or null to object` when `Object.entries()` is called on `data.fields`, `data.values`, or `fieldData.arguments` that are null/undefined in the `applyExtensions()` function. this only surfaces with large workspace schemas (551+ types).

**fix:** yarn resolution in root `package.json` forces a single patched copy across the entire monorepo:

```json
"resolutions": {
  "@graphql-tools/merge": "patch:@graphql-tools/merge@9.1.7#./packages/twenty-server/patches/@graphql-tools+merge+9.1.7.patch"
}
```

**critical:** the resolution MUST be in root `package.json`, not in `packages/twenty-server/package.json`. yarn can create nested copies of transitive deps (e.g. `node_modules/@graphql-tools/schema/node_modules/@graphql-tools/merge/`). a direct dep only patches the top-level copy. a root resolution forces deduplication to a single patched copy.

### patching transitive dependencies — the pattern

when you need to patch a transitive dep in this monorepo:

1. create the patch file in `packages/twenty-server/patches/`
2. add a `resolutions` entry in ROOT `package.json` (not the package's `package.json`)
3. use the `patch:` protocol: `"pkg": "patch:pkg@version#./packages/twenty-server/patches/file.patch"`
4. run `yarn install` and verify with `grep` that the fix is in `node_modules/`
5. verify there are NO nested copies: `ls node_modules/<parent>/node_modules/<pkg>/ 2>/dev/null` should return nothing

**DO NOT use `sed` on patch files** — it corrupts diff hunk headers. edit patch files with a proper editor or regenerate with `diff -u`.

### yoga driver patch (DO NOT MODIFY)

`packages/twenty-server/patches/@graphql-yoga+nestjs+2.1.0.patch` — patches the yoga NestJS driver to support conditional schema merging (workspace + core schemas). this is the code path that calls `mergeSchemas()`. do not touch this file.

## graphql schema architecture

twenty's graphql has two schema scopes:

- **core** — always available, no auth needed. metadata operations, auth mutations.
- **workspace** — requires auth token. all business data (companies, people, opportunities, etc.). 551+ types, built dynamically per workspace from metadata.

the yoga driver patch merges these at request time:

1. core schema is always loaded
2. if request has a valid auth token, workspace schema is fetched (cached in redis)
3. `mergeSchemas({ schemas: [coreSchema, workspaceSchema] })` produces the final schema

key file: `packages/twenty-server/src/engine/api/graphql/graphql-config/graphql-config.service.ts`

- `resolverSchemaScope: 'core'` — for the main graphql config (core schema)
- `resolverSchemaScope: 'metadata'` — for the metadata graphql config
- workspace schema is returned by `conditionalSchema` callback in the yoga driver patch

## consuelo internal instance — direct API access

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
- alex moreno: `8eaedb39-991a-47fc-8337-00a195483851`

## critical rules

0. **NEVER switch branches on the main worktree** — `/Users/kokayi/Dev/opensaas` is ko's working directory. no `git checkout`, `git switch`, `git merge`, `git reset`, or any branch-changing operation without pre-flight checks (`git status`, `pgrep -f opencode`, `git branch --show-current`). **default to github API** (`gh api`) for editing files on other branches — create blobs → trees → commits directly on the remote, zero local impact. worktrees (`git worktree add /tmp/opensaas-<task> <branch>`) are the fallback when you need a real filesystem (builds, tests, lint). main worktree is last resort, only when ko explicitly says to or the work IS on the current branch.
1. **read CODING-STANDARDS.md** — contains all error tracking, logging, SQL, phone normalization, and code review rules
2. **never use `console.log/error/warn`** — use structured logger
3. **never interpolate user input into SQL** — parameterized queries only
4. **always normalize phone numbers** — use `normalizePhone()` from `@consuelo/contacts`
5. **all CLI commands support `--json` and `--quiet`** — check `isJson()` and the global quiet flag
6. **config lives at `~/.consuelo/config.json`** — loaded via `loadConfig()` from `packages/cli/src/config.ts`
7. **error format is consistent** — API: `{ error: { code, message } }`, CLI: `error()` + `process.exit(1)`

## pre-push code review — 16 automated checks

`scripts/code-review.sh` (also `npm run review`) runs on every push. all 16 must pass. checks all changed .ts/.tsx files across all packages.

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

the pre-push `ROUTE_ORDER` check enforces this automatically.

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

## optional / peer dependencies — lazy imports only

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
```

## git

- suelo-kiro[bot] is the **committer**, not the author. ko (kokayicobb) must remain the author for github credit:
  ```bash
  GIT_COMMITTER_NAME="suelo-kiro[bot]" GIT_COMMITTER_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com" git commit -m "message"
  ```
- **never** use `--author="suelo-kiro[bot] ..."` — that steals ko's commit credit
- commit format: `type(scope): description`
- one PR per feature

## github API — remote branch edits (no local checkout)

**this is the default for editing files on any branch that isn't the current local branch.** never `git checkout` on the main worktree to fix a PR or push changes to a remote branch. use `gh api` instead.

### the pattern: blob → tree → commit → update ref

```bash
# 1. get current branch HEAD
HEAD_SHA=$(gh api repos/consuelohq/opensaas/git/ref/heads/<branch> --jq '.object.sha')
TREE_SHA=$(gh api repos/consuelohq/opensaas/git/commits/$HEAD_SHA --jq '.tree.sha')

# 2. create blobs for each file you're changing
BLOB_SHA=$(gh api repos/consuelohq/opensaas/git/blobs \
  -f content="$(base64 < /tmp/fixed-file.ts)" \
  -f encoding=base64 --jq '.sha')

# 3. create a new tree with the updated files
NEW_TREE=$(gh api repos/consuelohq/opensaas/git/trees --input - <<EOF | jq -r '.sha'
{
  "base_tree": "$TREE_SHA",
  "tree": [
    {"path": "packages/api/src/routes/queues.ts", "mode": "100644", "type": "blob", "sha": "$BLOB_SHA"}
  ]
}
EOF
)

# 4. create the commit (ko as author, suelo-kiro[bot] as committer)
COMMIT_SHA=$(gh api repos/consuelohq/opensaas/git/commits --input - <<EOF | jq -r '.sha'
{
  "message": "fix(scope): description",
  "tree": "$NEW_TREE",
  "parents": ["$HEAD_SHA"],
  "author": {"name": "kokayicobb", "email": "kokayicobb@users.noreply.github.com", "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"},
  "committer": {"name": "suelo-kiro[bot]", "email": "260422584+suelo-kiro[bot]@users.noreply.github.com", "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
}
EOF
)

# 5. update the branch ref
gh api repos/consuelohq/opensaas/git/refs/heads/<branch> -X PATCH -f sha=$COMMIT_SHA
```

### reading files from a remote branch

```bash
# get file content (base64 decoded)
gh api repos/consuelohq/opensaas/contents/<path>?ref=<branch> --jq '.content' | base64 -d > /tmp/file.ts

# get file SHA (for reference)
gh api repos/consuelohq/opensaas/contents/<path>?ref=<branch> --jq '.sha'
```

### when to use what

| scenario | method |
|----------|--------|
| fix files on a PR branch | github API (blob → tree → commit) |
| code review follow-ups | github API |
| need to run builds/tests/lint | `git worktree add /tmp/opensaas-<task> <branch>` |
| work IS on the current local branch | local git (with pre-flight checks) |
| create a PR | `gh pr create` (works without checkout) |
| post PR comments/reviews | `gh pr comment` / `gh pr review` |

ALl text must be localized with Lingui

# MCP tools — USE THEM

you have MCP servers available. learn them, use them, stop doing things the hard way.

## codemode (`execute_code`) — batch file operations

**this is your most important token-saving tool.** every time you're about to make 2+ sequential tool calls that touch files, search, or bash — stop and use codemode instead. one round-trip instead of many.

```javascript
// available async functions (all paths relative to workingDirectory):
await readFile('src/foo.ts')                    // full file
await readFile('src/foo.ts', 10, 30)            // lines 10-30
await writeFile('src/foo.ts', content)           // create/overwrite
await editFile('src/foo.ts', 'old text', 'new') // str_replace
await appendFile('src/foo.ts', '\nnew line')
await insertLine('src/foo.ts', 15, 'new code')  // insert after line 15
await readDir('src/', 2)                         // list with depth
await grep('pattern', 'src/', { include: '*.ts' })
await glob('*.test.ts', 'src/')
await bash('npm run build')                      // shell commands
```

**when to use codemode:**
- reading 2+ files → `Promise.all([readFile(a), readFile(b), readFile(c)])`
- grep → read → edit chains (the whole flow in one call)
- batch edits across multiple files
- any sequence where one result feeds into the next
- investigating a codebase (readDir + readFile several files)

**the token math:** 5 file reads = 5 tool calls = 5 round-trips. with codemode: 1 call = 1 round-trip. each saved round-trip saves the full context window being re-sent.

**return only what matters** — don't return a 500-line file when you need 20 lines:
```javascript
const content = await readFile('src/big-service.ts');
const relevant = content.split('\n').filter(l => l.includes('transferCall')).join('\n');
return { matchingLines: relevant, totalLines: content.split('\n').length };
```

## context7 — up-to-date library docs

when writing code that uses any library/framework, look up the latest docs instead of relying on training data. prevents hallucinated APIs.

```
// 1. resolve the library ID
resolve-library-id({ libraryName: "nestjs" })

// 2. fetch docs for a specific topic
get-library-docs({ context7CompatibleLibraryID: "/nestjs/nest", topic: "guards" })
```

use for: code generation, setup/config, API docs, version-specific behavior. especially important for fast-moving libraries (react, nestjs, twilio, stripe, typeorm).

## qmd — memory and knowledge search

qmd is a local hybrid search engine (BM25 + vector + LLM reranking) that indexes all markdown files across opensaas, kiro sessions, opencode sessions, and docs. **search before you say "i don't know."**

if available as an MCP tool, use `qmd_query` for best results. otherwise via shell:
```bash
~/.bun/bin/qmd query "conference transfer architecture"  # hybrid search (best)
~/.bun/bin/qmd search "twilio conference"                # keyword only (fast)
```

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED

Any shell command containing `curl` or `wget` will be intercepted and blocked by the context-mode plugin. Do NOT retry.
Instead use:

- `context-mode_ctx_fetch_and_index(url, source)` to fetch and index web pages
- `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED

Any shell command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with shell.
Instead use:

- `context-mode_ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — BLOCKED

Do NOT use any direct URL fetching tool. Use the sandbox equivalent.
Instead use:

- `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)

Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:

- `context-mode_ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `context-mode_ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)

If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `context-mode_ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)

Search results can flood context. Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command       | Action                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| `ctx stats`   | Call the `stats` MCP tool and display the full output verbatim                    |
| `ctx doctor`  | Call the `doctor` MCP tool, run the returned shell command, display as checklist  |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |

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

## licensing — AGPL-3.0 + proprietary

- twenty-forked code (`twenty-front`, `twenty-server`, `twenty-shared`) → AGPL-3.0, must be public
- opensaas packages (`dialer`, `coaching`, `api`, `contacts`, `analytics`, `metering`) → proprietary, consuelo's IP
- the dialer is the enterprise product — CRM is free, calling is paid
- controllers in twenty-server are thin wrappers (AGPL), business logic in private packages
- need a source code link somewhere in the app (AGPL section 13) — future task

## upstream remote removed (2026-04-05)

the `upstream` remote (twentyhq/twenty, 482 branches) has been removed. consuelo is fully independent. security and feature PRs from twenty worth backporting are cataloged in linear DEV-1451 through DEV-1458 with links to twenty's open-source PRs.

**do NOT re-add the upstream remote.** if you need to reference twenty's code, use their github web UI.

## test infrastructure (2026-04-05)

97 unit tests across 4 suites:
- `packages/api/src/services/retry-policy.spec.ts` — 17 tests
- `packages/api/src/routes/__tests__/queues.spec.ts` — 24 tests
- `packages/dialer/src/services/parallel-dialer.spec.ts` — 35 tests
- `packages/dialer/src/services/parallel-strategy-resolver.spec.ts` — 21 tests

run with: `npx jest <file> --config=packages/<pkg>/jest.config.mjs --no-coverage`

these are layer 1 (logic with mocks). layer 2 (integration with real twilio) and layer 3 (agent-browser) are next.

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
