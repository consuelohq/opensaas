import { Data } from 'effect';

import { redactProviderText } from './redaction';
import type { DeploymentProviderOperation, ProviderApprovalMetadata } from './schema';

export type ProviderErrorCode =
  | 'CLI_MISSING'
  | 'UNSUPPORTED_VERSION'
  | 'UNAUTHENTICATED'
  | 'NO_CONTEXT'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'MALFORMED_OUTPUT'
  | 'INVALID_INPUT'
  | 'COMMAND_FAILED'
  | 'UNSUPPORTED_CAPABILITY'
  | 'APPROVAL_REQUIRED'
  | 'TIMEOUT'
  | 'CANCELLED';

export class ProviderInputError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'ProviderInputError';
    this.field = field;
  }
}

export const providerInputError = (field: string, message: string): ProviderInputError => {
  return new ProviderInputError(field, message);
};

export type ProviderCommandDiagnostics = {
  command: string;
  exitCode: number;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
};

export type ProviderRecoveryGuidance = {
  action: 'install_cli' | 'authenticate_cli';
  command: string;
  message: string;
};

export class ProviderError extends Data.TaggedError('ProviderError')<{
  code: ProviderErrorCode;
  provider: string;
  operation: DeploymentProviderOperation;
  message: string;
  diagnostics?: ProviderCommandDiagnostics;
  approval?: ProviderApprovalMetadata;
  recovery?: ProviderRecoveryGuidance;
  cause?: { name: string; message: string };
}> {}

export const providerError = (input: {
  code: ProviderErrorCode;
  provider: string;
  operation: DeploymentProviderOperation;
  message: string;
  diagnostics?: ProviderCommandDiagnostics;
  approval?: ProviderApprovalMetadata;
  recovery?: ProviderRecoveryGuidance;
  cause?: unknown;
}): ProviderError => {
  const cause = input.cause === undefined
    ? undefined
    : input.cause instanceof Error
      ? { name: input.cause.name, message: redactProviderText(input.cause.message) }
      : { name: 'Error', message: redactProviderText(String(input.cause)) };
  return new ProviderError({
    code: input.code,
    provider: input.provider,
    operation: input.operation,
    message: input.message,
    ...(input.diagnostics ? { diagnostics: input.diagnostics } : {}),
    ...(input.approval ? { approval: input.approval } : {}),
    ...(input.recovery ? { recovery: input.recovery } : {}),
    ...(cause ? { cause } : {}),
  });
};
