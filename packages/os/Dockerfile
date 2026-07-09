FROM oven/bun:1-slim

WORKDIR /app

COPY package.json ./
RUN bun install --production

COPY scripts/ scripts/
COPY skills/ skills/
COPY tooling/ tooling/

EXPOSE 8850

CMD ["bun", "./scripts/server.ts"]
