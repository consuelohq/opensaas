#!/usr/bin/env bun

import { homedir } from 'node:os';
import { win32 } from 'node:path';

import {
  assertSupportedWindowsHost,
  createWindowsServiceController,
  detectWindowsHost,
} from './lib/windows-platform';

type Command =
  | 'install-service'
  | 'status'
  | 'restart'
  | 'diagnostics'
  | 'uninstall-service';

type ParsedArguments = {
  command: Command;
  home: string;
  bunExecutable: string;
  serviceHostExecutable: string;
  json: boolean;
  dryRun: boolean;
  deferStart: boolean;
};

function readValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${option} requires a value`);
  return value;
}

function parseArguments(args: string[]): ParsedArguments {
  const command = args[0] as Command | undefined;
  if (
    !command ||
    ![
      'install-service',
      'status',
      'restart',
      'diagnostics',
      'uninstall-service',
    ].includes(command)
  ) {
    throw new Error(
      'usage: windows-platform.ts install-service|status|restart|diagnostics|uninstall-service [options]',
    );
  }
  let home = win32.join(process.env.USERPROFILE || homedir(), '.consuelo');
  let bunExecutable = process.env.BUN_BIN || process.execPath;
  let serviceHostExecutable = '';
  let json = false;
  let dryRun = false;
  let deferStart = false;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--home') {
      home = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--bun') {
      bunExecutable = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--service-host') {
      serviceHostExecutable = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--defer-start') {
      deferStart = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  home = win32.resolve(home);
  serviceHostExecutable = serviceHostExecutable
    ? win32.resolve(serviceHostExecutable)
    : win32.join(home, 'bin', 'Consuelo.Windows.Service.exe');
  return {
    command,
    home,
    bunExecutable: win32.resolve(bunExecutable),
    serviceHostExecutable,
    json,
    dryRun,
    deferStart,
  };
}

async function run(
  command: string,
  args: string[],
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const child = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw new Error(
      `failed to run ${command}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function currentUserSid(): Promise<string> {
  try {
    const result = await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
    ]);
    const sid = result.stdout.trim();
    if (result.exitCode !== 0 || !/^S-\d(?:-\d+)+$/.test(sid)) {
      throw new Error(
        result.stderr.trim() ||
          'failed to resolve the current Windows user SID',
      );
    }
    return sid;
  } catch (error: unknown) {
    throw new Error(
      `failed to identify the current Windows user: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArguments(process.argv.slice(2));
    const host = detectWindowsHost();
    assertSupportedWindowsHost(host);
    const controller = createWindowsServiceController({
      home: args.home,
      bunExecutable: args.bunExecutable,
      serviceHostExecutable: args.serviceHostExecutable,
      currentUserSid: await currentUserSid(),
      host,
      run,
    });

    let result: unknown;
    switch (args.command) {
      case 'install-service':
        await controller.install({ start: !args.deferStart });
        result = {
          command: args.command,
          changed: true,
          deferredStart: args.deferStart,
        };
        break;
      case 'status':
        result = await controller.status();
        break;
      case 'restart':
        await controller.restart({ waitForCompletion: true });
        result = {
          command: args.command,
          changed: true,
          status: await controller.status(),
        };
        break;
      case 'diagnostics':
        result = await controller.diagnostics();
        break;
      case 'uninstall-service':
        await controller.uninstall({ dryRun: args.dryRun, home: args.home });
        result = {
          command: args.command,
          changed: !args.dryRun,
          dryRun: args.dryRun,
        };
        break;
    }

    process.stdout.write(
      `${JSON.stringify(result, null, args.json ? 2 : 0)}\n`,
    );
  } catch (error: unknown) {
    throw new Error(
      `Windows platform command failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
