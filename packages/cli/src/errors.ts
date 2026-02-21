import { captureError } from './sentry.js';
import { json, isJson, error } from './output.js';

export function handleCommandError(
  err: unknown,
  context: { code: string; friendlyMessage: string; command: string },
): never {
  captureError(err, { command: context.command });
  const raw = err instanceof Error ? err.message : 'unknown error';
  if (isJson()) {
    json({ error: { code: context.code, message: raw } });
  } else {
    error(context.friendlyMessage);
  }
  process.exit(1);
}
