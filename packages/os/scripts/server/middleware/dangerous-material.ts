import {
  assessDangerousMaterial,
  dangerousMaterialError,
  type DangerousMaterialDecision,
} from '../../lib/dangerous-material-policy';
import type { CallInput } from '../../lib/types';

import { logLocalOsServerEvent } from '../logger';
import { jsonResponse } from './errors';

type JsonRpcId = string | number | null;

function mcpRequestId(body: string): JsonRpcId {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const id = (parsed as Record<string, unknown>).id;
    return typeof id === 'string' || typeof id === 'number' || id === null
      ? id
      : null;
  } catch {
    return null;
  }
}

function logDangerousMcpDenial(
  decision: Exclude<DangerousMaterialDecision, { allowed: true }>,
  requestId: string,
): void {
  logLocalOsServerEvent(
    decision.securityEvent.event,
    {
      requestId,
      code: decision.code,
      source: decision.source,
      location: decision.location,
      patternId: decision.patternId,
      severity: decision.severity,
      reason: decision.reason,
      rawPayloadCaptured: false,
    },
    'warn',
  );
}

function dangerousMcpMaterialResponse(
  body: string,
  requestId: string,
  decision: Exclude<DangerousMaterialDecision, { allowed: true }>,
): Response {
  logDangerousMcpDenial(decision, requestId);
  return jsonResponse({
    jsonrpc: '2.0',
    id: mcpRequestId(body),
    error: {
      code: -32040,
      message: 'Request blocked by Consuelo safety policy.',
      data: {
        code: decision.code,
        requestId,
      },
    },
  });
}

function dangerousMaterialResponse(
  decision: Exclude<DangerousMaterialDecision, { allowed: true }>,
): Response {
  return jsonResponse({
    ok: false,
    error: dangerousMaterialError(decision),
    securityEvent: decision.securityEvent,
  }, 400);
}

export function admitRawCallBody(body: string): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server call raw-body',
    rawBody: body,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

export function admitRawMcpBody(
  body: string,
  requestId: string,
): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server mcp raw-body',
    rawBody: body,
  });
  return decision.allowed
    ? null
    : dangerousMcpMaterialResponse(body, requestId, decision);
}

export function admitDecodedCallBody(input: CallInput): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server call decoded-json',
    value: input,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

export function admitDecodedMcpBody(
  body: string,
  requestId: string,
): Response | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return null;
  }

  const decision = assessDangerousMaterial({
    source: 'server mcp decoded-json',
    value: parsed,
  });
  return decision.allowed
    ? null
    : dangerousMcpMaterialResponse(body, requestId, decision);
}
