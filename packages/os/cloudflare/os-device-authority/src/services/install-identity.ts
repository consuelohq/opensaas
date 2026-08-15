import { INSTALL_TELEMETRY_SCHEMA_VERSION } from '../../../../scripts/lib/install-telemetry-contract';

import type { DeviceAuthorityRuntime, Grant } from '../types';

export async function recordCanonicalInstallIdentity(
  runtime: DeviceAuthorityRuntime,
  grant: Grant,
): Promise<void> {
  if (
    !runtime.installControlPlaneRepository ||
    !grant.installId ||
    !grant.installIdentityEventId ||
    !grant.canonicalUserId ||
    !grant.canonicalWorkspaceId
  ) {
    return;
  }
  const occurredAt = new Date(runtime.now()).toISOString();
  const event = {
    schemaVersion: INSTALL_TELEMETRY_SCHEMA_VERSION,
    eventId: grant.installIdentityEventId,
    installId: grant.installId,
    producer: 'device_authority',
    name: 'install.identity.bound',
    stage: 'node_registration',
    outcome: 'succeeded',
    occurredAt,
    sequence: 1,
    identity: {
      state: 'canonical',
      userId: grant.canonicalUserId,
      workspaceId: grant.canonicalWorkspaceId,
      ...(grant.nodeId ? { nodeId: grant.nodeId } : {}),
    },
    context: {
      ...(grant.nodeRole ? { nodeRole: grant.nodeRole } : {}),
      ...(grant.nodeStatus ? { nodeStatus: grant.nodeStatus } : {}),
    },
  } as const;
  try {
    await runtime.installControlPlaneRepository.ingestEvent(event, {
      trust: 'trusted',
      ingestedAt: occurredAt,
    });
    if (runtime.installTelemetryObserver) {
      await runtime.installTelemetryObserver.observe(event);
    }
  } catch {
    // Correlation/telemetry must never change device authorization control flow.
  }
}
