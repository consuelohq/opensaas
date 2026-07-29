import { Data } from 'effect';

export type LifecycleErrorCode =
  | 'INSTALL_STATE_INVALID'
  | 'LOCK_HELD'
  | 'LOCK_IO_FAILED'
  | 'MANIFEST_FETCH_FAILED'
  | 'MANIFEST_INVALID'
  | 'MANIFEST_SIGNATURE_INVALID'
  | 'BUNDLE_DOWNLOAD_FAILED'
  | 'BUNDLE_DIGEST_MISMATCH'
  | 'BUNDLE_VERIFY_FAILED'
  | 'STAGING_FAILED'
  | 'PREFLIGHT_FAILED'
  | 'MIGRATION_FAILED'
  | 'ACTIVATION_FAILED'
  | 'SERVICE_PREFLIGHT_FAILED'
  | 'SERVICE_RESTART_FAILED'
  | 'HEALTH_REJECTED'
  | 'CONFIG_INVALID'
  | 'CONFIG_WRITE_FAILED'
  | 'ONBOARDING_FAILED'
  | 'REPAIR_FAILED'
  | 'ROLLBACK_FAILED'
  | 'RETENTION_FAILED'
  | 'UNINSTALL_FAILED'
  | 'RESET_NOT_ALLOWED';

export class LifecycleError extends Data.TaggedError('LifecycleError')<{
  code: LifecycleErrorCode;
  message: string;
  phase?: string;
  cause?: unknown;
}> {}

export function lifecycleError(
  code: LifecycleErrorCode,
  message: string,
  options: { phase?: string; cause?: unknown } = {},
): LifecycleError {
  return new LifecycleError({ code, message, ...options });
}

export function asLifecycleError(
  error: unknown,
  code: LifecycleErrorCode,
  message: string,
  phase?: string,
): LifecycleError {
  if (error instanceof LifecycleError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  return lifecycleError(code, `${message}: ${detail}`, { cause: error, phase });
}
