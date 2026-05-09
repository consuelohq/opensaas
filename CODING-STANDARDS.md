# Coding Standards

> These are the rules. Every agent, every PR, every commit. No exceptions.

Read the full document before writing code. Reading the first 200 lines is not enough.

---

## Error tracking: Sentry + PostHog

AKWAYS use dual error tracking, this is mandatory.

Use Sentry for immediate alerts and stack traces. Use PostHog for searchable structured logs and session context.


### `useEffect`

Do not use `useEffect` as an escape hatch.

Use `useEffect` only for syncing with external systems:

- Timers
- Subscriptions
- DOM APIs
- Network connections
- Third-party widgets

If the code is not syncing with an external system, React says you probably do not need an effect.

### Decision tree

| Scenario | Logger | Sentry | PostHog |
| --- | --- | --- | --- |
| HTTP error: `4xx`, `5xx` | `logger.error()` | `Sentry.captureMessage()` | — |
| Caught exception | `logger.error()` | `Sentry.captureException()` | `captureExceptionToPostHog()` |
| Warning | `logger.warn()` | — | — |
| Info | `logger.info()` | — | — |

---

## Structured logging

Never use:

- `console.log`
- `console.error`
- `console.warn`

Use a structured logger that outputs context attributes.

```ts
// ✅ Correct — structured with attributes
logger.error('[Dialer] call failed', {
  userId,
  to: phoneNumber,
  provider: 'twilio',
  errorCode: err.code,
});
```

```ts
// ❌ Wrong — string concatenation, no structure
console.error(`Call to ${phoneNumber} failed: ${err.message}`);
```

### Log format

Every log line must include:

- Component tag in brackets, for example `[Dialer]`, `[Coach]`, `[API]`, `[CLI]`
- Relevant context, for example `userId`, `callSid`, `endpoint`
- No sensitive data: no API keys, auth tokens, or full phone numbers in logs. Last four digits are acceptable.

### Severity levels

- `logger.error()` — something broke and needs attention
- `logger.warn()` — unexpected but handled, might need attention
- `logger.info()` — normal operations worth tracking, such as call initiated or analysis complete
- `logger.debug()` — dev-only detail, such as request payloads or timing

---

## Postgres patterns

OpenSaaS uses Postgres via `DATABASE_URL`. These patterns prevent the most common bugs.

### Parameterized queries only

```ts
// ✅ Correct — parameterized
const result = await db.query(
  'SELECT * FROM calls WHERE user_id = $1 AND status = $2',
  [userId, 'active'],
);
```

```ts
// ❌ Wrong — SQL injection risk
const result = await db.query(
  `SELECT * FROM calls WHERE user_id = '${userId}'`,
);
```

### Null handling

```ts
// ✅ Correct — explicit null checks
if (row === null || row === undefined) {
  // ...
}

if (rows.length === 0) {
  // ...
}
```

```ts
// ❌ Wrong — falsy check catches 0 and empty string
if (!row) {
  // ...
}
```

### Connection management

- Always use connection pools. Never use single long-lived connections.
- Always release connections back to the pool with `try`/`finally` or `using`.
- Set statement timeouts to prevent long-running queries from blocking.
- Use transactions for multi-step writes.

```ts
// ✅ Correct — pool with cleanup
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

### Migrations

- Every schema change needs a migration file.
- Migrations must be idempotent when practical.
- Never modify a migration that has already been applied. Create a new migration instead.


---

## Inline comment guidelines

### When to comment

Use comments for:

- Why, not what
- Non-obvious technical decisions or workarounds
- Gotchas, edge cases, and API quirks
- Security-critical code or validation logic

Avoid comments for:

- Obvious code, such as `// set user name` above `user.name = name`
- Commented-out code. Delete it; git has history.

### Comment tags

Use these consistently across all packages:

```ts
// NOTE: explains important context or a technical decision
// IMPORTANT: critical warning about API misuse or breaking changes
// TODO: future work; convert to Linear issue if non-trivial
// FIXME: known bug that needs fixing
// HACK: temporary workaround that should be refactored
```

### Density

Use 1–2 meaningful comments per 20–30 lines of complex logic.

---


## Error handling patterns

### API routes

Every route handler must:

- Validate input before processing.
- Return consistent error format: `{ error: { code: string, message: string } }`.
- Use appropriate HTTP status codes.
- Log errors with context.
- Capture unexpected exceptions in Sentry.

```ts
handler: async (req, res) => {
  const body = req.body as SomeBody | undefined;

  if (!body?.requiredField) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing "requiredField"',
      },
    });

    return;
  }

  try {
    const result = await doSomething(body);

    res.status(200).json(result);
  } catch (err: unknown) {
    logger.error('[Route] operation failed', {
      endpoint: req.path,
      userId: req.apiKeyContext?.userId,
    });

    Sentry.captureException(err);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Operation failed',
      },
    });
  }
};
```


## Package-specific rules

### Peer dependencies

Packages that list dependencies in `peerDependencies` must never import them at the top level.

Top-level imports crash the entire package for consumers who do not have the optional dependency installed.

```ts
// ❌ Wrong — crashes if groq-sdk is not installed
import Groq from 'groq-sdk';
```

```ts
// ✅ Correct — lazy import only fails when actually called
export async function parseDocument(file: Buffer) {
  const { default: Groq } = await import('groq-sdk');
  // ...
}
```

### Barrel exports

Never re-export values from modules that depend on optional packages. Use `export type` for types.

```ts
// ❌ Wrong — importing this barrel crashes without @sentry/node
export { initSentry, Sentry } from './sentry.js';
```

```ts
// ✅ Correct — types are safe
export type { SentryConfig } from './sentry.js';
```

### Cached client error recovery

Any `getClient()` or lazy-init pattern that caches a client must null out the reference on failure.

A failed init can leave a broken state cached and make retries unreliable.

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

---

## Repo-specific note

This file is for coding standards specific to this repo. Workflow lifecycle instructions belong in the task skill and workspace tooling docs. Long command catalogs belong in `TOOLS.md` or `SCRIPTS.md`.
