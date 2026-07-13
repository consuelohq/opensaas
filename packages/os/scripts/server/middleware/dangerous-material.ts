import {
  assessDangerousMaterial,
  dangerousMaterialError,
  type DangerousMaterialDecision,
} from '../../lib/dangerous-material-policy';
import type { CallInput } from '../../lib/types';

import { jsonResponse } from './errors';

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

export function admitRawMcpBody(body: string): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server mcp raw-body',
    rawBody: body,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

export function admitDecodedCallBody(input: CallInput): Response | null {
  const decision = assessDangerousMaterial({
    source: 'server call decoded-json',
    value: input,
  });
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}

export function admitDecodedMcpBody(body: string): Response | null {
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
  return decision.allowed ? null : dangerousMaterialResponse(decision);
}
