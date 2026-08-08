import { Effect } from 'effect';

export const ensureWorkspaceTelephonyAccount = (input: {
  workspaceId: string;
  repository: {
    get: (
      workspaceId: string,
    ) => Effect.Effect<
      { workspaceId: string; providerAccountId: string } | null,
      unknown
    >;
    save: (account: {
      workspaceId: string;
      providerAccountId: string;
      status: 'active';
    }) => Effect.Effect<void, unknown>;
  };
  provider: {
    createSubaccount: (input: {
      friendlyName: string;
    }) => Effect.Effect<{ id: string }, unknown>;
  };
}) =>
  Effect.gen(function* () {
    const existing = yield* input.repository.get(input.workspaceId);
    if (existing) {
      return {
        workspaceId: existing.workspaceId,
        providerAccountId: existing.providerAccountId,
      };
    }
    const created = yield* input.provider.createSubaccount({
      friendlyName: `Consuelo workspace ${input.workspaceId}`,
    });
    const account = {
      workspaceId: input.workspaceId,
      providerAccountId: created.id,
    };
    yield* input.repository.save({ ...account, status: 'active' });
    return account;
  });
