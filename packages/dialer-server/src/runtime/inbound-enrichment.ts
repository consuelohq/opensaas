import { normalizePhone } from '@consuelo/contacts';
import { lookupLeadConnectorContactOwner } from '@consuelo/lead-connector';
import { Effect } from 'effect';
import type { InboundEnrichment } from '../inbound/telephony-contracts';
import type { LeadConnectorApplicationLayer } from '../lead-connector-application';

export const createLeadConnectorInboundEnrichment = (
  loadLayer: () => Promise<LeadConnectorApplicationLayer>,
): InboundEnrichment => {
  let layer: Promise<LeadConnectorApplicationLayer> | undefined;
  return async ({ workspaceId, caller }) => {
    try {
      const phoneNumber = normalizePhone(caller);
      const base = {
        requiredSkills: [], kind: 'live' as const, notBefore: null, deadline: null,
      };
      if (!phoneNumber) return { ...base, ownerRepId: null, ownerStatus: 'missing' };
      // Reuse installation resources; failed initialization remains retryable.
      layer ??= loadLayer().catch((cause: unknown) => {
        layer = undefined;
        throw cause;
      });
      const owner = await Effect.runPromise(
        lookupLeadConnectorContactOwner({ workspaceId, phoneNumber })
          .pipe(Effect.provide(await layer)),
      );
      return { ...base, ...owner };
    } catch (cause: unknown) {
      throw new Error('Inbound CRM owner lookup unavailable', { cause });
    }
  };
};
