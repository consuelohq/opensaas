import { describe, expect, it, mock } from 'bun:test';
import twilio from 'twilio';
import { createWorkspaceTwilioAuthority } from './workspace-twilio';

const parent='AC'+'1'.repeat(32);
const child='AC'+'2'.repeat(32);
const foreign='AC'+'3'.repeat(32);
const callSid='CA'+'4'.repeat(32);
const foreignCallSid='CA'+'5'.repeat(32);
const workspace='workspace-1';
const parentToken='parent-token-secret';
const childToken='child-auth-token-fixture-long';
const url=(call:string)=>'https://dialer.example.test/webhooks/twilio/media/'+call;
const signed=(token:string, call=callSid)=>({
  signature: twilio.getExpectedTwilioSignature(token,url(call),{}),
  url:url(call),params:{},rawBody:'',contentType:'',
});
const make=(consent=true, owner=child)=>{
  const db={query:async <T>(sql:string, args:readonly unknown[]=[]):Promise<{rows:T[]}>=>{
    if(sql.includes('FROM dialer_call_legs')) return {rows:
      consent && args[0]===workspace && args[1]===callSid ? [{transcription_enabled:true} as T] : [] as T[]};
    if(sql.includes('FROM dialer_workspace_telephony_accounts')) return {rows:[] as T[]};
    throw new Error('Unexpected SQL '+sql);
  }};
  const fetchImpl=mock(async ()=>new Response(JSON.stringify({
    sid:child,status:'active',auth_token:childToken,
  }),{status:200})) as unknown as typeof fetch;
  const resolveMediaCall=mock(async (sid:string)=>sid===callSid
    ? {workspaceId:workspace,providerAccountId:owner}
    : sid===foreignCallSid ? {workspaceId:'foreign-workspace',providerAccountId:foreign} : null);
  const authority=createWorkspaceTwilioAuthority({
    database:db,masterAccountSid:parent,masterAuthToken:parentToken,
    parentVoiceCredentials:{},encryptionSecret:'fixture-key-longer-than-24-characters',
    publicUrl:'https://dialer.example.test',fetchImpl,resolveMediaCall,
  });
  return {authority,db,fetchImpl,resolveMediaCall};
};
describe('DEV-1695 signed Media Stream account/consent ownership',()=>{
  it('accepts the child-account signed, persisted, consented call handshake with no form AccountSid',async()=>{
    const {authority,fetchImpl}=make();
    expect(await authority.verifyTwilioSignature(signed(childToken))).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('rejects parent signature for child call and wrong child call identity',async()=>{
    const {authority}=make();
    expect(await authority.verifyTwilioSignature(signed(parentToken))).toBe(false);
    expect(await authority.verifyTwilioSignature(signed(childToken,foreignCallSid))).toBe(false);
    expect(await authority.verifyTwilioSignature(signed(childToken,'CA'+'9'.repeat(32)))).toBe(false);
  });
  it('rejects even correctly signed handshakes if persisted consent is off',async()=>{
    const {authority,fetchImpl}=make(false);
    expect(await authority.verifyTwilioSignature(signed(childToken))).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('accepts the legacy persisted parent owner with parent signature, but not child',async()=>{
    const {authority}=make(true,parent);
    expect(await authority.verifyTwilioSignature(signed(parentToken))).toBe(true);
    expect(await authority.verifyTwilioSignature(signed(childToken))).toBe(false);
  });
});
