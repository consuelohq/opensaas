import {
  normalizeClickToCallTarget,
  type LeadConnectorClickToCallTarget,
} from './protocol.js';
export type WorkspaceLaunch = {
  id: string;
  mode: 'inbound' | 'outbound';
  action:
    | 'open'
    | 'inbound-readiness'
    | 'start-configured'
    | 'inbound-accept'
    | 'inbound-decline'
    | 'inbound-reconnect'
    | 'inbound-hang-up';
  ready?: boolean;
  endpoints?: Array<{ endpointId: string; kind: 'phone' | 'browser' }>;
  setup?: {
    mode: 'queue' | 'single';
    callingMode: 'predictive' | 'single';
    requestedFanout: 1 | 2 | 3;
    preferLocalPresence: boolean;
    callerIdNumber: string | null;
  };
  queue?: { pipelineId: string; stageId: string };
  targets?: LeadConnectorClickToCallTarget[];
  assignmentId?: string;
  generation?: number;
  endpointId?: string;
};
const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const short = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 200;
export const readWorkspaceLaunch = (value: unknown): WorkspaceLaunch | null => {
  const v = record(value);
  if (!v || !short(v.id) || !['inbound', 'outbound'].includes(String(v.mode)))
    return null;
  const mode = v.mode as WorkspaceLaunch['mode'];
  const base = { id: v.id, mode };
  if (
    v.action === 'open' ||
    v.action === 'inbound-reconnect' ||
    v.action === 'inbound-hang-up'
  )
    return { ...base, action: v.action };
  if (
    v.action === 'inbound-readiness' &&
    mode === 'inbound' &&
    typeof v.ready === 'boolean' &&
    Array.isArray(v.endpoints) &&
    v.endpoints.length <= 10
  ) {
    const endpoints: NonNullable<WorkspaceLaunch['endpoints']> = [];
    for (const item of v.endpoints) {
      const e = record(item);
      if (
        !e ||
        !short(e.endpointId) ||
        (e.kind !== 'phone' && e.kind !== 'browser')
      )
        return null;
      endpoints.push({ endpointId: e.endpointId, kind: e.kind });
    }
    return { ...base, action: 'inbound-readiness', ready: v.ready, endpoints };
  }
  if (
    (v.action === 'inbound-accept' || v.action === 'inbound-decline') &&
    mode === 'inbound' &&
    short(v.assignmentId) &&
    Number.isSafeInteger(v.generation) &&
    Number(v.generation) >= 0
  ) {
    if (v.action === 'inbound-accept' && !short(v.endpointId)) return null;
    return {
      ...base,
      action: v.action,
      assignmentId: v.assignmentId,
      generation: Number(v.generation),
      ...(short(v.endpointId) ? { endpointId: v.endpointId } : {}),
    };
  }
  const setup = record(v.setup);
  if (
    v.action !== 'start-configured' ||
    mode !== 'outbound' ||
    !setup ||
    !['queue', 'single'].includes(String(setup.mode)) ||
    !['predictive', 'single'].includes(String(setup.callingMode)) ||
    typeof setup.requestedFanout !== 'number' ||
    ![1, 2, 3].includes(setup.requestedFanout) ||
    typeof setup.preferLocalPresence !== 'boolean' ||
    (setup.callerIdNumber !== null && !short(setup.callerIdNumber)) ||
    !Array.isArray(v.targets) ||
    v.targets.length > 3
  )
    return null;
  const targets: LeadConnectorClickToCallTarget[] = [];
  for (const input of v.targets) {
    const t = record(input);
    if (!t || !short(t.phone)) return null;
    const target = normalizeClickToCallTarget({
      phone: t.phone,
      contactId: short(t.contactId) ? t.contactId : null,
      name: short(t.name) ? t.name : null,
      opportunityId: short(t.opportunityId) ? t.opportunityId : null,
    });
    if (!target) return null;
    targets.push(target);
  }
  const q = record(v.queue);
  if (
    setup.mode === 'queue' &&
    (!q || !short(q.pipelineId) || !short(q.stageId))
  )
    return null;
  return {
    ...base,
    action: 'start-configured',
    setup: setup as WorkspaceLaunch['setup'],
    targets,
    ...(q && short(q.pipelineId) && short(q.stageId)
      ? { queue: { pipelineId: q.pipelineId, stageId: q.stageId } }
      : {}),
  };
};
