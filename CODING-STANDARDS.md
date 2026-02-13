# coding standards

> these are the rules. every agent, every PR, every commit. no exceptions.

opensaas is a monorepo with 9 packages. these standards apply across all of them. they exist because the coaching repo (`consuelo_on_call_coaching`) learned them the hard way — every rule here prevented a real bug or production incident.

---

## error tracking (sentry + posthog)

**dual error tracking is mandatory.** sentry for immediate alerts and stack traces, posthog for searchable structured logs and session context.

### typescript (packages/cli, packages/api, packages/sdk)

```typescript
// HTTP errors — sentry + logger
if (!response.ok) {
  logger.error('[Component] request failed', {
    statusCode: response.status,
    endpoint: '/v1/endpoint',
    userId,
  });
  Sentry.captureMessage(`[Component] HTTP ${response.status}`, {
    level: 'error',
    tags: { component: 'ComponentName', statusCode: String(response.status) },
    extra: { userId, endpoint: '/v1/full/path' },
  });
}

// caught exceptions — all three
try {
  await riskyOperation();
} catch (err: unknown) {
  logger.error('[Component] operation failed', { userId });
  captureExceptionToPostHog(err as Error, { component: 'ComponentName' });
  Sentry.captureException(err);
}
```

### decision tree

| scenario | logger | sentry | posthog |
|----------|--------|--------|---------|
| HTTP error (4xx, 5xx) | `logger.error()` | `Sentry.captureMessage()` | — |
| caught exception | `logger.error()` | `Sentry.captureException()` | `captureExceptionToPostHog()` |
| warning | `logger.warn()` | — | — |
| info | `logger.info()` | — | — |

### what this means for opensaas right now

- DEV-623 tracks adding sentry to the CLI
- every package that makes API calls or handles user input needs error tracking
- `packages/api/src/middleware/error-handler.ts` currently swallows errors silently — needs sentry integration
- `packages/cli/src/commands/*.ts` need try/catch with sentry around all provider calls

---

## structured logging

**never use `console.log`, `console.error`, or `console.warn`.** use a structured logger that outputs context attributes.

```typescript
// ✅ correct — structured with attributes
logger.error('[Dialer] call failed', {
  userId,
  to: phoneNumber,
  provider: 'twilio',
  errorCode: err.code,
});

// ❌ wrong — string concatenation, no structure
console.error(`Call to ${phoneNumber} failed: ${err.message}`);
```

### log format

every log line must include:
- **component tag** in brackets: `[Dialer]`, `[Coach]`, `[API]`, `[CLI]`
- **relevant context**: userId, callSid, endpoint, etc.
- **never log sensitive data**: no API keys, auth tokens, full phone numbers in logs (last 4 digits ok)

### severity levels

- `logger.error()` — something broke, needs attention
- `logger.warn()` — unexpected but handled, might need attention
- `logger.info()` — normal operations worth tracking (call initiated, analysis complete)
- `logger.debug()` — dev-only detail (request payloads, timing)

---

## postgres patterns

opensaas uses postgres (via `DATABASE_URL`). these patterns prevent the most common bugs.

### parameterized queries only

```typescript
// ✅ correct — parameterized
const result = await db.query('SELECT * FROM calls WHERE user_id = $1 AND status = $2', [userId, 'active']);

// ❌ wrong — SQL injection risk
const result = await db.query(`SELECT * FROM calls WHERE user_id = '${userId}'`);
```

### null handling

```typescript
// ✅ correct — explicit null checks
if (row === null || row === undefined) { ... }
if (rows.length === 0) { ... }

// ❌ wrong — falsy check catches 0, empty string
if (!row) { ... }  // breaks if row has falsy but valid values
```

### connection management

- always use connection pools, never single connections
- always release connections back to pool (use try/finally or `using`)
- set statement timeouts to prevent long-running queries from blocking
- use transactions for multi-step writes

```typescript
// ✅ correct — pool with cleanup
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO calls ...', [values]);
  await client.query('UPDATE users ...', [values]);
  await client.query('COMMIT');
} catch (err: unknown) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### migrations

- every schema change needs a migration file
- migrations must be idempotent (safe to run multiple times)
- never modify a migration that's already been applied — create a new one

---

## phone number normalization

**all phone comparisons must use normalized E.164 format.** the `@consuelo/contacts` package exports `normalizePhone()` — use it everywhere.

```typescript
import { normalizePhone } from '@consuelo/contacts';

// ✅ correct — normalize before comparing
if (normalizePhone(contact.phone) === normalizePhone(incomingNumber)) { ... }

// ✅ correct — normalize before storing
const normalized = normalizePhone(rawInput);
await db.query('INSERT INTO contacts (phone) VALUES ($1)', [normalized]);

// ❌ wrong — raw comparison (breaks on formatting differences)
if (contact.phone === incomingNumber) { ... }
```

### format rules

- storage format: `+1XXXXXXXXXX` (E.164, always)
- display format: `(XXX) XXX-XXXX` (convert only for UI)
- validation: reject anything that doesn't normalize to a valid E.164 number
- CSV imports: normalize every phone number on import, reject invalid ones

---

## inline comment guidelines

### when to comment

- ✅ **WHY**, not WHAT — explain the reasoning, not the obvious
- ✅ non-obvious technical decisions or workarounds
- ✅ gotchas, edge cases, API quirks
- ✅ security-critical code or validation logic
- ❌ obvious code (`// set user name` above `user.name = name`)
- ❌ commented-out code (delete it, git has history)

### comment tags

use these consistently across all packages:

```typescript
// NOTE: explains important context or technical decision
// IMPORTANT: critical warning about API misuse or breaking changes
// TODO: future work (convert to linear issue if non-trivial)
// FIXME: known bug that needs fixing
// HACK: temporary workaround that should be refactored
```

### density

- 1-2 meaningful comments per 20-30 lines of complex logic
- zero comments for self-explanatory code
- more comments in auth, payments, data validation sections

---

## code review checklist

every PR gets reviewed against these rules. `scripts/code-review.sh` (also `npm run review`) enforces all 13 automatically.

### mandatory rules

1. **LOGGING** — uses structured logger, never `console.*`
2. **SENTRY** — HTTP errors and caught exceptions have sentry tracking
3. **PHONE_NORM** — phone comparisons use `normalizePhone()`
4. **SQL_PARAM** — all SQL queries use parameterized values, never string interpolation
5. **ERROR_HANDLING** — async functions with `await` must have try/catch within 30 lines
6. **TYPE_SAFETY** — no `any` types without a `// HACK:` comment explaining why
7. **SECRETS** — no hardcoded API keys, tokens, or passwords (skips `process.env` and type annotations)
8. **TODO_FIXME** — bare `TODO` or `FIXME` must include a ticket reference like `DEV-123`
9. **IMPORT_SAFETY** — no wildcard `import *` (except builtins like fs, path, os and Sentry)
10. **ROUTE_ORDER** — literal routes must come before param routes (`:id`) in the same prefix
11. **CATCH_TYPING** — `catch (err)` must have `: unknown` type annotation
12. **OPTIONAL_IMPORT** — peer dependencies must use lazy `await import()`, never top-level `import`
13. **STUB_HANDLER** — route handlers must return real data or explicit 501, not hardcoded fakes

### review triggers

auto-review when:
- diff touches 3+ files OR 50+ lines changed
- changes touch: `Dockerfile`, `package.json`, `template.yaml`, deployment configs
- changes include new API routes or database queries

### severity levels

- 🔴 **critical** — blocks merge (security, data loss, SQL injection)
- 🟡 **warning** — should fix before merge (missing error handling, no logging)
- 🟢 **minor** — nice to fix (style, naming, comment quality)

---

## pre-push checklist

before pushing code:

1. **check for stashed changes**: `git stash list`
2. **review the diff**: `git diff --staged`
3. **run code review**: check against mandatory rules above
4. **verify no forbidden files**: no `.env`, `node_modules/`, `dist/`, `.turbo/`
5. **type check**: `npx tsc --noEmit` in affected packages

---

## error handling patterns

### API routes (packages/api)

every route handler must:
- validate input before processing
- return consistent error format: `{ error: { code: string, message: string } }`
- use appropriate HTTP status codes
- log errors with context

```typescript
handler: async (req, res) => {
  const body = req.body as SomeBody | undefined;
  if (!body?.requiredField) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "requiredField"' } });
    return;
  }

  try {
    const result = await doSomething(body);
    res.status(200).json(result);
  } catch (err: unknown) {
    logger.error('[Route] operation failed', { endpoint: req.path, userId: req.apiKeyContext?.userId });
    Sentry.captureException(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } });
  }
}
```

### CLI commands (packages/cli)

every command must:
- validate args before doing work
- check config exists (prompt to run `consuelo init` if missing)
- handle provider errors (twilio, groq) with user-friendly messages
- support `--json` for machine-readable output
- support `--quiet` for suppressed output
- exit with code 1 on error

```typescript
export async function someCommand(opts: Options): Promise<void> {
  if (!opts.required) {
    error('missing required option');
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.neededKey) {
    error('not configured — run `consuelo init`');
    process.exit(1);
  }

  try {
    const result = await doWork(config);
    if (isJson()) {
      json(result);
    } else {
      log(`done: ${result.summary}`);
    }
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : 'operation failed');
    process.exit(1);
  }
}
```

---

## package-specific rules

### optional / peer dependencies

packages that list dependencies in `peerDependencies` must NEVER import them at the top level. top-level imports crash the entire package for consumers who don't have the optional dep installed.

```typescript
// ❌ crashes if groq-sdk not installed
import Groq from 'groq-sdk';

// ✅ lazy — only fails when actually called
export async function parseDocument(file: Buffer) {
  const { default: Groq } = await import('groq-sdk');
  // ...
}
```

**barrel exports:** never re-export values from modules that depend on optional packages. use `export type` for types.

```typescript
// ❌ importing this barrel crashes without @sentry/node
export { initSentry, Sentry } from './sentry.js';

// ✅ types are safe
export type { SentryConfig } from './sentry.js';
```

### cached client error recovery

any `getClient()` or lazy-init pattern that caches a client must null out the reference on failure. otherwise a failed init leaves a broken state cached and retries are impossible.

```typescript
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

### @consuelo/dialer
- always validate phone numbers to E.164 before calling twilio
- never expose twilio credentials in error messages or logs
- handle twilio-specific errors: 21211 (invalid number), 21214 (not verified), 20003 (auth)

### @consuelo/coaching
- set reasonable timeouts on LLM calls (groq can hang)
- validate JSON responses from LLM (they hallucinate malformed JSON)
- never send PII in prompts (no real names, full phone numbers, or addresses)

### @consuelo/api
- all routes must go through `errorHandler` middleware
- all routes must validate auth via `authMiddleware`
- response format is always `{ data }` or `{ error: { code, message } }`

### @consuelo/contacts
- all phone numbers normalized on input (import, create, update)
- CSV parsing must handle: BOM markers, inconsistent delimiters, quoted fields with commas
- deduplication by normalized phone number

---

## git conventions

### commit format

```
type(scope): description

- detail 1
- detail 2
```

types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
scopes: `cli`, `api`, `dialer`, `coaching`, `contacts`, `analytics`, `sdk`, `metering`, `workspace`

### branch naming

- `agent/description` — agent-created branches
- `remote/repo-hash--description` — remote dev branches
- `fix/description` — bug fixes
- `feat/description` — features

### PR rules

- one PR per feature (don't split related work across PRs)
- link linear issues in PR description
- all mandatory code review rules must pass before merge
