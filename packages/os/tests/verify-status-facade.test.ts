import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkspaceClient } from '../scripts/lib/facade/client';
import { manifestEntries } from '../scripts/lib/facade/executor';
import { getInputSchema } from '../scripts/lib/facade/schemas';
import { toolPackage } from '../tools/review/manifest';

describe('verify status facade safety contract', () => {
  it('generates documentation using actual callable SDK method path', () => {
    const docs = readFileSync(resolve(import.meta.dirname, '../TOOLS.md'), 'utf8');
    expect(docs).toContain('### workspace.verifyStatus');
    expect(docs).toContain('Signature | `workspace.verifyStatus(');
    expect(docs).toContain('"tool": "verify.status"');
    expect(docs).not.toContain('Signature | `workspace.verify.status(');
  });

  it('registers read-only long-poll without shadowing the callable mutating verify method', () => {
    const entries = manifestEntries.filter((entry) => entry.name === 'verify' || entry.name === 'verify.status');
    expect(entries).toHaveLength(2);
    const starter = entries.find((entry) => entry.name === 'verify')!;
    const status = entries.find((entry) => entry.name === 'verify.status')!;
    expect(starter.capabilities.mutating).toBe(true);
    expect(status.capabilities).toMatchObject({ readOnly: true, mutating: false, safeToRetry: true });
    expect(status.methodPath).toEqual(['verifyStatus']);
    const client = createWorkspaceClient();
    expect(typeof client.verify).toBe('function');
    expect(typeof client.verifyStatus).toBe('function');
  });

  it('requires an exact run key and bounds long polling to avoid unbounded tool calls', () => {
    const status = getInputSchema('VerifyStatusInput');
    const start = getInputSchema('VerifyInput');
    expect(status?.safeParse({ runKey: 'a'.repeat(64), waitSeconds: 60, taskSession: 'tsk_example' }).success).toBe(true);
    expect(status?.safeParse({ runKey: 'a'.repeat(64), waitSeconds: 90 }).success).toBe(true);
    expect(status?.safeParse({ runKey: '../../secrets' }).success).toBe(false);
    expect(status?.safeParse({ runKey: 'a'.repeat(64), waitSeconds: 100 }).success).toBe(false);
    expect(start?.safeParse({ retry: true, base: 'origin/stream/os' }).success).toBe(true);
  });

  it('maps verify.status to read-only CLI with the proper scoped flags', () => {
    const statusHandler = toolPackage.handlers.find((entry) => entry.name === 'verify.status')!;
    expect(statusHandler.command).toMatchObject({ script: 'verify-status', jsonFlag: '--json' });
    expect(statusHandler.command.arguments).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'runKey', flag: '--run-key' }),
      expect.objectContaining({ source: 'waitSeconds', flag: '--wait-seconds' }),
    ]));
    const verifyHandler = toolPackage.handlers.find((entry) => entry.name === 'verify')!;
    expect(verifyHandler.command.arguments).toContainEqual(expect.objectContaining({ source: 'retry', flag: '--retry' }));
  });
});
