import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '@consuelo/logger';

const logger = createLogger('CLI:Docker');

const DOCKER_COMPOSE_TEMPLATE = `name: consuelo

services:
  db:
    image: postgres:16
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: \${PG_DATABASE_NAME:-default}
      POSTGRES_PASSWORD: \${PG_DATABASE_PASSWORD:-postgres}
      POSTGRES_USER: \${PG_DATABASE_USER:-postgres}
    healthcheck:
      test: pg_isready -U \${PG_DATABASE_USER:-postgres} -h localhost -d postgres
      interval: 5s
      timeout: 5s
      retries: 10
    restart: always

  redis:
    image: redis:7-alpine
    restart: always
    command: ["--maxmemory-policy", "noeviction"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  server:
    image: ghcr.io/consuelo/opensaas:\${TAG:-latest}
    volumes:
      - server-local-data:/app/packages/twenty-server/.local-storage
    ports:
      - "3000:3000"
    environment:
      NODE_PORT: 3000
      PG_DATABASE_URL: postgres://\${PG_DATABASE_USER:-postgres}:\${PG_DATABASE_PASSWORD:-postgres}@\${PG_DATABASE_HOST:-db}:\${PG_DATABASE_PORT:-5432}/default
      SERVER_URL: \${SERVER_URL}
      REDIS_URL: \${REDIS_URL:-redis://redis:6379}
      APP_SECRET: \${APP_SECRET:-replace_me_with_a_random_string}
      STORAGE_TYPE: \${STORAGE_TYPE}
      STORAGE_S3_REGION: \${STORAGE_S3_REGION}
      STORAGE_S3_NAME: \${STORAGE_S3_NAME}
      STORAGE_S3_ENDPOINT: \${STORAGE_S3_ENDPOINT}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: curl --fail http://localhost:3000/healthz
      interval: 5s
      timeout: 5s
      retries: 20
    restart: always

  worker:
    image: ghcr.io/consuelo/opensaas:\${TAG:-latest}
    volumes:
      - server-local-data:/app/packages/twenty-server/.local-storage
    command: ["yarn", "worker:prod"]
    environment:
      PG_DATABASE_URL: postgres://\${PG_DATABASE_USER:-postgres}:\${PG_DATABASE_PASSWORD:-postgres}@\${PG_DATABASE_HOST:-db}:\${PG_DATABASE_PORT:-5432}/default
      SERVER_URL: \${SERVER_URL}
      REDIS_URL: \${REDIS_URL:-redis://redis:6379}
      APP_SECRET: \${APP_SECRET:-replace_me_with_a_random_string}
      DISABLE_DB_MIGRATIONS: "true"
      DISABLE_CRON_JOBS_REGISTRATION: "true"
      STORAGE_TYPE: \${STORAGE_TYPE}
      STORAGE_S3_REGION: \${STORAGE_S3_REGION}
      STORAGE_S3_NAME: \${STORAGE_S3_NAME}
      STORAGE_S3_ENDPOINT: \${STORAGE_S3_ENDPOINT}
    depends_on:
      db:
        condition: service_healthy
      server:
        condition: service_healthy
    restart: always

  api:
    image: ghcr.io/consuelo/opensaas-api:\${TAG:-latest}
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://\${PG_DATABASE_USER:-postgres}:\${PG_DATABASE_PASSWORD:-postgres}@db:5432/\${PG_DATABASE_NAME:-default}
      TWILIO_ACCOUNT_SID: \${TWILIO_ACCOUNT_SID}
      TWILIO_AUTH_TOKEN: \${TWILIO_AUTH_TOKEN}
      GROQ_API_KEY: \${GROQ_API_KEY}
    ports:
      - "\${API_PORT:-8000}:8000"
    healthcheck:
      test: curl --fail http://localhost:8000/health
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  db-data:
  server-local-data:
`;

const ENV_EXAMPLE_TEMPLATE = `# Consuelo — environment configuration
# Copy to .env and fill in your values
# Usage: docker-compose up -d

# ── CRM (Twenty fork) ────────────────────────────────────────────
APP_SECRET=replace_me_with_a_random_string
SERVER_URL=http://localhost:3000

# ── Postgres ─────────────────────────────────────────────────────
PG_DATABASE_USER=postgres
PG_DATABASE_PASSWORD=postgres
PG_DATABASE_NAME=default
PG_DATABASE_HOST=db
PG_DATABASE_PORT=5432

# ── Redis ────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Storage (optional — defaults to local) ───────────────────────
# STORAGE_TYPE=s3
# STORAGE_S3_REGION=
# STORAGE_S3_NAME=
# STORAGE_S3_ENDPOINT=

# ── opensaas API ────────────────────────────────────────────────
API_PORT=8000
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
GROQ_API_KEY=

# ── Docker image tag (optional) ─────────────────────────────────
# TAG=latest
`;

export function generateDockerCompose(outputDir: string = process.cwd()): void {
  const composePath = path.join(outputDir, 'docker-compose.yml');
  const envExamplePath = path.join(outputDir, '.env.example');

  for (const filePath of [composePath, envExamplePath]) {
    if (fs.existsSync(filePath)) {
      logger.warn(`  ⚠ Overwriting existing ${path.basename(filePath)}`);
    }
  }

  fs.writeFileSync(composePath, DOCKER_COMPOSE_TEMPLATE);
  fs.writeFileSync(envExamplePath, ENV_EXAMPLE_TEMPLATE);

  logger.info('\nGenerated:');
  logger.info('  - docker-compose.yml');
  logger.info('  - .env.example');
}
