FROM oven/bun:1-slim AS runtime-bundle

WORKDIR /source

COPY package.json bun.lock ./
COPY scripts/ scripts/
COPY src/ src/
COPY tools/ tools/
COPY workflows/ workflows/
COPY manifests/ manifests/
COPY hooks/ hooks/
COPY skills/ skills/
COPY steering/ steering/
COPY streams/ streams/
COPY operator/ operator/
COPY cloudflare/ cloudflare/

ARG CONSUELO_VERSION=0.0.0-dev
ARG CONSUELO_SOURCE_COMMIT=container-build
ARG TARGETOS=linux
ARG TARGETARCH

RUN bun ./scripts/build-runtime-bundle.ts build \
  --source-root /source \
  --version "$CONSUELO_VERSION" \
  --source-commit "$CONSUELO_SOURCE_COMMIT" \
  --platform "$TARGETOS" \
  --architecture "$TARGETARCH" \
  --minimum-updater-version 0.1.0 \
  --output /tmp/runtime-bundle.tar.gz

RUN mkdir -p /runtime \
  && tar -xzf /tmp/runtime-bundle.tar.gz -C /runtime \
  && bun ./scripts/build-runtime-bundle.ts verify \
    --archive /tmp/runtime-bundle.tar.gz

FROM oven/bun:1-slim AS runtime-dependencies

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY --from=runtime-bundle /runtime/package.json /runtime/bun.lock ./
RUN bun install --production --frozen-lockfile

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=runtime-bundle /runtime/ ./
COPY --from=runtime-dependencies /app/node_modules ./node_modules

EXPOSE 46321

CMD ["bun", "./scripts/server/main.ts"]
