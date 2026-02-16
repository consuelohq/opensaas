# opensaas API Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/coaching/package*.json ./packages/coaching/
COPY packages/contacts/package*.json ./packages/contacts/
COPY packages/dialer/package*.json ./packages/dialer/
COPY packages/logger/package*.json ./packages/logger/
RUN npm ci

COPY packages/api ./packages/api
COPY packages/coaching ./packages/coaching
COPY packages/contacts ./packages/contacts
COPY packages/dialer ./packages/dialer
COPY packages/logger ./packages/logger
RUN npm run build --workspace=packages/logger \
    --workspace=packages/dialer \
    --workspace=packages/coaching \
    --workspace=packages/contacts \
    --workspace=packages/api
RUN npm prune --production

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy all built packages — api imports these at runtime
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/coaching/dist ./packages/coaching/dist
COPY --from=builder /app/packages/coaching/package.json ./packages/coaching/
COPY --from=builder /app/packages/contacts/dist ./packages/contacts/dist
COPY --from=builder /app/packages/contacts/package.json ./packages/contacts/
COPY --from=builder /app/packages/dialer/dist ./packages/dialer/dist
COPY --from=builder /app/packages/dialer/package.json ./packages/dialer/
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/logger/package.json ./packages/logger/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 opensaas
USER opensaas

EXPOSE 8000

CMD ["node", "packages/api/dist/index.js"]
