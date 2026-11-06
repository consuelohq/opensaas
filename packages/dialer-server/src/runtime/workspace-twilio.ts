import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Dialer, type VoiceToken } from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import type { TwilioSignatureInput } from '../contracts';
import { createTwilioSignatureVerifier } from './twilio-signature';

type Sql = Pick<LeadConnectorDatabase, 'query'>;
type AccountRow = { provider_account_id: string; status: string };
type VoiceRow = { provider_account_id: string; api_key_sid: string;
  api_key_secret_ciphertext: string; twiml_app_sid: string; status: string };
const sid = (v: string, prefix: 'AC' | 'SK' | 'AP'): string => {
  if (!new RegExp('^' + prefix + '[a-fA-F0-9]{32}$').test(v)) {
    throw new Error('Invalid Twilio resource SID');
  }
  return v;
};

export const createWorkspaceVoiceCipher = (secret: string) => {
  if (secret.trim().length < 24) throw new Error('Voice encryption root is unavailable');
  const key = createHash('sha256')
    .update('consuelo-dialer-workspace-voice-credentials:v1:')
    .update(secret).digest();
  const aad = (workspaceId: string, accountId: string) =>
    Buffer.from(JSON.stringify([workspaceId, accountId]), 'utf8');
  return {
    encrypt(workspaceId: string, accountId: string, value: string): string {
      sid(accountId, 'AC');
      if (!workspaceId || !value) throw new Error('Voice credential context is missing');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad(workspaceId, accountId));
      const payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return ['voice1', iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'), payload.toString('base64url')].join('.');
    },
    decrypt(workspaceId: string, accountId: string, payload: string): string {
      sid(accountId, 'AC');
      try {
        const parts = payload.split('.');
        if (parts.length !== 4 || parts[0] !== 'voice1' ||
            parts.slice(1).some(v => !v)) throw new Error('Invalid envelope');
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'));
        decipher.setAAD(aad(workspaceId, accountId));
        decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
        return Buffer.concat([
          decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final(),
        ]).toString('utf8');
      } catch {
        throw new Error('Voice credential authentication failed');
      }
    },
  };
};

export const createWorkspaceTwilioAuthority = (input: {
  database: Sql;
  masterAccountSid: string;
  masterAuthToken: string;
  parentVoiceCredentials: { apiKey?: string; apiSecret?: string; twimlAppSid?: string };
  encryptionSecret: string;
  publicUrl: string;
  fetchImpl?: typeof fetch;
}) => {
  const masterSid = sid(input.masterAccountSid, 'AC');
  const cipher = createWorkspaceVoiceCipher(input.encryptionSecret);
  const childTokens = new Map<string, { token: string; expiresAt: number }>();
  const accountForWorkspace = async (workspaceId: string): Promise<string | null> => {
    try {
    const result = await input.database.query<AccountRow>(
      'SELECT provider_account_id, status FROM dialer_workspace_telephony_accounts WHERE workspace_id = $1',
      [workspaceId],
    );
    if (!result.rows.length) return null; // historical parent-owned workspace
    const account = result.rows[0];
    if (account.status !== 'active') throw new Error('Workspace telephony account disabled');
    return sid(account.provider_account_id, 'AC');
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  const loadVoice = async (workspaceId: string, accountId: string) => {
    try {
    const result = await input.database.query<VoiceRow>(
      "SELECT v.provider_account_id,v.api_key_sid,v.api_key_secret_ciphertext,v.twiml_app_sid,v.status "+
      "FROM dialer_workspace_twilio_voice_credentials v "+
      "JOIN dialer_workspace_telephony_accounts a ON a.workspace_id=v.workspace_id "+
      "AND a.provider_account_id=v.provider_account_id "+
      "WHERE v.workspace_id=$1 AND v.provider_account_id=$2 AND a.status='active'",
      [workspaceId, accountId],
    );
    const row = result.rows[0];
    if (!row || row.status !== 'active') throw new Error('Workspace Voice signing credentials unavailable');
    sid(row.provider_account_id, 'AC');
    return {
      apiKey: sid(row.api_key_sid, 'SK'),
      apiSecret: cipher.decrypt(workspaceId, accountId, row.api_key_secret_ciphertext),
      twimlAppSid: sid(row.twiml_app_sid, 'AP'),
    };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  const resolveCallerAccount = async (params: {
    workspaceId: string; userId: string; callerIds: readonly string[];
  }): Promise<string> => {
    try {
    const unique = [...new Set(params.callerIds)];
    if (!unique.length) throw new Error('Outbound caller identity missing');
    const result = await input.database.query<{
      phone_number: string; status: string; provider_account_id: string | null;
      account_status: string | null;
    }>(
      "SELECT n.phone_number,n.status,a.provider_account_id,a.status AS account_status "+
      "FROM dialer_phone_numbers n LEFT JOIN dialer_workspace_telephony_accounts a "+
      "ON a.workspace_id=n.workspace_id "+
      "WHERE n.workspace_id=$1 AND n.user_id=$2 AND n.phone_number=ANY($3::text[])",
      [params.workspaceId, params.userId, unique],
    );
    if (result.rows.length !== unique.length ||
        result.rows.some(row => row.status !== 'active' || !unique.includes(row.phone_number))) {
      throw new Error('Outbound caller number is not active and assigned to this workspace user');
    }
    if (result.rows.some(row => row.account_status !== null && row.account_status !== 'active')) {
      throw new Error('Workspace telephony account disabled');
    }
    const accounts = new Set(result.rows.map(row => row.provider_account_id ?? masterSid));
    if (accounts.size !== 1) throw new Error('Outbound caller IDs cross Twilio accounts');
    const accountId = sid([...accounts][0], 'AC');
    const owned = await accountForWorkspace(params.workspaceId);
    if (owned && owned !== accountId) throw new Error('Outbound caller account ownership mismatch');
    // Important: enforce matching Web Voice credentials before ANY Twilio side effect.
    if (accountId !== masterSid) await loadVoice(params.workspaceId, accountId);
    return accountId;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  const issueVoiceToken = async (identity: { workspaceId: string; userId: string }): Promise<VoiceToken> => {
    try {
    const owned = await accountForWorkspace(identity.workspaceId);
    const accountId = owned ?? masterSid;
    const creds = owned && owned !== masterSid
      ? await loadVoice(identity.workspaceId, owned) : input.parentVoiceCredentials;
    if (!creds.apiKey || !creds.apiSecret || !creds.twimlAppSid) {
      throw new Error('Voice SDK signing authority unavailable');
    }
    return new Dialer({ credentials: {
      accountSid: accountId, authToken: input.masterAuthToken,
      apiKey: creds.apiKey, apiSecret: creds.apiSecret,
      twimlAppSid: creds.twimlAppSid,
    }}).getToken(identity.userId);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  const childAuthToken = async (accountId: string): Promise<string> => {
    try {
    const cached = childTokens.get(accountId);
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const response = await (input.fetchImpl ?? fetch)(
      'https://api.twilio.com/2010-04-01/Accounts/' + accountId + '.json', {
        headers: { Authorization: 'Basic ' +
          Buffer.from(masterSid + ':' + input.masterAuthToken).toString('base64') },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) throw new Error('Child Twilio webhook authority unavailable');
    const account = await response.json() as { sid?: string; auth_token?: string; status?: string };
    if (account.sid !== accountId || account.status !== 'active' ||
        !account.auth_token || account.auth_token.length < 20) {
      throw new Error('Child Twilio webhook auth token unavailable');
    }
    childTokens.set(accountId, { token: account.auth_token, expiresAt: Date.now() + 120_000 });
    return account.auth_token;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  const parentVerifier = createTwilioSignatureVerifier(input.masterAuthToken, input.publicUrl);
  const verifyTwilioSignature = async (callback: TwilioSignatureInput): Promise<boolean> => {
    try {
    const accountId = callback.params.AccountSid;
    if (!accountId) {
      // Twilio's legacy Media Stream WebSocket handshake has no form body.
      // Preserve the *parent* signed handshake only on its exact route;
      // a child stream without signed account scope remains fail-closed.
      return new URL(callback.url).pathname === '/webhooks/twilio/media'
        && parentVerifier(callback);
    }
    if (!/^AC[a-fA-F0-9]{32}$/.test(accountId)) return false;
    if (accountId === masterSid) return parentVerifier(callback);
    const result = await input.database.query<{ provider_account_id: string }>(
      "SELECT provider_account_id FROM dialer_workspace_telephony_accounts "+
      "WHERE provider_account_id=$1 AND status='active' LIMIT 1",
      [accountId],
    );
    if (result.rows.length !== 1) return false;
    return createTwilioSignatureVerifier(
      await childAuthToken(accountId), input.publicUrl,
    )(callback);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  const saveVoiceCredentials = async (workspaceId: string, accountId: string,
    credentials: { apiKey: string; apiSecret: string; twimlAppSid: string }): Promise<void> => {
    try {
    if ((await accountForWorkspace(workspaceId)) !== accountId) {
      throw new Error('Cannot save credentials for an unowned Twilio account');
    }
    const encrypted = cipher.encrypt(workspaceId, accountId, credentials.apiSecret);
    await input.database.query(
      "INSERT INTO dialer_workspace_twilio_voice_credentials "+
      "(workspace_id,provider_account_id,api_key_sid,api_key_secret_ciphertext,twiml_app_sid,status) "+
      "VALUES($1,$2,$3,$4,$5,'active') ON CONFLICT(workspace_id) DO UPDATE SET "+
      "provider_account_id=EXCLUDED.provider_account_id,api_key_sid=EXCLUDED.api_key_sid, "+
      "api_key_secret_ciphertext=EXCLUDED.api_key_secret_ciphertext, "+
      "twiml_app_sid=EXCLUDED.twiml_app_sid,status='active',updated_at=now()",
      [workspaceId, accountId, sid(credentials.apiKey, 'SK'),
        encrypted, sid(credentials.twimlAppSid, 'AP')],
    );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error("Workspace Twilio authority failed", { cause });
    }
  };

  return { accountForWorkspace, loadVoice, resolveCallerAccount,
    issueVoiceToken, verifyTwilioSignature, saveVoiceCredentials };
};
