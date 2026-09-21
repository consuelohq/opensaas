import { describe, expect, it } from 'bun:test';
import { Cause, Effect, Exit, Option } from 'effect';

import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

import { createEffectDialerApplication } from '../application';
import { createRailwayDialerApplicationLayers } from './railway';

class MemoryRedis {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async getDelete(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }

  async set(
    key: string,
    value: string,
    ...args: unknown[]
  ): Promise<string | null> {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) count += this.values.delete(key) ? 1 : 0;
    return count;
  }

  async eval(): Promise<number> {
    return 0;
  }
}

const environment = {
  DATABASE_URL: 'postgres://fixture',
  REDIS_URL: 'redis://fixture',
  DIALER_SERVER_PUBLIC_URL: 'https://dialer.example.test',
  TWILIO_ACCOUNT_SID: 'AC_live_fixture',
  TWILIO_AUTH_TOKEN: 'live-token-fixture',
  LEADCONNECTOR_CLIENT_ID: 'client-id',
  LEADCONNECTOR_CLIENT_SECRET: 'client-secret',
  LEADCONNECTOR_REDIRECT_URI:
    'https://dialer.example.test/integrations/leadconnector/oauth/callback',
  LEADCONNECTOR_SCOPES: 'contacts.readonly,opportunities.readonly',
  LEADCONNECTOR_TOKEN_ENCRYPTION_KEY: 'lead-connector-token-encryption-fixture',
  LEADCONNECTOR_SHARED_SECRET: 'lead-connector-shared-secret-fixture',
};

describe('Railway canonical predictive runtime cutover', () => {
  it('uses the standalone queue id as the canonical predictive segment', async () => {
    const canonicalCalls: Array<{ text: string; values: readonly unknown[] }> = [];
    const expectedSegment = 'leadconnector:provider-user-1:pipeline-stage-1';
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string, values: readonly unknown[] = []) => {
        if (text.includes('FROM consuelo_lead_connector_call_outcomes')) {
          throw new Error('legacy compatibility outcomes must not drive runtime ranking');
        }
        if (text.includes('FROM contact_attempt_ledger')) {
          return {
            rows: [
              {
                contact_id: 'contact-first',
                attempts_total: 0,
                last_attempt_at: null,
              },
              {
                contact_id: 'contact-winner',
                attempts_total: 1,
                last_attempt_at: null,
              },
            ] as T[],
          };
        }
        if (text.includes('FROM dialer_learning_observations')) {
          canonicalCalls.push({ text, values });
          if (values[1] !== expectedSegment) {
            throw new Error(`unexpected predictive segment ${String(values[1])}`);
          }
          if (
            text.includes('local_hour') &&
            text.includes('GROUP BY attempt_number, local_hour, local_day_of_week')
          ) {
            return {
              rows: [
                {
                  attempt_number: 1,
                  local_hour: 10,
                  local_day_of_week: 1,
                  successes: 10,
                  trials: 100,
                },
                {
                  attempt_number: 2,
                  local_hour: 10,
                  local_day_of_week: 1,
                  successes: 80,
                  trials: 100,
                },
              ] as T[],
            };
          }
          return {
            rows: [
              { attempt_number: 1, successes: 10, trials: 100 },
              { attempt_number: 2, successes: 80, trials: 100 },
            ] as T[],
          };
        }
        if (text.includes('FROM dialer_workspace_settings')) {
          return {
            rows: [
              {
                avg_deal_value: '100',
                avg_close_rate: '1',
                cost_per_attempt: '0.03',
              },
            ] as T[],
          };
        }
        return { rows: [] as T[] };
      },
    };

    const layers = await createRailwayDialerApplicationLayers(environment, {
      redis: new MemoryRedis(),
      database,
    });
    const application = createEffectDialerApplication(layers);
    const result = await Effect.runPromise(
      application.startCallSession({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        input: {
          source: 'queue',
          queueId: 'pipeline-stage-1',
          selectionStrategy: 'predictive',
          requestedFanout: 1,
          targetPhones: ['+15550100000', '+15550100001'],
          contactIds: ['contact-first', 'contact-winner'],
          callMode: 'mock',
        },
      }),
    );

    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatchObject({
      contactId: 'contact-winner',
      status: 'mocked',
    });
    expect(canonicalCalls.length).toBeGreaterThanOrEqual(2);
    expect(canonicalCalls.every((call) => call.values[1] === expectedSegment)).toBe(
      true,
    );
  });

  it('blocks provider initiation when canonical stopping suppresses every queue candidate', async () => {
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string) => {
        if (text.includes('FROM contact_attempt_ledger')) {
          return {
            rows: [
              {
                contact_id: 'contact-stop',
                attempts_total: 2,
                last_attempt_at: '2026-08-09T10:00:00.000Z',
              },
            ] as T[],
          };
        }
        if (text.includes('FROM dialer_learning_observations')) {
          if (
            text.includes('local_hour') &&
            text.includes('GROUP BY attempt_number, local_hour, local_day_of_week')
          ) {
            return {
              rows: [
                {
                  attempt_number: 3,
                  local_hour: 12,
                  local_day_of_week: 0,
                  successes: 0,
                  trials: 100,
                },
              ] as T[],
            };
          }
          return {
            rows: [{ attempt_number: 3, successes: 0, trials: 100 }] as T[],
          };
        }
        if (text.includes('FROM dialer_workspace_settings')) {
          return {
            rows: [
              {
                avg_deal_value: '1',
                avg_close_rate: '1',
                cost_per_attempt: '0.5',
              },
            ] as T[],
          };
        }
        return { rows: [] as T[] };
      },
    };

    const layers = await createRailwayDialerApplicationLayers(environment, {
      redis: new MemoryRedis(),
      database,
    });
    const application = createEffectDialerApplication(layers);

    const exit = await Effect.runPromiseExit(
      application.startCallSession({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        input: {
          source: 'queue',
          queueId: 'stopping-stage',
          selectionStrategy: 'predictive',
          requestedFanout: 1,
          targetPhones: ['+15550100003'],
          contactIds: ['contact-stop'],
          callMode: 'mock',
        },
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) throw new Error('expected stopped queue to fail');
    const failure = Cause.failureOption(exit.cause);
    expect(Option.isSome(failure)).toBe(true);
    if (!Option.isSome(failure)) throw new Error('expected typed request failure');
    expect(failure.value).toMatchObject({
      _tag: 'DialerRequestError',
      code: 'NO_CALLABLE_TARGETS',
    });
  });
});
