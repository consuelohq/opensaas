import { Effect } from 'effect';

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
        const account = await client.api.accounts.create(input);
        return { id: account.sid };
      },
      catch: (cause) => cause,
    }),
});
