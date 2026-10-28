import { Effect, Layer } from 'effect';

import type {
  LeadConnectorInstallation,
  LeadConnectorOAuthState,
} from '../contracts/index.js';
import {
  LeadConnectorInstallationOwnershipError,
  LeadConnectorStateError,
  errorMessage,
} from '../errors.js';
import {
  LeadConnectorInstallationStore,
  LeadConnectorOAuthStateStore,
  LeadConnectorWebhookEventStore,
} from '../ports/index.js';

export type LeadConnectorDatabase = {
  query: <T>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: T[] }>;
};

export type LeadConnectorCache = {
  get: (key: string) => Promise<string | null>;
  getDelete: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    options?: { ttlSeconds?: number; onlyIfAbsent?: boolean },
  ) => Promise<boolean>;
  delete: (key: string) => Promise<void>;
};

type InstallationRow = {
  installation_id: string;
  workspace_id: string;
  location_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  expires_at: string | Date;
  scopes: unknown;
  connected_at: string | Date;
  updated_at: string | Date;
};

const INSTALLATION_TABLE = 'consuelo_lead_connector_installations';
const CREATE_INSTALLATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS consuelo_lead_connector_installations (
    installation_id text NOT NULL,
    workspace_id text PRIMARY KEY,
    location_id text NOT NULL UNIQUE,
    access_token_ciphertext text NOT NULL,
    refresh_token_ciphertext text NOT NULL,
    expires_at timestamptz NOT NULL,
    scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
    connected_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )
`;
const CREATE_INSTALLATION_LOCATION_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS consuelo_lead_connector_installations_location_idx
    ON consuelo_lead_connector_installations (location_id)
`;
const DEFAULT_WEBHOOK_TTL_SECONDS = 7 * 24 * 60 * 60;

const stateError = (operation: string, cause: unknown) =>
  new LeadConnectorStateError({
    operation,
    message: errorMessage(cause),
    retryable: true,
    cause,
  });

const asIsoString = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const parseScopes = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  }
  return [];
};

const toInstallation = (row: InstallationRow): LeadConnectorInstallation => ({
  installationId: row.installation_id,
  workspaceId: row.workspace_id,
  locationId: row.location_id,
  accessTokenCiphertext: row.access_token_ciphertext,
  refreshTokenCiphertext: row.refresh_token_ciphertext,
  expiresAt: asIsoString(row.expires_at),
  scopes: parseScopes(row.scopes),
  connectedAt: asIsoString(row.connected_at),
  updatedAt: asIsoString(row.updated_at),
});

const databaseEffect = <T>(
  operation: string,
  run: () => Promise<T>,
): Effect.Effect<T, LeadConnectorStateError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => stateError(operation, cause),
  });

const cacheEffect = databaseEffect;

export const initializeLeadConnectorPersistence = (
  database: LeadConnectorDatabase,
): Promise<void> =>
  database
    .query(CREATE_INSTALLATION_TABLE_SQL)
    .then(() => database.query(CREATE_INSTALLATION_LOCATION_INDEX_SQL))
    .then(() => undefined);

export const createPersistentLeadConnectorStoreLayer = (options: {
  database: LeadConnectorDatabase;
  cache: LeadConnectorCache;
  keyPrefix?: string;
  webhookTtlSeconds?: number;
  now?: () => Date;
}) => {
  const prefix = options.keyPrefix ?? 'consuelo:leadconnector';
  const now = options.now ?? (() => new Date());
  const installationByWorkspace = (
    workspaceId: string,
  ): Promise<LeadConnectorInstallation | null> =>
    options.database
      .query<InstallationRow>(
        `SELECT * FROM ${INSTALLATION_TABLE} WHERE workspace_id = $1 LIMIT 1`,
        [workspaceId],
      )
      .then((result) =>
        result.rows[0] ? toInstallation(result.rows[0]) : null,
      );
  const installationByLocation = (
    locationId: string,
  ): Promise<LeadConnectorInstallation | null> =>
    options.database
      .query<InstallationRow>(
        `SELECT * FROM ${INSTALLATION_TABLE} WHERE location_id = $1 LIMIT 1`,
        [locationId],
      )
      .then((result) =>
        result.rows[0] ? toInstallation(result.rows[0]) : null,
      );

  return Layer.mergeAll(
    Layer.succeed(LeadConnectorInstallationStore, {
      getByWorkspaceId: (workspaceId) =>
        databaseEffect('get-installation-by-workspace', () =>
          installationByWorkspace(workspaceId),
        ),
      getByLocationId: (locationId) =>
        databaseEffect('get-installation-by-location', () =>
          installationByLocation(locationId),
        ),
      save: (installation) =>
        Effect.tryPromise({
          try: async () => {
            try {
              await options.database.query(
                `INSERT INTO ${INSTALLATION_TABLE} (
                  installation_id, workspace_id, location_id,
                  access_token_ciphertext, refresh_token_ciphertext,
                  expires_at, scopes, connected_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
                ON CONFLICT (workspace_id) DO UPDATE SET
                  installation_id = EXCLUDED.installation_id,
                  location_id = EXCLUDED.location_id,
                  access_token_ciphertext = EXCLUDED.access_token_ciphertext,
                  refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
                  expires_at = EXCLUDED.expires_at,
                  scopes = EXCLUDED.scopes,
                  connected_at = EXCLUDED.connected_at,
                  updated_at = EXCLUDED.updated_at`,
                [
                  installation.installationId,
                  installation.workspaceId,
                  installation.locationId,
                  installation.accessTokenCiphertext,
                  installation.refreshTokenCiphertext,
                  installation.expiresAt,
                  JSON.stringify(installation.scopes),
                  installation.connectedAt,
                  installation.updatedAt,
                ],
              );
            } catch (cause: unknown) {
              if (
                cause &&
                typeof cause === 'object' &&
                'code' in cause &&
                cause.code === '23505'
              ) {
                const owner = await installationByLocation(
                  installation.locationId,
                );
                throw new LeadConnectorInstallationOwnershipError({
                  locationId: installation.locationId,
                  workspaceId: installation.workspaceId,
                  ownerWorkspaceId: owner?.workspaceId ?? 'unknown',
                  message:
                    'LeadConnector location belongs to another workspace',
                  retryable: false,
                });
              }
              throw cause;
            }
          },
          catch: (cause) =>
            cause instanceof LeadConnectorInstallationOwnershipError
              ? cause
              : stateError('save-installation', cause),
        }),
      deleteByWorkspaceId: (workspaceId) =>
        databaseEffect('delete-installation', () =>
          options.database
            .query(
              `DELETE FROM ${INSTALLATION_TABLE} WHERE workspace_id = $1`,
              [workspaceId],
            )
            .then(() => undefined),
        ),
    }),
    Layer.succeed(LeadConnectorOAuthStateStore, {
      put: (oauthState: LeadConnectorOAuthState) =>
        cacheEffect('put-oauth-state', () => {
          const ttlSeconds = Math.max(
            1,
            Math.ceil(
              (new Date(oauthState.expiresAt).getTime() - now().getTime()) /
                1000,
            ),
          );
          return options.cache
            .set(
              `${prefix}:oauth:${oauthState.state}`,
              JSON.stringify(oauthState),
              { ttlSeconds },
            )
            .then(() => undefined);
        }),
      consume: (state) =>
        cacheEffect('consume-oauth-state', () =>
          options.cache
            .getDelete(`${prefix}:oauth:${state}`)
            .then((raw) =>
              raw ? (JSON.parse(raw) as LeadConnectorOAuthState) : null,
            ),
        ),
    }),
    Layer.succeed(LeadConnectorWebhookEventStore, {
      claim: (eventId) =>
        cacheEffect('claim-webhook-event', () =>
          options.cache.set(`${prefix}:webhook:${eventId}`, '1', {
            ttlSeconds:
              options.webhookTtlSeconds ?? DEFAULT_WEBHOOK_TTL_SECONDS,
            onlyIfAbsent: true,
          }),
        ),
    }),
  );
};
