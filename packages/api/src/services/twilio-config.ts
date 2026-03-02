import * as Sentry from '@sentry/node';
import {
  encryptCredential,
  decryptCredential,
} from './twilio-encryption.js';
import { getSharedPool } from '../shared/db.js';
import { createLogger } from '@consuelo/logger';

const logger = createLogger('twilio-config');

export type TwilioMode = 'hosted' | 'byok';

export type WorkspaceTwilioConfig = {
  workspaceId: string;
  mode: TwilioMode;
  subAccountSid: string | null;
  subAccountTokenEncrypted: string | null;
  byokAccountSidEncrypted: string | null;
  byokAuthTokenEncrypted: string | null;
  byokApiKeyEncrypted: string | null;
  byokApiSecretEncrypted: string | null;
  twimlAppSid: string | null;
};

export type DecryptedCredentials = {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
  twimlAppSid?: string;
};

// check if this is a hosted consuelo instance (master twilio account configured)
export const isHostedInstance = (): boolean =>
  !!(
    process.env.TWILIO_MASTER_ACCOUNT_SID &&
    process.env.TWILIO_MASTER_AUTH_TOKEN
  );

export const getWorkspaceTwilioConfig = async (
  workspaceId: string,
): Promise<WorkspaceTwilioConfig | null> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(
      'SELECT workspace_id, mode, sub_account_sid, sub_account_token_encrypted, byok_account_sid_encrypted, byok_auth_token_encrypted, byok_api_key_encrypted, byok_api_secret_encrypted, twiml_app_sid FROM workspace_twilio_config WHERE workspace_id = $1',
      [workspaceId],
    );
    if (!rows[0]) return null;
    const row = rows[0] as Record<string, unknown>;
    return {
      workspaceId: row.workspace_id as string,
      mode: row.mode as TwilioMode,
      subAccountSid: (row.sub_account_sid as string) ?? null,
      subAccountTokenEncrypted:
        (row.sub_account_token_encrypted as string) ?? null,
      byokAccountSidEncrypted:
        (row.byok_account_sid_encrypted as string) ?? null,
      byokAuthTokenEncrypted:
        (row.byok_auth_token_encrypted as string) ?? null,
      byokApiKeyEncrypted: (row.byok_api_key_encrypted as string) ?? null,
      byokApiSecretEncrypted:
        (row.byok_api_secret_encrypted as string) ?? null,
      twimlAppSid: (row.twiml_app_sid as string) ?? null,
    };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const getDecryptedCredentials = (
  config: WorkspaceTwilioConfig,
): DecryptedCredentials => {
  const wid = config.workspaceId;
  if (config.mode === 'hosted') {
    if (!config.subAccountSid || !config.subAccountTokenEncrypted) {
      throw new Error('hosted config missing sub-account credentials');
    }
    return {
      accountSid: config.subAccountSid,
      authToken: decryptCredential(config.subAccountTokenEncrypted, wid),
      twimlAppSid: config.twimlAppSid ?? undefined,
    };
  }
  // byok
  if (!config.byokAccountSidEncrypted || !config.byokAuthTokenEncrypted) {
    throw new Error('BYOK config missing credentials');
  }
  return {
    accountSid: decryptCredential(config.byokAccountSidEncrypted, wid),
    authToken: decryptCredential(config.byokAuthTokenEncrypted, wid),
    apiKey: config.byokApiKeyEncrypted
      ? decryptCredential(config.byokApiKeyEncrypted, wid)
      : undefined,
    apiSecret: config.byokApiSecretEncrypted
      ? decryptCredential(config.byokApiSecretEncrypted, wid)
      : undefined,
    twimlAppSid: config.twimlAppSid ?? undefined,
  };
};

export const provisionSubAccount = async (
  workspaceId: string,
): Promise<DecryptedCredentials> => {
  const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
  const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
  if (!masterSid || !masterToken) {
    throw new Error('TWILIO_MASTER_ACCOUNT_SID and TWILIO_MASTER_AUTH_TOKEN required for hosted mode');
  }

  try {
    const twilio = await import('twilio');
    const createClient =
      twilio.default ?? (twilio as unknown as { default: typeof twilio.default }).default;
    const masterClient = createClient(masterSid, masterToken);

    // create sub-account
    const subAccount = await masterClient.api.accounts.create({
      friendlyName: `consuelo-${workspaceId}`,
    });

    const pool = await getSharedPool();

    // store encrypted credentials
    await pool.query(
      'INSERT INTO workspace_twilio_config (workspace_id, mode, sub_account_sid, sub_account_token_encrypted) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id) DO UPDATE SET mode = $2, sub_account_sid = $3, sub_account_token_encrypted = $4, updated_at = NOW()',
      [
        workspaceId,
        'hosted',
        subAccount.sid,
        encryptCredential(subAccount.authToken, workspaceId),
      ],
    );

    // create TwiML app on the sub-account
    const subClient = createClient(subAccount.sid, subAccount.authToken);
    const baseUrl = process.env.API_BASE_URL;
    const twimlApp = await subClient.applications.create({
      voiceUrl: baseUrl ? `${baseUrl}/v1/voice/twiml` : '',
      voiceMethod: 'POST',
      friendlyName: 'Consuelo Dialer',
    });

    await pool.query(
      'UPDATE workspace_twilio_config SET twiml_app_sid = $1, updated_at = NOW() WHERE workspace_id = $2',
      [twimlApp.sid, workspaceId],
    );

    logger.info('sub-account provisioned', {
      workspaceId,
      subAccountSid: subAccount.sid,
      twimlAppSid: twimlApp.sid,
    });

    return {
      accountSid: subAccount.sid,
      authToken: subAccount.authToken,
      twimlAppSid: twimlApp.sid,
    };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const saveByokConfig = async (
  workspaceId: string,
  creds: {
    accountSid: string;
    authToken: string;
    apiKey?: string;
    apiSecret?: string;
  },
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    await pool.query(
      'INSERT INTO workspace_twilio_config (workspace_id, mode, byok_account_sid_encrypted, byok_auth_token_encrypted, byok_api_key_encrypted, byok_api_secret_encrypted) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (workspace_id) DO UPDATE SET mode = $2, byok_account_sid_encrypted = $3, byok_auth_token_encrypted = $4, byok_api_key_encrypted = $5, byok_api_secret_encrypted = $6, updated_at = NOW()',
      [
        workspaceId,
        'byok',
        encryptCredential(creds.accountSid, workspaceId),
        encryptCredential(creds.authToken, workspaceId),
        creds.apiKey ? encryptCredential(creds.apiKey, workspaceId) : null,
        creds.apiSecret
          ? encryptCredential(creds.apiSecret, workspaceId)
          : null,
      ],
    );
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const deleteWorkspaceTwilioConfig = async (
  workspaceId: string,
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    await pool.query(
      'DELETE FROM workspace_twilio_config WHERE workspace_id = $1',
      [workspaceId],
    );
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

// mask a credential for display (show first 4 + last 4 chars)
export const maskCredential = (value: string): string => {
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};
