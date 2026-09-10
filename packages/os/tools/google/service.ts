import { Data, Effect } from 'effect';

import { createNodeProviderProcess } from '../deployment-provider/process';
import type { ProviderProcess, ProviderProcessResult } from '../deployment-provider/types';

export type GoogleErrorCode =
  | 'INVALID_INPUT'
  | 'APPROVAL_REQUIRED'
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'MALFORMED_OUTPUT'
  | 'COMMAND_FAILED';

export class GoogleError extends Data.TaggedError('GoogleError')<{
  code: GoogleErrorCode;
  message: string;
}> {}

export type GoogleRunInput = {
  args: string[];
  account?: string;
  mode?: 'read' | 'write';
  approval?: { approved: boolean; reason?: string };
  timeoutMs?: number;
};

export type GoogleService = {
  status: (input?: { timeoutMs?: number }) => Effect.Effect<unknown, GoogleError>;
  connect: (input: { account: string; timeoutMs?: number }) => Effect.Effect<unknown, GoogleError>;
  run: (input: GoogleRunInput) => Effect.Effect<unknown, GoogleError>;
};

const ALLOWED_SERVICES = ['gmail', 'calendar', 'drive', 'docs', 'sheets', 'contacts'] as const;
const ALLOWED_SERVICE_SET = new Set<string>(ALLOWED_SERVICES);
const BLOCKED_ROOT_FLAGS = [
  '--access-token', '--account', '--client', '--disable-commands', '--dry-run',
  '--enable-commands', '--force', '--gmail-no-send', '--home', '--json',
  '--no-input', '--readonly', '--wrap-untrusted',
] as const;

function googleError(code: GoogleErrorCode, message: string): GoogleError {
  return new GoogleError({ code, message });
}

function rejectPolicyFlags(args: readonly string[]): void {
  for (const argument of args) {
    const blocked = BLOCKED_ROOT_FLAGS.find((flag) => argument === flag || argument.startsWith(`${flag}=`));
    if (blocked) throw googleError('INVALID_INPUT', `${blocked} is controlled by the Consuelo Google wrapper`);
  }
}

export function buildGoogleCommand(input: {
  executable: string;
  args: string[];
  account?: string;
  mode?: 'read' | 'write';
}): { command: string; args: string[] } {
  if (!input.args.length) throw googleError('INVALID_INPUT', 'Google command arguments are required');
  const service = input.args[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_SERVICE_SET.has(service)) {
    throw googleError('INVALID_INPUT', `Google supports only ${ALLOWED_SERVICES.join(', ')} through this tool`);
  }
  rejectPolicyFlags(input.args);
  const root = ['--json', '--no-input', '--wrap-untrusted'];
  if (input.account?.trim()) root.push('--account', input.account.trim());
  if ((input.mode ?? 'read') === 'read') root.push('--readonly');
  return { command: input.executable, args: [...root, ...input.args] };
}

function processFailure(result: ProviderProcessResult): GoogleError {
  if (result.cancelled) return googleError('CANCELLED', 'Google command was cancelled');
  if (result.timedOut) return googleError('TIMEOUT', 'Google command timed out');
  if (result.exitCode === 4) return googleError('AUTH_REQUIRED', 'Google needs to be connected before this command can run');
  if (result.exitCode === 6) return googleError('PERMISSION_DENIED', 'Google denied this operation');
  if (result.exitCode === 7) return googleError('RATE_LIMITED', 'Google rate limited this operation');
  if (result.exitCode === 8) return googleError('UNAVAILABLE', 'Google is temporarily unavailable');
  return googleError('COMMAND_FAILED', 'Google command failed');
}

function parseJson(result: ProviderProcessResult): unknown {
  const stdout = result.stdout.trim();
  if (!stdout) return null;
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw googleError('MALFORMED_OUTPUT', 'Google returned malformed JSON output');
  }
}

export function createGoogleService(options: { process?: ProviderProcess; executable: string }): GoogleService {
  const providerProcess = options.process ?? createNodeProviderProcess({ maxOutputBytes: 512 * 1024 });
  const execute = (command: string, args: string[], timeoutMs: number): Effect.Effect<unknown, GoogleError> =>
    providerProcess.run({ command, args, cwd: process.cwd(), env: process.env, timeoutMs }).pipe(
      Effect.flatMap((result) => {
        if (result.exitCode !== 0 || result.runtimeMissing || result.timedOut || result.cancelled) {
          return Effect.fail(processFailure(result));
        }
        try {
          return Effect.succeed(parseJson(result));
        } catch (error: unknown) {
          return Effect.fail(error instanceof GoogleError ? error : googleError('MALFORMED_OUTPUT', 'Google returned malformed output'));
        }
      }),
    );

  return {
    status: (input = {}) => execute(options.executable, ['--json', '--no-input', 'auth', 'status'], input.timeoutMs ?? 30_000),
    connect: (input) => {
      const account = input.account.trim();
      if (!account) return Effect.fail(googleError('INVALID_INPUT', 'Google account email is required'));
      return execute(options.executable, ['--json', 'auth', 'add', account, '--services', ALLOWED_SERVICES.join(',')], input.timeoutMs ?? 10 * 60_000);
    },
    run: (input) => {
      if ((input.mode ?? 'read') === 'write' && input.approval?.approved !== true) {
        return Effect.fail(googleError('APPROVAL_REQUIRED', 'APPROVAL_REQUIRED: Google write operations require explicit approval'));
      }
      try {
        const command = buildGoogleCommand({ executable: options.executable, args: input.args, account: input.account, mode: input.mode });
        return execute(command.command, command.args, input.timeoutMs ?? 120_000);
      } catch (error: unknown) {
        return Effect.fail(error instanceof GoogleError ? error : googleError('INVALID_INPUT', String(error)));
      }
    },
  };
}
