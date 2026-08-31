import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Command } from 'commander';

export type OsSkillAction = 'add' | 'remove';

export type OsSkillCommandOptions = {
  json?: boolean;
  quiet?: boolean;
};

export type OsSkillInvocation = {
  command: string;
  args: string[];
  home: string;
};

type BuildInvocationDependencies = {
  home?: string;
  env?: NodeJS.ProcessEnv;
  commandExists?: (path: string) => boolean;
};

type SkillCommandDependencies = BuildInvocationDependencies & {
  spawn?: typeof spawnSync;
};

export function buildOsSkillInvocation(
  action: OsSkillAction,
  skills: readonly string[],
  options: OsSkillCommandOptions = {},
  dependencies: BuildInvocationDependencies = {},
): OsSkillInvocation {
  const env = dependencies.env ?? process.env;
  const home =
    dependencies.home ??
    env.CONSUELO_HOME ??
    env.CONSUELO_OS_HOME ??
    join(homedir(), '.consuelo');
  const command = join(home, 'bin', 'consuelo');
  const commandExists = dependencies.commandExists ?? existsSync;

  if (!commandExists(command)) {
    throw new Error(
      `Consuelo OS is not installed at ${command}. Install or repair it from https://install.consuelohq.com/os`,
    );
  }

  const args = [action, 'skill', ...skills];
  if (options.json) args.push('--json');
  if (options.quiet) args.push('--quiet');
  return { command, args, home };
}

export function skillCommand(
  action: OsSkillAction,
  skills: readonly string[],
  options: OsSkillCommandOptions = {},
  dependencies: SkillCommandDependencies = {},
): number {
  const invocation = buildOsSkillInvocation(
    action,
    skills,
    options,
    dependencies,
  );
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

function registerSkillCommand(program: Command, action: OsSkillAction): void {
  const parent = program
    .command(action)
    .description(`${action} Consuelo OS components`);

  parent
    .command('skill [skills...]')
    .description(
      action === 'add'
        ? 'install one or more Consuelo OS skills'
        : 'remove one or more installed Consuelo OS skills',
    )
    .allowUnknownOption(false)
    .action((skills: string[] | undefined, command: Command) => {
      const globalOptions = command.optsWithGlobals() as OsSkillCommandOptions;
      const exitCode = skillCommand(action, skills ?? [], {
        json: globalOptions.json,
        quiet: globalOptions.quiet,
      });
      if (exitCode !== 0) process.exitCode = exitCode;
    });
}

export function registerSkillCommands(program: Command): void {
  registerSkillCommand(program, 'add');
  registerSkillCommand(program, 'remove');
}
