import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Command } from 'commander';

export type OsUpdateOptions = {
  channel?: string;
  check?: boolean;
  yes?: boolean;
  json?: boolean;
  quiet?: boolean;
};

export type OsUpdateInvocation = {
  command: string;
  args: string[];
  home: string;
};

type BuildInvocationDependencies = {
  home?: string;
  env?: NodeJS.ProcessEnv;
  commandExists?: (path: string) => boolean;
};

type UpdateCommandDependencies = BuildInvocationDependencies & {
  spawn?: typeof spawnSync;
};

export function buildOsUpdateInvocation(
  options: OsUpdateOptions,
  dependencies: BuildInvocationDependencies = {},
): OsUpdateInvocation {
  const env = dependencies.env ?? process.env;
  const home = dependencies.home
    ?? env.CONSUELO_HOME
    ?? env.CONSUELO_OS_HOME
    ?? join(homedir(), '.consuelo');
  const command = join(home, 'bin', 'consuelo');
  const commandExists = dependencies.commandExists ?? existsSync;

  if (!commandExists(command)) {
    throw new Error(
      `Consuelo OS is not installed at ${command}. Install or repair it from https://install.consuelohq.com/os`,
    );
  }

  const args = ['update'];
  if (options.channel) args.push('--channel', options.channel);
  if (options.check) args.push('--check');
  if (options.yes) args.push('--yes');
  if (options.json) args.push('--json');
  if (options.quiet) args.push('--quiet');

  return { command, args, home };
}

export function updateCommand(
  options: OsUpdateOptions = {},
  dependencies: UpdateCommandDependencies = {},
): number {
  const invocation = buildOsUpdateInvocation(options, dependencies);
  const spawn = dependencies.spawn ?? spawnSync;
  const result = spawn(invocation.command, invocation.args, {
    env: {
      ...(dependencies.env ?? process.env),
      CONSUELO_HOME: invocation.home,
    },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  return typeof result.status === 'number' ? result.status : 1;
}

export function registerUpdate(program: Command): void {
  program
    .command('update')
    .description('update Consuelo OS to the latest release on the active channel')
    .option('--channel <channel>', 'override the release channel for this update')
    .option('--check', 'check whether an update is available without installing it')
    .option('-y, --yes', 'install without an interactive confirmation')
    .allowUnknownOption(false)
    .action((options: OsUpdateOptions, command: Command) => {
      const globalOptions = command.optsWithGlobals() as {
        json?: boolean;
        quiet?: boolean;
      };
      const exitCode = updateCommand({
        ...options,
        json: globalOptions.json,
        quiet: globalOptions.quiet,
      });
      if (exitCode !== 0) process.exitCode = exitCode;
    });
}
