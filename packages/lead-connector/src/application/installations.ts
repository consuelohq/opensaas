import { Effect } from 'effect';

import { LeadConnectorInstallationStore } from '../ports/index.js';

export const disableLeadConnectorInstallation = (workspaceId: string) =>
  Effect.gen(function* () {
    const installations = yield* LeadConnectorInstallationStore;
    yield* installations.deleteByWorkspaceId(workspaceId);
    return { disabled: true as const };
  });
