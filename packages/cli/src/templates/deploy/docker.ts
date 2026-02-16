import type { TemplateFile, DeployConfig } from './types.js';

export function dockerTemplates(config: DeployConfig): TemplateFile[] {
  const twentySvc = config.twentyEnabled ? `
  consuelo-twenty:
    image: ghcr.io/consuelohq/opensaas:\${TAG:-latest}
    restart: always
    ports:
      - "${config.serverPort}:${config.serverPort}"
    environment:
      NODE_PORT: ${config.serverPort}
      PG_DATABASE_URL: postgres://\${PG_DATABASE_USER:-postgres}:\${PG_DATABASE_PASSWORD:-postgres}@consuelo-postgres:5432/\${PG_DATABASE_NAME:-default}
      SERVER_URL: \${SERVER_URL:-http://localhost:${config.serverPort}}
      REDIS_URL: redis://consuelo-redis:6379
      APP_SECRET: \${APP_SECRET}
    depends_on:
      consuelo-postgres:
        condition: service_healthy
      consuelo-redis:
        condition: service_healthy
    healthcheck:
      test: curl --fail http://localhost:${config.serverPort}/healthz
      interval: 5s
      timeout: 5s
      retries: 20
    networks:
      - consuelo-network
` : '';

  const compose = `name: consuelo

services:
  consuelo-postgres:
    image: postgres:16
    restart: always
    volumes:
      - consuelo_postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: \${PG_DATABASE_NAME:-default}
      POSTGRES_PASSWORD: \${PG_DATABASE_PASSWORD:-postgres}
      POSTGRES_USER: \${PG_DATABASE_USER:-postgres}
    healthcheck:
      test: pg_isready -U \${PG_DATABASE_USER:-postgres}
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - consuelo-network

  consuelo-redis:
    image: redis:7-alpine
    restart: always
    command: ["--maxmemory-policy", "noeviction"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - consuelo-network

  consuelo-api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "\${API_PORT:-${config.apiPort}}:${config.apiPort}"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://\${PG_DATABASE_USER:-postgres}:\${PG_DATABASE_PASSWORD:-postgres}@consuelo-postgres:5432/\${PG_DATABASE_NAME:-default}
      TWILIO_ACCOUNT_SID: \${TWILIO_ACCOUNT_SID}
      TWILIO_AUTH_TOKEN: \${TWILIO_AUTH_TOKEN}
      GROQ_API_KEY: \${GROQ_API_KEY}
    depends_on:
      consuelo-postgres:
        condition: service_healthy
    healthcheck:
      test: curl --fail http://localhost:${config.apiPort}/health
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - consuelo-network
${twentySvc}
volumes:
  consuelo_postgres_data:

networks:
  consuelo-network:
    driver: bridge
`;

  const dockerfile = `FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages/api/package.json packages/api/
COPY packages/logger/package.json packages/logger/
RUN corepack enable && yarn install --immutable

COPY packages/logger packages/logger
COPY packages/api packages/api
RUN yarn workspace @consuelo/api build

FROM node:24-alpine
RUN addgroup -S consuelo && adduser -S consuelo -G consuelo
WORKDIR /app
COPY --from=builder --chown=consuelo:consuelo /app .
USER consuelo
EXPOSE ${config.apiPort}
CMD ["node", "packages/api/dist/index.js"]
`;

  const dockerignore = `node_modules
.git
.env
.env.*
*.log
.next
dist
packages/twenty-e2e-testing
packages/twenty-website
`;

  return [
    { path: 'docker-compose.yml', content: compose },
    { path: 'Dockerfile', content: dockerfile },
    { path: '.dockerignore', content: dockerignore },
  ];
}
