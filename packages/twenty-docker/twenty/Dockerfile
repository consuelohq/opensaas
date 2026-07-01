# Base image for common dependencies
FROM node:24-alpine AS common-deps

WORKDIR /app

# Copy only the necessary files for dependency resolution
COPY ./package.json ./yarn.lock ./.yarnrc.yml ./tsconfig.base.json ./nx.json /app/
COPY ./.yarn/releases /app/.yarn/releases
COPY ./.yarn/patches /app/.yarn/patches

COPY ./packages/twenty-emails/package.json /app/packages/twenty-emails/
COPY ./packages/twenty-server/package.json /app/packages/twenty-server/
COPY ./packages/twenty-server/patches /app/packages/twenty-server/patches
COPY ./packages/twenty-ui/package.json /app/packages/twenty-ui/
COPY ./packages/twenty-shared/package.json /app/packages/twenty-shared/
COPY ./packages/twenty-front/package.json /app/packages/twenty-front/
COPY ./packages/twenty-sdk/package.json /app/packages/twenty-sdk/

# opensaas packages (workspace deps)
COPY ./packages/agent/package.json /app/packages/agent/
COPY ./packages/analytics/package.json /app/packages/analytics/
COPY ./packages/api/package.json /app/packages/api/
COPY ./packages/cli/package.json /app/packages/cli/
COPY ./packages/coaching/package.json /app/packages/coaching/
COPY ./packages/contacts/package.json /app/packages/contacts/
COPY ./packages/dialer/package.json /app/packages/dialer/
COPY ./packages/logger/package.json /app/packages/logger/
COPY ./packages/metering/package.json /app/packages/metering/
COPY ./packages/sdk/package.json /app/packages/sdk/

# Install all dependencies
RUN yarn && yarn cache clean && npx nx reset


# Build the back
FROM common-deps AS twenty-server-build

# Copy sourcecode after installing dependences to accelerate subsequents builds
COPY ./packages/twenty-emails /app/packages/twenty-emails
COPY ./packages/twenty-shared /app/packages/twenty-shared
COPY ./packages/twenty-server /app/packages/twenty-server

# opensaas packages (@consuelo/api and its deps)
COPY ./packages/agent /app/packages/agent
COPY ./packages/api /app/packages/api
COPY ./packages/coaching /app/packages/coaching
COPY ./packages/contacts /app/packages/contacts
COPY ./packages/dialer /app/packages/dialer
COPY ./packages/logger /app/packages/logger

RUN npx nx reset && npx nx run twenty-server:build
RUN cd /app/packages/agent && npx tsc
RUN cd /app/packages/logger && npx tsc
RUN cd /app/packages/coaching && npx tsc --declaration
RUN cd /app/packages/contacts && npx tsc
RUN cd /app/packages/dialer && npx tsc --declaration
RUN cd /app/packages/api && npx tsc

RUN yarn workspaces focus --production twenty-emails twenty-shared twenty-server @consuelo/agent @consuelo/api @consuelo/dialer @consuelo/coaching @consuelo/contacts @consuelo/logger

# Build the front
FROM common-deps AS twenty-front-build

ARG REACT_APP_SERVER_BASE_URL

COPY ./packages/twenty-front /app/packages/twenty-front
COPY ./packages/twenty-ui /app/packages/twenty-ui
COPY ./packages/twenty-shared /app/packages/twenty-shared
COPY ./packages/twenty-sdk /app/packages/twenty-sdk

# opensaas packages (workspace deps needed by nx build graph)
COPY ./packages/agent /app/packages/agent
COPY ./packages/analytics /app/packages/analytics
COPY ./packages/api /app/packages/api
COPY ./packages/cli /app/packages/cli
COPY ./packages/coaching /app/packages/coaching
COPY ./packages/contacts /app/packages/contacts
COPY ./packages/dialer /app/packages/dialer
COPY ./packages/logger /app/packages/logger
COPY ./packages/metering /app/packages/metering
COPY ./packages/sdk /app/packages/sdk
RUN npx nx build twenty-shared && cd packages/twenty-front && npx @lingui/cli extract --clean && npx @lingui/cli compile
RUN NODE_OPTIONS="--max-old-space-size=4096" npx nx build twenty-front

# Final stage: Run the application
FROM node:24-alpine AS twenty

# Used to run healthcheck in docker
RUN apk add --no-cache curl jq

RUN npm install -g tsx

RUN apk add --no-cache postgresql-client

COPY ./packages/twenty-docker/twenty/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
WORKDIR /app/packages/twenty-server

ARG REACT_APP_SERVER_BASE_URL
ENV REACT_APP_SERVER_BASE_URL=$REACT_APP_SERVER_BASE_URL

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

# Copy built applications from previous stages
COPY --chown=1000 --from=twenty-server-build /app /app
COPY --chown=1000 --from=twenty-server-build /app/packages/twenty-server /app/packages/twenty-server
COPY --chown=1000 --from=twenty-front-build /app/packages/twenty-front/build /app/packages/twenty-server/dist/front
COPY --chown=1000 ./packages/os /app/packages/os

# Set metadata and labels
LABEL org.opencontainers.image.source=https://github.com/consuelohq/opensaas
LABEL org.opencontainers.image.description="Consuelo — open-source sales infrastructure. CRM server and frontend in a single container."

RUN mkdir -p /app/.local-storage /app/packages/twenty-server/.local-storage && \
    chown 1000:1000 /app/.local-storage /app/packages/twenty-server/.local-storage

# Use non root user with uid 1000
USER 1000

CMD ["node", "dist/main"]
ENTRYPOINT ["/app/entrypoint.sh"]
