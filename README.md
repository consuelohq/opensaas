<p align="center">
  <img src="./packages/twenty-website/public/images/core/logo.svg" width="100px" alt="Consuelo" />
</p>

<h2 align="center">Consuelo — Open-Source Sales Infrastructure</h2>

<p align="center">CRM + Dialer + AI Coaching — built on a <a href="https://github.com/twentyhq/twenty">Twenty</a> fork</p>

---

## What Is This?

Consuelo is an open-source sales platform. This repo is a fork of [Twenty CRM](https://twenty.com) with an embedded dialer sidebar, real-time AI coaching, and composable backend packages (`@consuelo/*`).

**opensaas packages** (in `packages/`):

| Package | Description |
|---------|-------------|
| `api` | REST API layer — route definitions, auth middleware |
| `cli` | `consuelo` CLI tool |
| `dialer` | Twilio-based calling (local presence, parallel dialing) |
| `coaching` | AI coaching via Groq/OpenAI (real-time + post-call) |
| `contacts` | Contact management, CSV import, phone normalization |
| `analytics` | Call analytics and metrics |
| `sdk` | Unified SDK entry point |
| `metering` | Usage tracking and rate limiting |
| `logger` | Structured logging |

## Prerequisites

- Node.js 24+ (`engines.node: ^24.5.0`)
- Yarn 4+ (via corepack: `corepack enable`)
- Docker + Docker Compose (for Postgres + Redis)
- Git

## Local Development

```bash
# 1. clone and install
git clone https://github.com/consuelohq/opensaas.git
cd opensaas
corepack enable
yarn install

# 2. copy env and fill in values
cp .env.example .env
# at minimum set: APP_SECRET, PG_DATABASE_* vars

# 3. start infrastructure (postgres + redis)
docker compose up db redis -d

# 4. start the CRM (frontend + backend + worker)
yarn start
# → frontend: http://localhost:3001 (Vite, HMR enabled)
# → backend:  http://localhost:3000 (NestJS)
```

The `start` script runs Twenty's frontend and backend concurrently via nx. Vite handles frontend hot-reload (HMR). The NestJS backend uses `ts-node` with watch mode for auto-restart on changes.

### Individual packages

```bash
# run a specific twenty package
npx nx start twenty-front
npx nx start twenty-server

# run the worker separately
npx nx run twenty-server:worker
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_SECRET` | Yes | JWT signing key (see [AUTH.md](AUTH.md)) |
| `PG_DATABASE_*` | Yes | Postgres connection |
| `REDIS_URL` | Yes | Redis connection |
| `AUTH_GOOGLE_CLIENT_ID` | No | Google OAuth |
| `TWILIO_ACCOUNT_SID` | No | Twilio for dialer |
| `GROQ_API_KEY` | No | AI coaching |

## Auth

Single auth system — Twenty's built-in JWT auth. No Clerk, no separate provider. See [AUTH.md](AUTH.md) for the full documentation (token format, secret derivation, refresh flow, middleware).

## Code Quality

### ESLint

Twenty's ESLint config applies globally. opensaas packages (`packages/api`, `packages/cli`, etc.) have stricter overrides:

- `no-console: 'error'` — use structured logger
- `@typescript-eslint/no-explicit-any: 'warn'`
- SQL parameterization enforced (no template literals in `.query()`)

### TypeScript

All opensaas packages use `strict: true`. Twenty packages have their own strict settings.

### Git Hooks (Husky)

- **pre-commit** — lints and typechecks staged opensaas `.ts` files
- **pre-push** — runs `scripts/code-review.sh` (13 mandatory checks from [CODING-STANDARDS.md](CODING-STANDARDS.md))

### Commit Format

```
type(scope): description
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
Scopes: `cli`, `api`, `dialer`, `coaching`, `contacts`, `analytics`, `sdk`, `metering`, `logger`

Bot commits use: `suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>`

## Contributing

1. Fork the repo
2. Create a feature branch from `twenty-fork`
3. Make your changes (follow [CODING-STANDARDS.md](CODING-STANDARDS.md))
4. Push — pre-push hooks will run the 13 code review checks
5. Open a PR

## License

Same as [Twenty](https://github.com/twentyhq/twenty) — AGPL-3.0.
