export type MonitorClassification =
  | 'expected-policy'
  | 'caller-input'
  | 'runtime-contract-drift'
  | 'defect-candidate'
  | 'transient'
  | 'external'
  | 'unknown';

export type MonitorToolContract = {
  name: string;
  readOnly: boolean;
  mutating: boolean;
  sessionRequired: boolean;
};

export type MonitorTraceFailure = {
  traceId: string;
  ts: string;
  tool: string;
  code: string;
  status: string;
  branch?: string;
  taskSession?: string;
  occurrences?: number;
  affectedBranches?: number;
  affectedSessions?: number;
  stderr?: string;
};

export type ClassifiedTraceFailure = MonitorTraceFailure & {
  classification: MonitorClassification;
  actionable: boolean;
  reason: string;
};

export type MonitorFailureSummary = {
  total: number;
  expectedPolicy: number;
  callerInput: number;
  runtimeContractDrift: number;
  defectCandidate: number;
  transient: number;
  external: number;
  unknown: number;
  actionable: number;
};

function recurring(failure: MonitorTraceFailure): boolean {
  return (failure.occurrences ?? 1) >= 3 ||
    (failure.affectedBranches ?? 0) >= 2 ||
    (failure.affectedSessions ?? 0) >= 2;
}

function classified(
  failure: MonitorTraceFailure,
  classification: MonitorClassification,
  actionable: boolean,
  reason: string,
): ClassifiedTraceFailure {
  return { ...failure, classification, actionable, reason };
}

export function classifyTraceFailure(
  failure: MonitorTraceFailure,
  contract?: MonitorToolContract,
): ClassifiedTraceFailure {
  const code = failure.code.trim().toUpperCase();

  if (code === 'TASK_SESSION_REQUIRED') {
    if (contract && !contract.sessionRequired) {
      return classified(
        failure,
        'runtime-contract-drift',
        true,
        `observed ${code} contradicts current ${contract.name} sessionRequired=false contract`,
      );
    }
    if (contract?.sessionRequired) {
      return classified(
        failure,
        'expected-policy',
        false,
        `current ${contract.name} contract requires a task session`,
      );
    }
    return classified(
      failure,
      recurring(failure) ? 'defect-candidate' : 'caller-input',
      recurring(failure),
      'session failure has no contradictory current tool contract',
    );
  }

  if (code === 'TASK_SESSION_NOT_FOUND' || code === 'TASK_SESSION_MISMATCH') {
    return classified(
      failure,
      'caller-input',
      false,
      'caller supplied a stale, unknown, or mismatched optional task session',
    );
  }

  if (code === 'UNKNOWN_TOOL_SCOPE' && contract) {
    return classified(
      failure,
      'runtime-contract-drift',
      true,
      `runtime rejected ${failure.tool} although the current OS tool contract exists`,
    );
  }

  if (code === 'SAFETY_BLOCKED' || code === 'APPROVAL_REQUIRED') {
    return classified(
      failure,
      'expected-policy',
      false,
      'OS safety or approval boundary rejected the operation as designed',
    );
  }

  if (
    code === 'VALIDATION_ERROR' ||
    code === 'CODE_CALL_VALIDATION_ERROR' ||
    code === 'INVALID_INPUT' ||
    code === 'SCHEMA_VALIDATION_FAILED'
  ) {
    return classified(
      failure,
      'caller-input',
      false,
      'input failed the advertised schema; this is not a product defect without contradictory contract evidence',
    );
  }

  if (code === 'TIMEOUT' || code === 'NETWORK_TIMEOUT' || code === 'RATE_LIMITED') {
    if (recurring(failure)) {
      return classified(
        failure,
        'defect-candidate',
        true,
        'timeout/rate-limit failure recurs across enough calls or contexts to justify root-cause review',
      );
    }
    return classified(failure, 'transient', false, 'isolated timeout/rate-limit evidence');
  }

  if (
    code === 'HTTP_ERROR' ||
    code === 'PROVIDER_ERROR' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'UPSTREAM_ERROR'
  ) {
    return classified(
      failure,
      recurring(failure) ? 'defect-candidate' : 'external',
      recurring(failure),
      recurring(failure)
        ? 'external/provider failure is recurring enough to inspect our adapter or resilience contract'
        : 'isolated external/provider failure',
    );
  }

  if (code === 'COMMAND_FAILED' && (failure.tool === 'batch' || failure.tool === 'code.call')) {
    return classified(
      failure,
      'unknown',
      false,
      failure.tool === 'batch'
        ? 'batch propagates child-tool failures; inspect the separately persisted child trace before attributing an OS defect'
        : 'code.call propagates arbitrary child-command nonzero exits; recurrence alone does not prove the execution wrapper is defective',
    );
  }

  if (code === 'COMMAND_FAILED' || code === 'PARSE_ERROR' || code === 'MALFORMED_OUTPUT') {
    if (recurring(failure)) {
      return classified(
        failure,
        'defect-candidate',
        true,
        'repeated execution or parsing failure indicates a likely OS/tooling root cause',
      );
    }
    return classified(
      failure,
      'transient',
      false,
      'single execution/parsing failure needs more evidence before changing code',
    );
  }

  if (recurring(failure)) {
    return classified(
      failure,
      'defect-candidate',
      true,
      'uncategorized failure recurs across enough calls or contexts to justify investigation',
    );
  }

  return classified(failure, 'unknown', false, 'insufficient evidence to classify as a product defect');
}

export function summarizeTraceFailures(
  failures: ClassifiedTraceFailure[],
): MonitorFailureSummary {
  const summary: MonitorFailureSummary = {
    total: failures.length,
    expectedPolicy: 0,
    callerInput: 0,
    runtimeContractDrift: 0,
    defectCandidate: 0,
    transient: 0,
    external: 0,
    unknown: 0,
    actionable: 0,
  };
  for (const failure of failures) {
    if (failure.actionable) summary.actionable += 1;
    switch (failure.classification) {
      case 'expected-policy': summary.expectedPolicy += 1; break;
      case 'caller-input': summary.callerInput += 1; break;
      case 'runtime-contract-drift': summary.runtimeContractDrift += 1; break;
      case 'defect-candidate': summary.defectCandidate += 1; break;
      case 'transient': summary.transient += 1; break;
      case 'external': summary.external += 1; break;
      case 'unknown': summary.unknown += 1; break;
    }
  }
  return summary;
}
