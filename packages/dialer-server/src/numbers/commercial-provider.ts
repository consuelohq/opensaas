import { Effect } from 'effect';

import type { CommercialSqlClient } from '../commercial/persistence';
import { ensureWorkspaceTelephonyAccount } from './telephony-account';

type AvailableNumber = {
  phoneNumber: string;
  friendlyName?: string | null;
  locality?: string | null;
  region?: string | null;
  rateCenter?: string | null;
};

type IncomingNumber = { sid: string; phoneNumber: string };

export type TwilioCommercialAccountClient = {
  availablePhoneNumbers: (country: string) => {
    local: {
      list: (input: {
        areaCode?: number;
        contains?: string;
        limit: number;
      }) => Promise<AvailableNumber[]>;
    };
  };
  incomingPhoneNumbers: {
    (sid: string): { remove: () => Promise<boolean> };
    create: (input: {
      phoneNumber: string;
      friendlyName: string;
      voiceUrl: string;
      voiceMethod: 'POST';
    }) => Promise<IncomingNumber>;
  };
};

export type CommercialNumberProvider = {
  searchAvailable: (input: {
    workspaceId: string;
    areaCode?: string;
    contains?: string;
    country?: string;
    limit: number;
  }) => Promise<Array<{
    phoneNumber: string;
    friendlyName: string | null;
    city: string | null;
    state: string | null;
    region: string | null;
  }>>;
  provision: (input: {
    workspaceId: string;
    phoneNumber: string;
  }) => Promise<{ phoneNumber: string; providerNumberId: string }>;
  release: (input: {
    workspaceId: string;
    phoneNumber: string;
  }) => Promise<{ released: true }>;
};

const queryEffect = <T>(operation: () => Promise<T>) =>
  Effect.tryPromise({ try: operation, catch: (cause) => cause });

export const createTwilioCommercialNumberProvider = (input: {
  database: CommercialSqlClient;
  createSubaccount: (friendlyName: string) => Promise<{ sid: string }>;
  accountClient: (accountSid: string) => TwilioCommercialAccountClient;
  publicUrl: string;
}): CommercialNumberProvider => {
  const ensureAccount = (workspaceId: string) =>
    Effect.runPromise(
      ensureWorkspaceTelephonyAccount({
        workspaceId,
        repository: {
          get: (candidateWorkspaceId) =>
            queryEffect(async () => {
              const result = await input.database.query(
                `SELECT workspace_id, provider_account_id
                 FROM dialer_workspace_telephony_accounts
                 WHERE workspace_id = $1 AND status = 'active'`,
                [candidateWorkspaceId],
              );
              const row = result.rows[0] as
                | { workspace_id?: unknown; provider_account_id?: unknown }
                | undefined;
              return typeof row?.provider_account_id === 'string'
                ? {
                    workspaceId: String(row.workspace_id),
                    providerAccountId: row.provider_account_id,
                  }
                : null;
            }),
          save: (account) =>
            queryEffect(async () => {
              await input.database.query(
                `INSERT INTO dialer_workspace_telephony_accounts (
                   workspace_id, provider_account_id, status
                 ) VALUES ($1, $2, $3)
                 ON CONFLICT (workspace_id) DO UPDATE
                 SET provider_account_id = EXCLUDED.provider_account_id,
                     status = EXCLUDED.status`,
                [account.workspaceId, account.providerAccountId, account.status],
              );
            }),
        },
        provider: {
          createSubaccount: ({ friendlyName }) =>
            queryEffect(async () => {
              const account = await input.createSubaccount(friendlyName);
              return { id: account.sid };
            }),
        },
      }),
    );

  return {
    searchAvailable: async (request) => {
      const account = await ensureAccount(request.workspaceId);
      const numbers = await input
        .accountClient(account.providerAccountId)
        .availablePhoneNumbers(request.country ?? 'US')
        .local.list({
          ...(request.areaCode ? { areaCode: Number(request.areaCode) } : {}),
          ...(request.contains ? { contains: request.contains } : {}),
          limit: request.limit,
        });
      return numbers.map((number) => ({
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName ?? null,
        city: number.locality ?? null,
        state: number.region ?? null,
        region: number.rateCenter ?? null,
      }));
    },
    provision: async (request) => {
      const account = await ensureAccount(request.workspaceId);
      const accountClient = input.accountClient(account.providerAccountId);
      const number = await accountClient.incomingPhoneNumbers.create({
          phoneNumber: request.phoneNumber,
          friendlyName: `Consuelo ${request.workspaceId}`,
          voiceUrl: `${input.publicUrl}/webhooks/twilio/customer-twiml`,
          voiceMethod: 'POST',
        });
      try {
        await input.database.query(
          `INSERT INTO dialer_phone_numbers (
             workspace_id, phone_number, provider_number_id, status
           ) VALUES ($1, $2, $3, 'active')
           ON CONFLICT (workspace_id, phone_number) DO UPDATE
           SET provider_number_id = EXCLUDED.provider_number_id,
               user_id = NULL,
               slot_type = NULL,
               status = 'active',
               updated_at = now()`,
          [request.workspaceId, number.phoneNumber, number.sid],
        );
      } catch (cause: unknown) {
        try {
          await accountClient.incomingPhoneNumbers(number.sid).remove();
        } catch (rollbackCause: unknown) {
          throw new AggregateError(
            [cause, rollbackCause],
            'NUMBER_PERSISTENCE_AND_ROLLBACK_FAILED',
          );
        }
        throw cause;
      }
      return { phoneNumber: number.phoneNumber, providerNumberId: number.sid };
    },
    release: async (request) => {
      const result = await input.database.query(
        `SELECT n.provider_number_id, a.provider_account_id
         FROM dialer_phone_numbers n
         JOIN dialer_workspace_telephony_accounts a
           ON a.workspace_id = n.workspace_id AND a.status = 'active'
         WHERE n.workspace_id = $1 AND n.phone_number = $2
           AND n.status = 'active'`,
        [request.workspaceId, request.phoneNumber],
      );
      const row = result.rows[0] as
        | { provider_number_id?: unknown; provider_account_id?: unknown }
        | undefined;
      if (
        typeof row?.provider_number_id !== 'string' ||
        typeof row.provider_account_id !== 'string'
      ) {
        throw new Error('NUMBER_NOT_FOUND');
      }
      await input
        .accountClient(row.provider_account_id)
        .incomingPhoneNumbers(row.provider_number_id)
        .remove();
      await input.database.query(
        `UPDATE dialer_phone_numbers
         SET status = 'released', user_id = NULL, updated_at = now()
         WHERE workspace_id = $1 AND phone_number = $2`,
        [request.workspaceId, request.phoneNumber],
      );
      return { released: true };
    },
  };
};
