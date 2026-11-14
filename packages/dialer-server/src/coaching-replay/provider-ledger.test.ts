import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProviderLedger } from './provider-ledger';
import { createBudgetedFetch } from './provider-budget';
describe('one-shot provider ledger', () => {
  it('persists reservation before sending, retains it on failure, and refuses a second run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-ledger-')),
      fingerprint = 'a'.repeat(64);
    try {
      const ledger = createProviderLedger(dir, fingerprint),
        file = join(dir, 'provider-run.lock');
      let calls = 0;
      const gate = createBudgetedFetch(
        {
          model: 'fixture/model',
          allowedRequestProviderTags: ['fixture'],
          maxRequests: 1,
          maxReservedNanoUsd: 10000,
          contextWindowTokens: 1000,
          inputNanoUsdPerMillion: 1000000,
          outputNanoUsdPerMillion: 1000000,
          maxPromptNanoUsdPerMillion: 1000000,
          maxCompletionNanoUsdPerMillion: 1000000,
        },
        async () => {
          calls++;
          expect(JSON.parse(readFileSync(file, 'utf8')).attempts).toBe(1);
          throw Error('unknown');
        },
        () => true,
        ledger.record,
      );
      await expect(
        gate.fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({
            model: 'fixture/model',
            max_tokens: 512,
            provider: {
              only: ['fixture'],
              require_parameters: true,
              allow_fallbacks: false,
              data_collection: 'deny',
              max_price: { prompt: 0.001, completion: 0.001 },
            },
          }),
        }),
      ).rejects.toThrow();
      expect(calls).toBe(1);
      expect(JSON.parse(readFileSync(file, 'utf8')).reservedNanoUsd).toBe(1512);
      expect(statSync(file).mode & 0o777).toBe(0o600);
      ledger.close();
      expect(() => createProviderLedger(dir, fingerprint)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('does not send if durable reservation fails', async () => {
    let calls = 0;
    const gate = createBudgetedFetch(
      {
        model: 'fixture/model',
        allowedRequestProviderTags: ['fixture'],
        maxRequests: 1,
        maxReservedNanoUsd: 10000,
        contextWindowTokens: 1000,
        inputNanoUsdPerMillion: 1000000,
        outputNanoUsdPerMillion: 1000000,
        maxPromptNanoUsdPerMillion: 1000000,
        maxCompletionNanoUsdPerMillion: 1000000,
      },
      async () => {
        calls++;
        return new Response();
      },
      () => true,
      () => {
        throw Error('disk');
      },
    );
    await expect(
      gate.fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'fixture/model',
          max_tokens: 512,
          provider: {
            only: ['fixture'],
            require_parameters: true,
            allow_fallbacks: false,
            data_collection: 'deny',
            max_price: { prompt: 0.001, completion: 0.001 },
          },
        }),
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
    expect(gate.counters().attempts).toBe(0);
  });
});
