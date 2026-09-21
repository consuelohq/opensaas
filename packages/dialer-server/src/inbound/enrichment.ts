import { decodeRoutingRequestMetadata, type RoutingRequestMetadata } from '@consuelo/dialer';
import type { InboundEnrichment } from './telephony-contracts';

export const resolveInboundEnrichment = async (
  enrich: InboundEnrichment | undefined,
  input: Parameters<InboundEnrichment>[0],
): Promise<RoutingRequestMetadata> => {
  const fallback: RoutingRequestMetadata = {
    requiredSkills: [], ownerRepId: null, ownerStatus: 'missing',
    kind: 'live', notBefore: null, deadline: null,
  };
  if (!enrich) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const metadata = decodeRoutingRequestMetadata(await Promise.race([
      enrich(input),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Enrichment deadline')), 500);
      }),
    ]));
    if (metadata.kind !== 'live') throw new Error('Invalid inbound enrichment');
    return metadata;
  } catch {
    // CRM availability must never prevent admission to the ordinary team queue.
    return { ...fallback, ownerStatus: 'unavailable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
};
