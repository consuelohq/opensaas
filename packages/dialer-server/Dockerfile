FROM oven/bun:1.3.14 AS dependencies
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts

FROM oven/bun:1.3.14 AS build
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=dependencies /app /app
RUN bun run --cwd packages/logger build
RUN bun run --cwd packages/contacts build
RUN bun run --cwd packages/dialer build
RUN bun run --cwd packages/lead-connector build
RUN bun run --cwd packages/dialer-server build

FROM debian:bookworm-slim AS runtime
RUN useradd --create-home --uid 10001 dialer
COPY --from=build /app/packages/dialer-server/dist/dialer-server /usr/local/bin/dialer-server
USER dialer
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/dialer-server"]
