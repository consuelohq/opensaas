import { Effect } from 'effect';

import { normalizeAsyncError } from '../errors/normalize-async-error';

export type TwilioAccountsClient = {
  api: {
    accounts: {
      create: (input: { friendlyName: string }) => Promise<{ sid: string }>;
    };
  };
};

export const createTwilioSubaccountProvider = (
  client: TwilioAccountsClient,
) => ({
  createSubaccount: (input: { friendlyName: string }) =>
    Effect.tryPromise({
      try: async () => {
        try {
          const account = await client.api.accounts.create(input);
          return { id: account.sid };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
      catch: (cause) => cause,
    }),
});
