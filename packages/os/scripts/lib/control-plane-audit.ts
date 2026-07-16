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

export type ControlPlaneAuditEvent = {
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

export function controlPlaneAuditPath(home: string): string {
  return path.join(home, 'logs', 'control-plane-audit.jsonl');
}

export function recordControlPlaneAuditEvent(input: {
  home: string;
  actor: ControlPlaneAuditActor;
  kind: 'tool' | 'skill' | 'workflow';
  name: string;
  enabled: boolean;
  now?: () => Date;
}): ControlPlaneAuditEvent {
  const event: ControlPlaneAuditEvent = {
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
  const logPath = controlPlaneAuditPath(input.home);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  return event;
}
