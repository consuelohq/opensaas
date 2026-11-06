import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { generateParallelAgentTwiml } from './parallel-compatibility-application';
import {
  ParallelCompatibilityRuntime,
  type ParallelCompatibilityRuntimeService,
} from '../ports/parallel-compatibility';
import { createAgentVoiceIdentity } from '../services/voice-identity';
import type { ParallelGroup } from '../types';

const master='AC'+'1'.repeat(32);
const child='AC'+'2'.repeat(32);
const unrelated='AC'+'3'.repeat(32);

const call=(owner: string | undefined, signed: string) => {
  const group={
    userId:'rep-1',
    status:'dialing',
    providerAccountId:owner,
    conferenceName:'workspace-1_group-1',
  } as unknown as ParallelGroup;
  const fake={ getGroup:()=>Effect.succeed(group) } as unknown as ParallelCompatibilityRuntimeService;
  const layer=Layer.succeed(ParallelCompatibilityRuntime, fake);
  return Effect.runPromise(generateParallelAgentTwiml({
    sessionId:'group-1',
    clientIdentity:createAgentVoiceIdentity(group.userId),
    accountSid:signed,
    parentAccountSid:master,
  }).pipe(Effect.provide(layer)));
};
describe('DEV-1686 Web conference must share the signed provider account',()=>{
  it('joins the matching child-account conference only',async()=>{
    expect(await call(child,child)).toContain('<Conference');
    await expect(call(child,master)).rejects.toThrow();
    await expect(call(child,unrelated)).rejects.toThrow();
  });
  it('keeps historical parent-account calls compatible without granting foreign accounts',async()=>{
    expect(await call(undefined,master)).toContain('<Conference');
    await expect(call(undefined,unrelated)).rejects.toThrow();
  });
});
