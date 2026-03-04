# CLAUDE.md — opensaas agent instructions

## first things first

read `CODING-STANDARDS.md` before writing any code. every rule in that file is mandatory.


## project overview

opensaas is an open-source sales infrastructure platform built on a [twenty CRM](https://github.com/twentyhq/twenty) fork. monorepo structured as an nx workspace managed with yarn 4.

/Users/kokayi/Dev/opensaas/packages/consuelo-website OUR WEBSITE IS NOT TWENTY-WEBSITE IF YOURE READING TWENTY WEBSITE ITS INCORRECT WE HAVE AN ASTRO SITE NOT NEXT.JS

### opensaas packages (`@consuelo/*`)

- `packages/dialer` — twilio-based calling (local presence, caller ID locking, parallel dialing)
- `packages/coaching` — AI coaching via groq/openai (real-time + post-call analysis, structured outputs via zod)
- `packages/analytics` — call analytics and metrics
- `packages/contacts` — contact management, CSV import, phone normalization, queue system
- `packages/api` — REST API layer (framework-agnostic route definitions)
- `packages/cli` — `consuelo` CLI tool
- `packages/sdk` — unified SDK entry point
- `packages/metering` — usage tracking and rate limiting
- `packages/workspace` — workspace/org management
- `packages/logger` — structured logging

### twenty CRM packages

```
packages/
├── twenty-front/          # React frontend application
├── twenty-server/         # NestJS backend API
├── twenty-ui/             # Shared UI components library
├── twenty-shared/         # Common types and utilities
├── twenty-emails/         # Email templates with React Email
├── twenty-website/        # Next.js documentation website
├── twenty-zapier/         # Zapier integration
└── twenty-e2e-testing/    # Playwright E2E tests
```

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

- **frontend**: React 18, TypeScript, Recoil (state management), Emotion (styling), Vite
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

## current work: twenty CRM fork (feb 2026)

we're building a twenty CRM fork with an embedded dialer sidebar. the python backend (`kokayicobb/consuelo_on_call_coaching`) has battle-tested patterns we're porting to typescript.

**linear epic:** DEV-702 (89 tasks across 10 phases)

### 10 phases

| phase | issue | subtasks | api routes | status |
|-------|-------|----------|------------|--------|
| 1. fork & rebrand twenty | DEV-703 | 8 | — | ✅ done |
| 2. dialer UI | DEV-711 | 16 | 23 | **in progress** (DEV-716 ✅, DEV-717 ✅) |
| 3. coaching panel | DEV-722 | 5 | — | python extraction done |
| 4. contacts + queue | DEV-728 | 7 | — | updated with patterns |
| 5. history + analytics | DEV-736 | 7 | — | spec'd |
| 6. files + KB | DEV-743 | 6 | 13 | **in progress** (DEV-748 ✅) |
| 7. settings + config | DEV-750 | 10 | 18 | python extraction done |
| 8. CLI data & action commands | DEV-760 | 6 | — | ✅ done |
| 9. deploy + infra | DEV-768 | 7 | — | spec'd |
| 10. GHL integration | DEV-779 | 7 | 13 | created with subtasks |
| 11. natural language assistant | DEV-807 | 4 | 3 | spec'd |

### key patterns extracted from python codebase

1. **call transfers** — blind, warm (3-way conference), external. from `call_transfer_service.py` (94KB). 8 routes, `call_transfers` table.
2. **parallel dialing** — 3 concurrent outbound, first-to-answer wins. redis-backed with atomic `SETNX`. from `script.py`.
3. **local presence** — geo-proximity via haversine on `area_code_locations`. exact area code → proximity 100mi → primary fallback. from `local_presence.py`.
4. **caller ID lock** — prevents concurrent usage (twilio error 31486). 5-min TTL, stale cleanup.
5. **structured AI outputs** — zod schemas (from python instructor/pydantic). KB context injection. PostHog LLM tracking.
6. **queue system** — parallel dialing, categories, DNC filtering, aggregated stats.
7. **pgvector knowledge base** — PDF ingestion pipeline (extract→chunk→embed→index), user-scoped collections, 384-dim embeddings.
8. **phone number management** — twilio provisioning, soft delete, atomic set-primary, nickname with redis cache.
9. **stripe subscription/billing** — 12 price IDs (6 add-ons × monthly/annual), checkout + portal + webhooks, usage metering.
10. **GHL integration** — OAuth2+PKCE, bidirectional contact sync, webhook handling, pipeline mapping.

### phase dependency graph

```
Phase 1 → Phase 2 → Phase 3
              │
              ├→ Phase 4 → Phase 5
              │       └→ Phase 10 (GHL)
              └→ Phase 5
Phase 1 → Phase 6 (independent)
Phase 1 → Phase 8 (independent)
Phase 1 → Phase 9
Phase 2 → Phase 7 (settings needs dialer for audio/calling mode)
Phase 8 → Phase 11 (assistant needs CLI commands as tools)
Phase 1 → Phase 11 (sidebar needs twenty CRM)
```

## dialer module — conference-based architecture

all calls go through twilio conferences — even 1-on-1 calls. this enables transfers (adding/removing participants) without dropping the call. `device.connect()` on the frontend stays the same; the backend TwiML webhook returns `<Conference>` instead of `<Dial><Number>`.

### call flow

1. browser calls `device.connect({ To, From })` → twilio hits `POST /v1/voice/twiml`
2. webhook generates `conf-{uuid}`, stores `callSid → conferenceName` in `conferenceMap`
3. returns TwiML: `<Conference startConferenceOnEnter="true" endConferenceOnExit="false" participantLabel="agent">conf-{uuid}</Conference>`
4. fire-and-forget: REST API dials customer into same conference with `endConferenceOnExit: true`

### participant labels

- `'agent'` — the browser user (set via TwiML `participantLabel`)
- `'customer'` — the PSTN number being called (set via REST API `label` param)
- `'transfer-target'` — the transfer recipient (set during transfer initiation)

### conferenceMap (in-memory, needs redis in prod)

```typescript
// callSid → conferenceName mapping, set in TwiML webhook, used by transfer/hold routes
const conferenceMap = new Map<string, string>();
```

### transfer flows

- **cold transfer**: add target to conference → remove agent immediately
- **warm transfer**: hold customer → add target for consult → agent can complete (leave) or cancel (remove target, unhold customer)
- **hold**: server-side via twilio participant API (not UI-only)

### API routes (`packages/api/src/routes/voice.ts`)

| method | path | description |
|--------|------|-------------|
| GET | `/v1/voice/token` | twilio access token for browser SDK |
| POST | `/v1/voice/twiml` | conference TwiML webhook (twilio calls this) |
| POST | `/v1/calls/:callSid/transfer` | initiate cold or warm transfer |
| POST | `/v1/calls/:callSid/transfer/complete` | complete warm transfer |
| POST | `/v1/calls/:callSid/transfer/cancel` | cancel warm transfer |
| POST | `/v1/calls/:callSid/hold` | toggle hold on customer participant |

### dialer file map

**backend — `@consuelo/dialer` package:**

| file | what it does |
|------|-------------|
| `src/services/conference.ts` | `ConferenceService` — conference creation, participant management, transfer orchestration |
| `src/dialer.ts` | `Dialer` class — exposes conference + transfer methods alongside existing call methods |
| `src/types.ts` | all types: `ConferenceParticipant`, `TransferType` (`'cold'`\|`'warm'`), `TransferResult`, `TwimlParams` |
| `src/services/twilio.ts` | `TwilioService` — low-level twilio client (calls, SMS) |
| `src/services/local-presence.ts` | `LocalPresenceService` — geo-proximity caller ID selection |
| `src/services/caller-id-lock.ts` | `CallerIdLockService` — prevents concurrent caller ID usage |

**frontend — `packages/twenty-front/src/modules/dialer/`:**

| file | what it does |
|------|-------------|
| `hooks/useTwilioDevice.ts` | twilio Voice SDK device management, call state, DTMF |
| `hooks/useCallTransfer.ts` | transfer API calls: initiate, complete, cancel, hold toggle |
| `components/InCallControls.tsx` | mute, hold, DTMF, transfer button, warm transfer consult bar |
| `components/TransferModal.tsx` | phone input, warm/cold toggle, transfer initiation |
| `components/DialPad.tsx` | phone number input + dial button |
| `states/dialerState.ts` | recoil atoms: `callSidState`, `callStatusState`, `activeCallState` |
| `states/conferenceState.ts` | recoil atom: `conferenceSidState` |
| `types/dialer.ts` | frontend types: `TransferType`, `TransferStatus`, `CallStatus` |
| `constants/dialer.ts` | `DIALER_API_BASE_URL` |

### twilio setup requirement

the TwiML app in twilio console must have its voice URL pointed at `POST /v1/voice/twiml`. without this, calls work the old way (direct dial) but transfers won't function.

### import patterns

- dialer package: lazy `await import('twilio')` — twilio is a peer dep
- frontend icons: `@tabler/icons-react` directly (not `twenty-ui/display`)
- state atoms: `createState` from `@/ui/utilities/state/utils/createState`

### keyboard shortcuts

twenty has a full hotkey system built in. **always use it** — never raw `addEventListener` for keyboard shortcuts.

| hook | use case |
|------|----------|
| `useGlobalHotkeys` | single key or modifier combos (e.g. `m` for mute) |
| `useGlobalHotkeysSequence` | two-key sequences (e.g. `g` then `s` = go to settings) |
| `useGoToHotkeys` | navigation via `g+key` (wraps sequence hook + `useNavigate`) |
| `useHotkeysOnFocusedElement` | context-scoped (only fires when specific element focused) |

all hooks live in `packages/twenty-front/src/modules/ui/utilities/hotkey/hooks/`.

dialer shortcuts use `useDialerHotkeys` hook (`packages/twenty-front/src/modules/dialer/hooks/useDialerHotkeys.ts`) — takes callbacks, registers via `useGlobalHotkeys`.

**full shortcut reference + planned shortcuts for all phases:** `.kiro/docs/KEYBOARD-SHORTCUTS.md`

## deployment — railway

production is deployed on railway at `consuelo.consuelohq.com`. four services:

| service | what it does | Dockerfile |
|---------|-------------|------------|
| `opensaas` | twenty-server (NestJS API + frontend) | `packages/twenty-docker/twenty/Dockerfile` |
| `twenty-worker` | BullMQ background job processor | same Dockerfile, custom start command |
| `postgres` | PostgreSQL database | railway managed |
| `redis` | Redis cache + sessions + BullMQ | railway managed |

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

note: the railway CLI cannot delete env vars or set start commands. use the dashboard for those.

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

## key files

- `AUTH.md` — full JWT auth system documentation
- `CODING-STANDARDS.md` — all 13 mandatory code review rules
- `packages/api/src/middleware/auth.ts` — JWT validation middleware using twenty's derived-secret scheme
- `packages/twenty-server/patches/` — yarn patches for transitive deps (see patches section above)
- `packages/twenty-server/src/engine/api/graphql/graphql-config/graphql-config.service.ts` — graphql schema merging config
- `.husky/pre-commit` — lint + typecheck staged opensaas .ts files
- `.husky/pre-push` — runs `scripts/code-review.sh`
- `yarn.config.cjs` — yarn constraints (`MONOREPO_ROOT_WORKSPACE` must match root `package.json` name)
- `nx.json` — Nx workspace configuration with task definitions
- `tsconfig.base.json` — base TypeScript configuration
- `package.json` — root package with workspace definitions and resolutions (including patches)

## package manager

- yarn 4.9.2 (via corepack: `corepack enable && corepack prepare yarn@4.9.2 --activate`)
- node engine: `^24.5.0`
- `yarn.config.cjs` has constraints — `MONOREPO_ROOT_WORKSPACE` must match root `package.json` name

## critical rules

1. **read CODING-STANDARDS.md** — contains all error tracking, logging, SQL, phone normalization, and code review rules
2. **never use `console.log/error/warn`** — use structured logger
3. **never interpolate user input into SQL** — parameterized queries only
4. **always normalize phone numbers** — use `normalizePhone()` from `@consuelo/contacts`
5. **all CLI commands support `--json` and `--quiet`** — check `isJson()` and the global quiet flag
6. **config lives at `~/.consuelo/config.json`** — loaded via `loadConfig()` from `packages/cli/src/config.ts`
7. **error format is consistent** — API: `{ error: { code, message } }`, CLI: `error()` + `process.exit(1)`

## pre-push code review — 13 automated checks

`scripts/code-review.sh` (also `npm run review`) runs on every push. all 13 must pass:


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
}

// ✅ correct — clearly unfinished
handler: async (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Call status lookup not yet implemented' } });
}

// ✅ also fine — marked as intentional stub
handler: async (req, res) => {
  // STUB: replace with real call status check (DEV-xxx)
  res.status(200).json({ status: 'in-progress' });
}
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

ALl text must be localized with Lingui
