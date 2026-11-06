/**
 * Explicitly authorized, idempotent child-account Voice SDK bootstrap.
 * Required: DIALER_VOICE_WORKSPACE_ID, DIALER_VOICE_PROVISION_CONFIRM=DEV-1686.
 *
 * Never prints account credentials, API secrets, phone numbers or JWTs.
 * Runs with Railway-managed environment values. No billing/number operations.
 */
import twilio from 'twilio';
import { Pool } from 'pg';
import { Effect } from 'effect';
import { initializeCommercialPersistence } from '../src/commercial/persistence';
import { createWorkspaceTwilioAuthority } from '../src/runtime/workspace-twilio';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is required');
  return value;
};

const provision = async () => {
  if (required('DIALER_VOICE_PROVISION_CONFIRM') !== 'DEV-1686') {
    throw new Error('Provisioning is not explicitly authorized');
  }
  const workspaceId = required('DIALER_VOICE_WORKSPACE_ID');
  const masterSid = required('TWILIO_ACCOUNT_SID');
  const masterToken = required('TWILIO_AUTH_TOKEN');
  const publicOrigin = new URL(required('DIALER_SERVER_PUBLIC_URL'));
  if (publicOrigin.protocol !== 'https:' || publicOrigin.pathname !== '/') {
    throw new Error('Twilio webhook URL must be the production HTTPS origin');
  }

  const pool = new Pool({ connectionString: required('DATABASE_URL'), max: 1 });
  try {
    // Idempotent table migration before any provider mutation; no billing rows.
    await Effect.runPromise(initializeCommercialPersistence(pool));
    const db = { query: (sql: string, params?: readonly unknown[]) =>
      pool.query(sql, params as unknown[] | undefined) };
    const authority = createWorkspaceTwilioAuthority({
      database: db,
      masterAccountSid: masterSid,
      masterAuthToken: masterToken,
      parentVoiceCredentials: {},
      encryptionSecret: required('LEADCONNECTOR_TOKEN_ENCRYPTION_KEY'),
      publicUrl: publicOrigin.origin,
    });
    const target = await authority.accountForWorkspace(workspaceId);
    if (!target || target === masterSid) {
      throw new Error('Expected an active child-account owning workspace');
    }
    const existing = await pool.query(
      "SELECT provider_account_id,status FROM dialer_workspace_twilio_voice_credentials "+
      "WHERE workspace_id=$1",
      [workspaceId],
    );
    if (existing.rows.length) {
      if (existing.rows[0].provider_account_id !== target ||
          existing.rows[0].status !== 'active') {
        throw new Error('Existing workspace Voice credentials conflict with expected owner');
      }
      await authority.loadVoice(workspaceId, target);
      process.stdout.write(JSON.stringify({ ok: true, alreadyProvisioned: true,
        providerMutations: 0, encryptionVerified: true }) + '\n');
      return;
    }

    const parent = twilio(masterSid, masterToken);
    const ownedAccount = await parent.api.v2010.accounts(target).fetch();
    if (ownedAccount.status !== 'active' || ownedAccount.sid !== target) {
      throw new Error('Target subaccount is not active under the configured parent');
    }
    const childClient = twilio(masterSid, masterToken, { accountSid: target });
    const appName = 'Consuelo Dialer Workspace Voice';
    const matchingApps = await childClient.applications.list({
      friendlyName: appName, limit: 5,
    });
    let appSid = matchingApps.find(v =>
      v.voiceUrl === publicOrigin.origin + '/webhooks/twilio/agent-twiml' &&
      v.voiceMethod?.toUpperCase() === 'POST')?.sid;
    let appCreated = false;
    if (!appSid) {
      const app = await childClient.applications.create({
        friendlyName: appName,
        voiceUrl: publicOrigin.origin + '/webhooks/twilio/agent-twiml',
        voiceMethod: 'POST',
      });
      appSid = app.sid;
      appCreated = true;
    }
    let apiKeySid: string | undefined;
    try {
      const key = await childClient.newKeys.create({
        friendlyName: 'Consuelo Dialer Workspace Web Voice',
      });
      apiKeySid = key.sid;
      if (!apiKeySid.startsWith('SK') || !key.secret) {
        throw new Error('Twilio did not return a usable new child API key');
      }
      await authority.saveVoiceCredentials(workspaceId, target, {
        apiKey: apiKeySid, apiSecret: key.secret, twimlAppSid: appSid,
      });
      const loaded = await authority.loadVoice(workspaceId, target);
      if (loaded.apiKey !== apiKeySid || loaded.apiSecret !== key.secret ||
          loaded.twimlAppSid !== appSid) {
        throw new Error('Encrypted Voice credential roundtrip did not match');
      }
      process.stdout.write(JSON.stringify({ ok: true, alreadyProvisioned: false,
        appCreated, apiKeyCreated: true, databaseEncrypted: true,
        webVoiceAccountMatches: true }) + '\n');
    } catch (error: unknown) {
      // Revoke ONLY the freshly issued, unused key if durable storage failed.
      if (apiKeySid) {
        try { await childClient.newKeys(apiKeySid).remove(); } catch {
          throw new Error('New child API key could not be stored OR revoked');
        }
      }
      throw error;
    }
  } finally {
    await pool.end();
  }
};
await provision().catch(error => {
  process.stderr.write(JSON.stringify({ event: 'twilio-voice-provisioning-failed',
    error: error instanceof Error ? error.message : 'unknown' }) + '\n');
  process.exitCode = 1;
});
