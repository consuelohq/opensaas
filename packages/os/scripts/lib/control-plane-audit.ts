import fs from 'node:fs';
import path from 'node:path';

export type ControlPlaneAuditActor = {
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  workspaceId: string;
  correlationId: string;
  nodeId?: string;
  applicationId?: string;
};

export type ConfigurationControlPlaneAuditEvent = {
  event: 'configuration.overlay.changed';
  reasonCode: 'overlay_updated';
  correlationId: string;
  actorType: ControlPlaneAuditActor['actorType'];
  actorId: string;
  workspaceId: string;
  nodeId?: string;
  applicationId?: string;
  outcome: 'allowed';
  timestamp: string;
  safeMetadata: {
    kind: 'tool' | 'skill' | 'workflow';
    name: string;
    enabled: boolean;
  };
};

export type EnvironmentControlPlaneAuditEvent = {
  event: 'environment.created' | 'environment.updated' | 'environment.deleted';
  reasonCode: 'environment_created' | 'environment_updated' | 'environment_deleted';
  correlationId: string;
  actorType: ControlPlaneAuditActor['actorType'];
  actorId: string;
  workspaceId: string;
  nodeId?: string;
  applicationId?: string;
  outcome: 'allowed';
  timestamp: string;
  safeMetadata: {
    environmentId: string;
    name: string;
    slug: string;
    status: 'active' | 'inactive' | 'archived';
    scopeKind: 'workspace' | 'nodes';
    nodeCount: number;
    labelCount: number;
    metadataKeys: string[];
  };
};

/**
 * Credential events record that a resolution was attempted and how it ended. `outcome` is not
 * narrowed to 'allowed' here because a denied or failed resolution must be auditable too — the
 * contract requires an event "whether the resolution succeeds or fails".
 *
 * safeMetadata deliberately carries no value, length, prefix, suffix, hash, or fingerprint of the
 * credential. Everything in it is already known to the control plane.
 */
export type CredentialControlPlaneAuditEvent = {
  event: 'credential.resolved' | 'credential.installed' | 'credential.removed';
  reasonCode:
    | 'credential_resolved'
    | 'credential_missing'
    | 'credential_denied'
    | 'credential_failed'
    | 'credential_installed'
    | 'credential_removed';
  correlationId: string;
  actorType: ControlPlaneAuditActor['actorType'];
  actorId: string;
  workspaceId: string;
  nodeId?: string;
  applicationId?: string;
  outcome: 'allowed' | 'denied' | 'failed';
  timestamp: string;
  safeMetadata: {
    bindingId: string;
    scriptId?: string;
    source: 'node-sealed';
  };
};

export type ControlPlaneAuditEvent =
  | ConfigurationControlPlaneAuditEvent
  | EnvironmentControlPlaneAuditEvent
  | CredentialControlPlaneAuditEvent;

export function controlPlaneAuditPath(home: string): string {
  return path.join(home, 'logs', 'control-plane-audit.jsonl');
}

function appendControlPlaneAuditEvent(
  home: string,
  event: ControlPlaneAuditEvent,
): void {
  const logPath = controlPlaneAuditPath(home);
  const directory = path.dirname(logPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* best effort */ }
  fs.appendFileSync(logPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  try { fs.chmodSync(logPath, 0o600); } catch { /* best effort */ }
}

export function recordControlPlaneAuditEvent(input: {
  home: string;
  actor: ControlPlaneAuditActor;
  kind: 'tool' | 'skill' | 'workflow';
  name: string;
  enabled: boolean;
  now?: () => Date;
}): ConfigurationControlPlaneAuditEvent {
  const event: ConfigurationControlPlaneAuditEvent = {
    event: 'configuration.overlay.changed',
    reasonCode: 'overlay_updated',
    correlationId: input.actor.correlationId,
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    workspaceId: input.actor.workspaceId,
    ...(input.actor.nodeId ? { nodeId: input.actor.nodeId } : {}),
    ...(input.actor.applicationId ? { applicationId: input.actor.applicationId } : {}),
    outcome: 'allowed',
    timestamp: (input.now?.() ?? new Date()).toISOString(),
    safeMetadata: {
      kind: input.kind,
      name: input.name,
      enabled: input.enabled,
    },
  };
  appendControlPlaneAuditEvent(input.home, event);
  return event;
}

export function recordEnvironmentControlPlaneAuditEvent(input: {
  home: string;
  actor: ControlPlaneAuditActor;
  event: EnvironmentControlPlaneAuditEvent['event'];
  environment: {
    environmentId: string;
    name: string;
    slug: string;
    status: 'active' | 'inactive' | 'archived';
    scope: { kind: 'workspace' } | { kind: 'nodes'; nodeIds: string[] };
    labels: string[];
    metadata: Record<string, unknown>;
  };
  now?: () => Date;
}): EnvironmentControlPlaneAuditEvent {
  const reasonCode = input.event === 'environment.created'
    ? 'environment_created'
    : input.event === 'environment.updated'
      ? 'environment_updated'
      : 'environment_deleted';
  const event: EnvironmentControlPlaneAuditEvent = {
    event: input.event,
    reasonCode,
    correlationId: input.actor.correlationId,
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    workspaceId: input.actor.workspaceId,
    ...(input.actor.nodeId ? { nodeId: input.actor.nodeId } : {}),
    ...(input.actor.applicationId ? { applicationId: input.actor.applicationId } : {}),
    outcome: 'allowed',
    timestamp: (input.now?.() ?? new Date()).toISOString(),
    safeMetadata: {
      environmentId: input.environment.environmentId,
      name: input.environment.name,
      slug: input.environment.slug,
      status: input.environment.status,
      scopeKind: input.environment.scope.kind,
      nodeCount: input.environment.scope.kind === 'nodes'
        ? input.environment.scope.nodeIds.length
        : 0,
      labelCount: input.environment.labels.length,
      metadataKeys: Object.keys(input.environment.metadata).sort(),
    },
  };
  appendControlPlaneAuditEvent(input.home, event);
  return event;
}

export function recordCredentialControlPlaneAuditEvent(input: {
  home: string;
  actor: ControlPlaneAuditActor;
  event: CredentialControlPlaneAuditEvent['event'];
  reasonCode: CredentialControlPlaneAuditEvent['reasonCode'];
  outcome: CredentialControlPlaneAuditEvent['outcome'];
  bindingId: string;
  scriptId?: string;
  now?: () => Date;
}): CredentialControlPlaneAuditEvent {
  const event: CredentialControlPlaneAuditEvent = {
    event: input.event,
    reasonCode: input.reasonCode,
    correlationId: input.actor.correlationId,
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    workspaceId: input.actor.workspaceId,
    ...(input.actor.nodeId ? { nodeId: input.actor.nodeId } : {}),
    ...(input.actor.applicationId
      ? { applicationId: input.actor.applicationId }
      : {}),
    outcome: input.outcome,
    timestamp: (input.now?.() ?? new Date()).toISOString(),
    safeMetadata: {
      bindingId: input.bindingId,
      ...(input.scriptId ? { scriptId: input.scriptId } : {}),
      source: 'node-sealed',
    },
  };
  appendControlPlaneAuditEvent(input.home, event);
  return event;
}
