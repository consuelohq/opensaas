# CLAUDE.md — opensaas agent instructions

## first things first

read `CODING-STANDARDS.md` before writing any code. every rule in that file is mandatory.

## project overview

opensaas is an open-source sales infrastructure SDK. monorepo with 9+ packages:

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

## current work: twenty CRM fork (feb 2026)

we're building a twenty CRM fork with an embedded dialer sidebar. the python backend (`kokayicobb/consuelo_on_call_coaching`) has battle-tested patterns we're porting to typescript.

**linear epic:** DEV-702 (89 tasks across 10 phases)

### 10 phases

| phase | issue | subtasks | api routes | status |
|-------|-------|----------|------------|--------|
| 1. fork & rebrand twenty | DEV-703 | 8 | — | spec'd |
| 2. dialer UI | DEV-711 | 16 | 23 | python extraction done |
| 3. coaching panel | DEV-722 | 5 | — | python extraction done |
| 4. contacts + queue | DEV-728 | 7 | — | updated with patterns |
| 5. history + analytics | DEV-736 | 7 | — | spec'd |
| 6. files + KB | DEV-743 | 6 | 13 | python extraction done |
| 7. settings + config | DEV-750 | 10 | 18 | python extraction done |
| 8. agent workflows | DEV-760 | 7 | — | spec'd |
| 9. CLI + deploy | DEV-768 | 6 | — | spec'd |
| 10. GHL integration | DEV-779 | 7 | 13 | created with subtasks |

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
```

**active branch:** `phase2-code-quality`

## tech stack

- typescript throughout (strict mode)
- turbo for monorepo builds
- postgres for persistence (via `DATABASE_URL`)
- pgvector for knowledge base embeddings
- redis for caching (caller ID locks, nicknames, parallel dial state)
- twilio for telephony
- stripe for billing
- groq/openai for AI (via openai SDK)
- recoil for state management (twenty frontend)
- deployed via docker, railway, or AWS SAM (`template.yaml`)

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

| # | check | what it catches |
|---|-------|-----------------|
| 1 | **LOGGING** | `console.*` usage (except output.ts and logger) |
| 2 | **SENTRY** | HTTP errors or caught exceptions missing sentry tracking |
| 3 | **PHONE_NORM** | `.phone ===` or `.phoneNumber ===` without `normalizePhone()` |
| 4 | **SQL_PARAM** | template literals in `.query()` calls |
| 5 | **ERROR_HANDLING** | async functions with `await` but no `try/catch` within 30 lines |
| 6 | **TYPE_SAFETY** | `: any`, `as any`, `<any>` without `// HACK:` comment |
| 7 | **SECRETS** | hardcoded API keys, tokens, passwords (skips `process.env` and type annotations) |
| 8 | **TODO_FIXME** | bare `TODO` or `FIXME` without a ticket reference like `DEV-123` |
| 9 | **IMPORT_SAFETY** | wildcard `import *` (except builtins like fs, path, os and Sentry) |
| 10 | **ROUTE_ORDER** | param routes (`:id`) registered before literal routes in the same prefix |
| 11 | **CATCH_TYPING** | `catch (err)` without `: unknown` type annotation |
| 12 | **OPTIONAL_IMPORT** | top-level `import` of `peerDependencies` (must use lazy `await import()`) |
| 13 | **STUB_HANDLER** | route handlers returning hardcoded fake data without `// STUB:` comment |

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

- commit as `suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>`
- commit format: `type(scope): description`
- one PR per feature
