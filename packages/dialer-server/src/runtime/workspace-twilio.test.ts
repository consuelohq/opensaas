import { describe, expect, it, mock } from 'bun:test';
import twilio from 'twilio';
import { createParallelGroup } from '@consuelo/dialer';
import { createWorkspaceTwilioAuthority, createWorkspaceVoiceCipher } from './workspace-twilio';
import { selectProviderDialerForGroup } from './railway';
import { RedisParallelStore } from '@consuelo/dialer';

const master = 'AC' + '1'.repeat(32);
const child = 'AC' + '2'.repeat(32);
const other = 'AC' + '3'.repeat(32);
const apiKey = 'SK' + '4'.repeat(32);
const app = 'AP' + '5'.repeat(32);
const parentKey = 'SK' + '6'.repeat(32);
const parentApp = 'AP' + '7'.repeat(32);
const rootSecret = 'voice-encryption-root-for-tests-at-least-32-chars';
const workspace = 'workspace-1';
const user = 'user-1';
const phone = '+19804093891';
const mockDb = () => {
  const accounts = new Map<string, { provider_account_id: string; status: string }>(
    [[workspace, { provider_account_id: child, status: 'active' }]],
  );
  const numbers = new Map([[phone, { status: 'active', user_id: user }]]);
  const voices = new Map<string, Record<string,string>>();
  const query = async <T>(sql: string, args: readonly unknown[] = []) => {
    const wid = String(args[0] ?? '');
    if (sql.includes('INSERT INTO dialer_workspace_twilio_voice_credentials')) {
      voices.set(wid, { provider_account_id: String(args[1]),
        api_key_sid: String(args[2]), api_key_secret_ciphertext: String(args[3]),
        twiml_app_sid: String(args[4]), status: 'active' });
      return { rows: [] as T[] };
    }
    if (sql.includes('FROM dialer_workspace_twilio_voice_credentials')) {
      const v = voices.get(wid);
      const account = accounts.get(wid);
      return { rows: v && account?.status === 'active' &&
        v.provider_account_id === args[1] ? [v as T] : [] };
    }
    if (sql.includes('FROM dialer_phone_numbers')) {
      const a = accounts.get(wid);
      const result = (args[2] as string[]).flatMap(n => {
        const v = numbers.get(n);
        return v && v.user_id === args[1] ? [{
          phone_number: n, status: v.status,
          provider_account_id: a?.provider_account_id ?? null,
          account_status: a?.status ?? null,
        } as T] : [];
      });
      return { rows: result };
    }
    if (sql.includes('WHERE provider_account_id=$1 AND status=')) {
      return { rows: [...accounts.values()]
        .filter(a => a.provider_account_id === args[0] && a.status === 'active') as T[] };
    }
    if (sql.includes('FROM dialer_workspace_telephony_accounts')) {
      const a = accounts.get(wid);
      return { rows: a ? [a as T] : [] };
    }
    throw Error('Unexpected SQL: ' + sql);
  };
  return { accounts, numbers, voices, database: { query } };
};
const make = (database: ReturnType<typeof mockDb>['database'],
  fetchImpl?: typeof fetch) => createWorkspaceTwilioAuthority({
  database,
  masterAccountSid: master,
  masterAuthToken: 'parent-token-secret',
  parentVoiceCredentials: {
    apiKey: parentKey, apiSecret: 'parent-api-signing-secret',
    twimlAppSid: parentApp,
  },
  encryptionSecret: rootSecret,
  publicUrl: 'https://dialer.example.test',
  fetchImpl,
});
const jwtPayload = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as {
    sub: string; iss: string; grants: { voice: { outgoing: { application_sid: string } } };
  };

describe('DEV-1686 managed Twilio workspace authority', () => {
  it('encrypts child API secrets with per-workspace/account authenticated context', () => {
    const vault = createWorkspaceVoiceCipher(rootSecret);
    const encrypted = vault.encrypt(workspace, child, 'sensitive-api-secret');
    expect(encrypted).not.toContain('sensitive-api-secret');
    expect(vault.decrypt(workspace, child, encrypted)).toBe('sensitive-api-secret');
    expect(() => vault.decrypt('another-workspace', child, encrypted)).toThrow();
    expect(() => vault.decrypt(workspace, other, encrypted)).toThrow();
    expect(() => createWorkspaceVoiceCipher('short')).toThrow();
  });

  it('fails closed on missing child Voice credentials before a carrier call can be made', async () => {
    const { database } = mockDb();
    const authority = make(database);
    await expect(authority.resolveCallerAccount({
      workspaceId: workspace, userId: user, callerIds: [phone],
    })).rejects.toThrow('Voice signing credentials');
    await expect(authority.issueVoiceToken({ workspaceId: workspace, userId: user }))
      .rejects.toThrow('Voice signing credentials');
  });

  it('routes only active, assigned caller IDs to their owning account', async () => {
    const db = mockDb(), authority = make(db.database);
    await authority.saveVoiceCredentials(workspace, child, {
      apiKey, apiSecret: 'child-secret', twimlAppSid: app,
    });
    expect(await authority.resolveCallerAccount({
      workspaceId: workspace, userId: user, callerIds: [phone],
    })).toBe(child);
    await expect(authority.resolveCallerAccount({
      workspaceId: workspace, userId: 'another-user', callerIds: [phone],
    })).rejects.toThrow('not active and assigned');
    await expect(authority.resolveCallerAccount({
      workspaceId: workspace, userId: user, callerIds: ['+15550100001'],
    })).rejects.toThrow('not active and assigned');
    db.accounts.get(workspace)!.status = 'disabled';
    await expect(authority.resolveCallerAccount({
      workspaceId: workspace, userId: user, callerIds: [phone],
    })).rejects.toThrow('disabled');
  });

  it('issues Web Voice JWTs for the exact workspace child account, key and TwiML app', async () => {
    const db = mockDb(), authority = make(db.database);
    await authority.saveVoiceCredentials(workspace, child, {
      apiKey, apiSecret: 'child-secret', twimlAppSid: app,
    });
    const token = await authority.issueVoiceToken({ workspaceId: workspace, userId: user });
    const claims = jwtPayload(token.token);
    expect(claims.sub).toBe(child);
    expect(claims.iss).toBe(apiKey);
    expect(claims.grants.voice.outgoing.application_sid).toBe(app);
    expect(String(db.voices.get(workspace)?.api_key_secret_ciphertext)).not.toContain('child-secret');
    const legacy = await authority.issueVoiceToken({ workspaceId: 'legacy-workspace', userId: user });
    const parent = jwtPayload(legacy.token);
    expect(parent.sub).toBe(master);
    expect(parent.iss).toBe(parentKey);
    expect(parent.grants.voice.outgoing.application_sid).toBe(parentApp);
  });

  it('validates signed child callbacks with child AuthToken, rejecting parent, unknown and wrong-account signatures', async () => {
    const db = mockDb(), childToken = 'child-auth-token-fixture-long';
    const fetchImpl = mock(async () => new Response(JSON.stringify({
      sid: child, status: 'active', auth_token: childToken,
    }), { status: 200 })) as unknown as typeof fetch;
    const authority = make(db.database, fetchImpl);
    const params = { AccountSid: child, CallSid: 'CA123', CallStatus: 'completed' };
    const url = 'https://dialer.example.test/webhooks/twilio/status';
    const input = (token: string, account = child) => ({
      signature: twilio.getExpectedTwilioSignature(token, url,
        { ...params, AccountSid: account }),
      url, contentType: 'application/x-www-form-urlencoded',
      rawBody: new URLSearchParams(params).toString(),
      params: { ...params, AccountSid: account },
    });
    expect(await authority.verifyTwilioSignature(input(childToken))).toBe(true);
    expect(await authority.verifyTwilioSignature(input('parent-token-secret'))).toBe(false);
    expect(await authority.verifyTwilioSignature(input(childToken, other))).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('preserves only the legacy parent-signed Media Stream handshake without an AccountSid', async () => {
    const authority = make(mockDb().database);
    const url = 'https://dialer.example.test/webhooks/twilio/media';
    const request = {
      signature: twilio.getExpectedTwilioSignature('parent-token-secret', url, {}),
      url, rawBody: '', params: {},
      contentType: '',
    };
    expect(await authority.verifyTwilioSignature(request)).toBe(true);
    expect(await authority.verifyTwilioSignature({
      ...request, url: url.replace('/media', '/status'),
    })).toBe(false);
    expect(await authority.verifyTwilioSignature({
      ...request, signature: 'wrong-parent-signature',
    })).toBe(false);
  });

  it('persists account routing in group state for independent restart and callbacks', async () => {
    const store = new Map<string,string>();
    const redis = {
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => { store.set(k, v); return 'OK'; },
      del: async (k: string) => Number(store.delete(k)),
      eval: async () => 0,
    };
    const parallelStore = new RedisParallelStore(redis);
    const group = createParallelGroup('group-1', {
      workspaceId: workspace,
      providerMode: 'live',
      providerAccountId: child,
      userId: user, queueId: 'queue', customerNumbers: ['+15550100001'],
      fromNumbers: [phone], statusCallbackUrl: 'https://dialer.example.test/status',
      customerTwimlUrl: 'https://dialer.example.test/twiml',
      profile: { id: 'balanced', staggerMs: 0, maxConcurrent: 1, amdTimeoutMs: 1000,
        maxCallDurationMs: 10000, name: 'balanced', description: 'test', answerTimeoutMs: 1000 } as unknown as import('@consuelo/dialer').ParallelDialProfile,
    }, '2026-11-06T04:00:00.000Z');
    await parallelStore.setGroup('group-1', JSON.stringify(group), 600);
    const liveDialer = {} as never, testDialer = {} as never;
    const childDialer = {} as never;
    expect(await selectProviderDialerForGroup({
      liveDialer, testDialer, parallelStore, forAccount: account => {
        expect(account).toBe(child);
        return childDialer;
      },
    }, 'group-1')).toBe(childDialer);
    await expect(selectProviderDialerForGroup({
      liveDialer, testDialer, parallelStore,
    }, 'group-1')).rejects.toThrow('No scoped provider router');
  });
});
