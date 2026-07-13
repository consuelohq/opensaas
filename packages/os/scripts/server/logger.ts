import { redactJson } from '../lib/redaction';

type LogContext = Record<string, unknown>;

function errorDiagnostic(error: unknown): unknown {
  try {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  } catch {
    return '[UNAVAILABLE_ERROR]';
  }
}

function writeLog(entry: Record<string, unknown>): void {
  try {
    const line = JSON.stringify(redactJson(entry));
    process.stderr.write(`${line}\n`);
  } catch {
    try {
      process.stderr.write(`${JSON.stringify({
        level: 'error',
        service: 'consuelo-os-local-server',
        event: 'local_os.logging_failed',
        message: 'local_os.logging_failed',
        ts: new Date().toISOString(),
      })}\n`);
    } catch {
      // Logging must never replace the original request failure.
    }
  }
}

export function logLocalOsServerError(
  event: string,
  error: unknown,
  context: LogContext = {},
): void {
  writeLog({
    level: 'error',
    service: 'consuelo-os-local-server',
    event,
    message: event,
    error: errorDiagnostic(error),
    context,
    ts: new Date().toISOString(),
  });
}
