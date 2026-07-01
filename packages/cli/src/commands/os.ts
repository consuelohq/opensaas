import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';

type InstallCommandOptions = {
  dryRun?: boolean;
  home?: string;
  yes?: boolean;
  mode?: string;
  connectAgent?: string;
  connectAgents?: boolean;
};

type DoctorCommandOptions = {
  home?: string;
};

function findRepoRoot(start: string): string {
  let current = start;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'packages', 'os', 'package.json')))
      return current;
    current = dirname(current);
  }
  return start;
}

function runOsScript(script: string, args: string[]): void {
  const repoRoot = findRepoRoot(process.cwd());
  const scriptPath = join(repoRoot, 'packages', 'os', 'scripts', script);
  const result = spawnSync('bun', [scriptPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0)
    process.exit(result.status);
}

function withGlobalFlags(command: Command, args: string[]): string[] {
  const globalOptions = command.optsWithGlobals() as {
    json?: boolean;
    quiet?: boolean;
  };
  const nextArgs = [...args];
  if (globalOptions.json && !nextArgs.includes('--json'))
    nextArgs.push('--json');
  if (globalOptions.quiet && !nextArgs.includes('--quiet'))
    nextArgs.push('--quiet');
  return nextArgs;
}

function installArgs(options: InstallCommandOptions): string[] {
  const args: string[] = [];
  if (options.dryRun) args.push('--dry-run');
  if (options.home) args.push('--home', options.home);
  if (options.yes) args.push('--yes');
  if (options.mode) args.push('--mode', options.mode);
  if (options.connectAgent) args.push('--connect-agent', options.connectAgent);
  if (options.connectAgents) args.push('--connect-agents');
  return args;
}

function doctorArgs(options: DoctorCommandOptions): string[] {
  return options.home ? ['--home', options.home] : [];
}

export function registerOs(program: Command): void {
  const os = program
    .command('os')
    .description('manage Consuelo OS local runtime');

  os.command('install')
    .description('install Consuelo OS locally')
    .option('--dry-run', 'print planned writes without writing')
    .option('--home <path>', 'override OS home')
    .option('--yes', 'run without prompts')
    .option('--mode <mode>', 'local or cloud')
    .option(
      '--connect-agent <id>',
      'connect codex, claude, opencode, or factory',
    )
    .option(
      '--connect-agents',
      'connect detected Codex, Claude, and OpenCode agents',
    )
    .allowUnknownOption(false)
    .action((options: InstallCommandOptions, command) => {
      runOsScript('install.ts', withGlobalFlags(command, installArgs(options)));
    });

  os.command('doctor')
    .description('check Consuelo OS local health')
    .option('--home <path>', 'override OS home')
    .allowUnknownOption(false)
    .action((options: DoctorCommandOptions, command) => {
      runOsScript('doctor.ts', withGlobalFlags(command, doctorArgs(options)));
    });

  os.command('start')
    .description('start the Consuelo OS portal')
    .action(() => {
      runOsScript('server.js', ['start']);
    });

  os.command('status')
    .description('show Consuelo OS portal status')
    .action(() => {
      runOsScript('server.js', ['status']);
    });
}
