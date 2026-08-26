#!/usr/bin/env bun

import { Effect } from 'effect';

import {
  ensureGoogleWorkspaceOAuthCredentials,
  googleWorkspaceAccount,
} from './lib/google-workspace-auth';
import { ensureManagedGog } from './lib/managed-gog';
import { resolveOsHome } from './lib/install-state';
import {
  createGoogleService,
  GoogleError,
  type GoogleRunInput,
} from '../tools/google/service';

type GoogleCliArgs = {
  action: 'status' | 'connect' | 'run';
  args: string[];
  account?: string;
  mode: 'read' | 'write';
  approved: boolean;
  approvalReason?: string;
  timeoutMs?: number;
};

function value(argv: readonly string[], index: number, flag: string): string {
  const next = argv[index + 1];
  if (next === undefined) throw new Error(`${flag} requires a value`);
  return next;
}

function positiveInteger(raw: string, flag: string): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${flag} requires a positive integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10 * 60_000) {
    throw new Error(`${flag} must be between 1 and 600000`);
  }
  return parsed;
}

function parseArgs(argv: readonly string[]): GoogleCliArgs {
  let action: GoogleCliArgs['action'] | undefined;
  const args: string[] = [];
  let account: string | undefined;
  let mode: GoogleCliArgs['mode'] = 'read';
  let approved = false;
  let approvalReason: string | undefined;
  let timeoutMs: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--action') {
      const selected = value(argv, index, argument);
      if (selected !== 'status' && selected !== 'connect' && selected !== 'run') {
        throw new Error('--action must be status, connect, or run');
      }
      action = selected;
      index += 1;
    } else if (argument === '--arg') {
      args.push(value(argv, index, argument));
      index += 1;
    } else if (argument === '--account') {
      account = value(argv, index, argument).trim();
      index += 1;
    } else if (argument === '--mode') {
      const selected = value(argv, index, argument);
      if (selected !== 'read' && selected !== 'write') throw new Error('--mode must be read or write');
      mode = selected;
      index += 1;
    } else if (argument === '--approved') {
      approved = true;
    } else if (argument === '--approval-reason') {
      approvalReason = value(argv, index, argument);
      index += 1;
    } else if (argument === '--timeout-ms') {
      timeoutMs = positiveInteger(value(argv, index, argument), argument);
      index += 1;
    } else if (argument === '--json') {
      // Facade compatibility: output is always structured JSON.
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }

  if (!action) throw new Error('--action is required');
  if (action === 'run' && args.length === 0) throw new Error('--arg is required for google run');
  return {
    action,
    args,
    ...(account ? { account } : {}),
    mode,
    approved,
    ...(approvalReason ? { approvalReason } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
  };
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function failure(error: unknown): { code: string; message: string } {
  if (error instanceof GoogleError) return { code: error.code, message: error.message };
  return { code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) };
}

function accountFor(home: string, explicit?: string): string {
  const account = explicit?.trim() || googleWorkspaceAccount(home)?.trim();
  if (!account) {
    throw new GoogleError({
      code: 'AUTH_REQUIRED',
      message: 'Google needs an account email to connect. Re-run with account, or update Consuelo so the verified Google account is available on this node.',
    });
  }
  return account;
}

async function connectGoogle(input: {
  home: string;
  executable: string;
  account?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const account = accountFor(input.home, input.account);
  await ensureGoogleWorkspaceOAuthCredentials({ home: input.home, executable: input.executable });
  const service = createGoogleService({ executable: input.executable });
  return Effect.runPromise(service.connect({ account, timeoutMs: input.timeoutMs }));
}

async function runGoogle(input: {
  home: string;
  executable: string;
  args: GoogleCliArgs;
}): Promise<unknown> {
  const service = createGoogleService({ executable: input.executable });
  const account = input.args.account?.trim() || (() => {
    try {
      return googleWorkspaceAccount(input.home);
    } catch {
      return undefined;
    }
  })();
  const runInput: GoogleRunInput = {
    args: input.args.args,
    ...(account ? { account } : {}),
    mode: input.args.mode,
    ...(input.args.approved
      ? { approval: { approved: true, ...(input.args.approvalReason ? { reason: input.args.approvalReason } : {}) } }
      : {}),
    ...(input.args.timeoutMs ? { timeoutMs: input.args.timeoutMs } : {}),
  };
  try {
    return await Effect.runPromise(service.run(runInput));
  } catch (error: unknown) {
    if (!(error instanceof GoogleError) || error.code !== 'AUTH_REQUIRED') throw error;
    await connectGoogle({
      home: input.home,
      executable: input.executable,
      ...(account ? { account } : {}),
      timeoutMs: input.args.timeoutMs,
    });
    if (input.args.mode === 'write') {
      return {
        connected: true,
        retryRequired: true,
        message: 'Google is connected. Retry the explicitly approved write once; it was not replayed automatically after OAuth.',
      };
    }
    const retryAccount = accountFor(input.home, account);
    return Effect.runPromise(service.run({ ...runInput, account: retryAccount }));
  }
}

export async function runGoogleCli(argv: readonly string[]): Promise<number> {
  let args: GoogleCliArgs;
  try {
    args = parseArgs(argv);
  } catch (error: unknown) {
    output({ ok: false, error: failure(error) });
    return 1;
  }

  try {
    const home = resolveOsHome();
    const runtime = await ensureManagedGog({ home });
    const service = createGoogleService({ executable: runtime.path });
    let data: unknown;
    if (args.action === 'status') {
      data = await Effect.runPromise(service.status({ timeoutMs: args.timeoutMs }));
    } else if (args.action === 'connect') {
      data = await connectGoogle({
        home,
        executable: runtime.path,
        account: args.account,
        timeoutMs: args.timeoutMs,
      });
    } else {
      data = await runGoogle({ home, executable: runtime.path, args });
    }
    output({ ok: true, data, runtime: { version: runtime.version } });
    return 0;
  } catch (error: unknown) {
    output({ ok: false, error: failure(error) });
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await runGoogleCli(process.argv.slice(2));
  process.exit(exitCode);
}
