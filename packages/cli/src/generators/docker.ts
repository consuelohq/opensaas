import { existsSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createLogger } from '@consuelo/logger';

const logger = createLogger('CLI:Docker');

const DOCKER_COMPOSE_TEMPLATE = `name: consuelo

services:
  db:
    image: postgres:16
    ports:
      - "\${PG_DATABASE_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: \${PG_DATABASE_NAME:-consuelo}
      POSTGRES_USER: \${PG_DATABASE_USER:-consuelo}
      POSTGRES_PASSWORD: \${PG_DATABASE_PASSWORD:-consuelo}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${PG_DATABASE_USER:-consuelo} -d \${PG_DATABASE_NAME:-consuelo}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    command: ["redis-server", "--maxmemory-policy", "noeviction"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  db-data:
`;

const ENV_EXAMPLE_TEMPLATE = `# Consuelo local infrastructure
# Copy to .env and fill in provider credentials separately.
# Start dependencies with: docker compose up -d db redis

# Postgres
PG_DATABASE_USER=consuelo
PG_DATABASE_PASSWORD=consuelo
PG_DATABASE_NAME=consuelo
PG_DATABASE_PORT=5432
DATABASE_URL=postgres://consuelo:consuelo@localhost:5432/consuelo

# Redis
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
`;

export function generateDockerCompose(outputDir: string = process.cwd()): void {
  const composePath = join(outputDir, 'docker-compose.yml');
  const envExamplePath = join(outputDir, '.env.example');

  for (const filePath of [composePath, envExamplePath]) {
    if (existsSync(filePath)) {
      logger.warn(`  ⚠ Overwriting existing ${basename(filePath)}`);
    }
  }

  writeFileSync(composePath, DOCKER_COMPOSE_TEMPLATE);
  writeFileSync(envExamplePath, ENV_EXAMPLE_TEMPLATE);

  logger.info('\nGenerated:');
  logger.info('  - docker-compose.yml');
  logger.info('  - .env.example');
}
