import { Effect, Option } from 'effect';
import type { LeadConnectorTeamMember } from '../contracts/index.js';
import { LeadConnectorProviderError } from '../errors.js';
import {
  LeadConnectorInstallationStore,
  LeadConnectorCompanyCredentialStore,
} from '../ports/index.js';
import { getValidLeadConnectorCompanyAccessToken } from './marketplace-oauth.js';
import { getValidLeadConnectorAccessToken } from './tokens.js';
import {
  asRecord,
  providerHeaders,
  providerUrl,
  requestLeadConnector,
  readString,
} from './provider.js';

// A complete bounded directory, scoped to the authenticated installation. Never contacts/PII.
export const listLeadConnectorTeamMembers = (input: {
  workspaceId: string;
  locationId: string;
  installationId: string;
}) =>
  Effect.gen(function* () {
    const fail = (message: string) =>
      Effect.fail(
        new LeadConnectorProviderError({
          operation: 'list-team-members',
          message,
          retryable: false,
        }),
      );
    const store = yield* LeadConnectorInstallationStore;
    const installation = yield* store.getByWorkspaceId(input.workspaceId);
    if (
      !installation ||
      installation.locationId !== input.locationId ||
      installation.installationId !== input.installationId
    )
      return yield* fail('TEAM_INSTALLATION_CHANGED');
    if (!installation.scopes.includes('users.readonly'))
      return yield* fail('TEAM_DIRECTORY_SCOPE_REQUIRED');
    const companyStore = yield* Effect.serviceOption(
      LeadConnectorCompanyCredentialStore,
    );
    const company = Option.isSome(companyStore)
      ? yield* companyStore.value.getByCompanyId(input.workspaceId)
      : null;
    if (company && !company.scopes.includes('users.readonly'))
      return yield* fail('TEAM_DIRECTORY_SCOPE_REQUIRED');
    const token = company
      ? yield* getValidLeadConnectorCompanyAccessToken(input.workspaceId).pipe(
          Effect.provideService(
            LeadConnectorCompanyCredentialStore,
            Option.getOrThrow(companyStore),
          ),
        )
      : yield* getValidLeadConnectorAccessToken(input.workspaceId);
    const members: LeadConnectorTeamMember[] = [];
    const seen = new Set<string>();
    let total: number | undefined;
    for (let skip = 0; skip < 1000; skip += 100) {
      const url = new URL(yield* providerUrl('/users/search'));
      url.searchParams.set('companyId', input.workspaceId);
      if (!company) url.searchParams.set('locationId', input.locationId);
      url.searchParams.set('skip', String(skip));
      url.searchParams.set('limit', '100');
      const response = yield* requestLeadConnector(
        { method: 'GET', url: url.href, headers: providerHeaders(token) },
        'list-team-members',
      );
      const body = asRecord(response.body);
      // The provider omits count for an empty search result.
      if (
        body.count === undefined &&
        Array.isArray(body.users) &&
        body.users.length === 0 &&
        total === undefined
      )
        body.count = 0;
      if (
        !Array.isArray(body.users) ||
        !Number.isSafeInteger(body.count) ||
        Number(body.count) < 0 ||
        Number(body.count) > 1000 ||
        (total !== undefined && total !== body.count)
      )
        return yield* fail('TEAM_DIRECTORY_INCOMPLETE');
      total = Number(body.count);
      if (
        body.users.length > 100 ||
        skip + body.users.length > total ||
        (skip + body.users.length < total && body.users.length !== 100)
      )
        return yield* fail('TEAM_DIRECTORY_INCOMPLETE');
      for (const raw of body.users) {
        const user = asRecord(raw);
        const id = readString(user, 'id')?.trim();
        if (!id || id.length > 160 || seen.has(id))
          return yield* fail('TEAM_DIRECTORY_INCOMPLETE');
        seen.add(id);
        const roles = asRecord(user.roles);
        const locations = Array.isArray(roles.locationIds)
          ? roles.locationIds
          : [];
        const allowed =
          locations.includes(input.locationId) ||
          (roles.type === 'agency' && roles.restrictSubAccount === false);
        if (
          user.deleted === true ||
          !allowed ||
          !['account', 'agency'].includes(String(roles.type)) ||
          !['admin', 'user'].includes(String(roles.role))
        )
          continue;
        const name =
          (
            readString(user, 'name') ??
            [readString(user, 'firstName'), readString(user, 'lastName')]
              .filter(Boolean)
              .join(' ')
          )
            .trim()
            .slice(0, 160) || 'Team member';
        members.push({
          id,
          name,
          role: roles.role as 'admin' | 'user',
          canCall: asRecord(user.permissions).phoneCallEnabled === true,
        });
      }
      if (seen.size === total)
        return members.sort((a, b) => a.id.localeCompare(b.id));
    }
    return yield* fail('TEAM_DIRECTORY_INCOMPLETE');
  }).pipe(
    Effect.timeoutFail({
      duration: '10 seconds',
      onTimeout: () =>
        new LeadConnectorProviderError({
          operation: 'list-team-members',
          message: 'TEAM_DIRECTORY_TIMEOUT',
          retryable: true,
        }),
    }),
  );
