import { describe, expect, it } from 'bun:test';
import type { Pool } from 'pg';
import {
  outboundRepIdFromClient,
  resolveOutboundCarrierAccount,
  resolveStoredOutboundAccount,
} from './outbound-capacity';

const parent='AC'+'1'.repeat(32);
const child='AC'+'2'.repeat(32);
const other='AC'+'3'.repeat(32);
const workspace='workspace-1';
const createPool=(entries: Record<string,{provider_account_id:string,status:string}>) => ({
  query: async (_sql: string, params: unknown[]) => ({
    rows: entries[String(params[0])] ? [entries[String(params[0])]] : [],
  }),
}) as unknown as Pick<Pool, 'query'>;

describe('DEV-1686 outbound-capacity account and Web client identity fencing', () => {
  it('resolves the exact active owning Twilio child account', async () => {
    const pool=createPool({[workspace]:{provider_account_id:child,status:'active'}});
    expect(await resolveOutboundCarrierAccount(pool,workspace,parent)).toBe(child);
    expect(await resolveOutboundCarrierAccount(pool,'legacy-workspace',parent)).toBe(parent);
  });
  it('refuses a disabled or malformed owner rather than falling back to parent', async () => {
    await expect(resolveOutboundCarrierAccount(createPool({
      [workspace]:{provider_account_id:child,status:'disabled'},
    }),workspace,parent)).rejects.toThrow('unavailable');
    await expect(resolveOutboundCarrierAccount(createPool({
      [workspace]:{provider_account_id:'invalid',status:'active'},
    }),workspace,parent)).rejects.toThrow('unavailable');
  });
  it('derives the rep from the trusted Twilio Web SDK identity and preserves legacy IDs', () => {
    expect(outboundRepIdFromClient('user_user-1')).toBe('user-1');
    expect(outboundRepIdFromClient('alice')).toBe('alice');
    expect(outboundRepIdFromClient('user_')).toBe('');
    expect(outboundRepIdFromClient('user_user_2')).toBe('user_2');
  });
  it('does not treat a different child account as the expected owner', async () => {
    const pool=createPool({[workspace]:{provider_account_id:child,status:'active'}});
    const stored=await resolveOutboundCarrierAccount(pool,workspace,parent);
    expect(stored).not.toBe(other);
    expect(stored).not.toBe(parent);
  });
  it('uses the creation account, not the newly assigned workspace account', () => {
    expect(resolveStoredOutboundAccount({provider_account_id:parent},child)).toBe(parent);
    expect(resolveStoredOutboundAccount({provider_account_id:child},parent)).toBe(child);
    expect(resolveStoredOutboundAccount({provider_account_id:null},child)).toBe(child);
    expect(() => resolveStoredOutboundAccount({provider_account_id:'invalid'},parent)).toThrow();
  });
});
