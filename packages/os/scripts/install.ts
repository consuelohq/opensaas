#!/usr/bin/env bun

import fs from 'node:fs';
import {
  cancel,
  confirm,
  groupMultiselect,
  isCancel,
  multiselect,
  select,
  text,
} from '@clack/prompts';

import {
  getDefaultSelectedSkillNames,
  getGroupedOnboardingSkillOptions,
} from './lib/onboarding-skills';
import {
  info,
  printEnd,
  printOsBanner,
  spinner,
  stepComplete,
  success,
} from './lib/cli-ui';
import {
  detectAgents,
  provisionLocalOs,
  resolveOsHome,
  type AgentName,
  type OsMode,
} from './lib/install-state';

type ArtifactMode = 'local';
type SkillName = string;

type InstallOptions = {
  dryRun: boolean;
  yes: boolean;
  json: boolean;
  quiet: boolean;
  checkTty: boolean;
  installDaemons: boolean;
  skipDaemons: boolean;
  home?: string;
  mode?: OsMode;
  artifactMode: ArtifactMode;
  selectedSkills: SkillName[];
  connectAgents: AgentName[];
};

const AGENT_NAMES = new Set<AgentName>([
  'codex',
  'claude',
  'opencode',
  'factory',
]);

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function parseArgs(argv: string[]): InstallOptions {
  const options: InstallOptions = {
    dryRun: false,
    yes: false,
    json: false,
    quiet: false,
    checkTty: false,
    installDaemons: false,
    skipDaemons: false,
    artifactMode: 'local',
    selectedSkills: getDefaultSelectedSkillNames(),
    connectAgents: [],
  };

  const readValue = (flag: string, index: number): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith('-')) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--check-tty') options.checkTty = true;
    else if (arg === '--install-daemons') options.installDaemons = true;
    else if (arg === '--skip-daemons') options.skipDaemons = true;
    else if (arg === '--home') {
      options.home = readValue('--home', index);
      index += 1;
    } else if (arg === '--mode') {
      const mode = readValue('--mode', index);
      index += 1;
      if (mode !== 'local' && mode !== 'cloud')
        throw new Error('--mode must be local or cloud');
      options.mode = mode;
    } else if (arg === '--connect-agent') {
      const agent = readValue('--connect-agent', index) as AgentName;
      index += 1;
      if (!AGENT_NAMES.has(agent))
        throw new Error(
          '--connect-agent must be codex, claude, opencode, or factory',
        );
      options.connectAgents.push(agent);
    } else if (arg === '--connect-agents') {
      options.connectAgents = ['codex', 'claude', 'opencode'];
    } else if (arg === '--help' || arg === '-h') {
      writeStdout(
        [
          'usage: bun ./scripts/install.ts [--yes] [--dry-run] [--home <path>] [--mode local|cloud]',
          '',
          'Consuelo OS runs a local background service on your Mac so agents and apps can reach your OS while you work. This is similar to common Mac utilities that run in the background. You can stop or uninstall it later.',
          '',
          'Options:',
          '  --yes                 run without prompts',
          '  --dry-run             print planned writes without writing',
          '  --home <path>         override OS home',
          '  --mode <mode>         local or cloud',
          '  --connect-agent <id>  connect codex, claude, opencode, or factory',
          '  --connect-agents      connect detected Codex, Claude, and OpenCode agents',
          '  --json                machine-readable output',
          '  --quiet               reduce human output',
          '  --check-tty          print safe terminal diagnostics',
          '',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function getTtyDiagnostics() {
  const stdinWithRawMode = process.stdin as typeof process.stdin & {
    setRawMode?: (enabled: boolean) => typeof process.stdin;
  };

  return {
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    stderrIsTTY: Boolean(process.stderr.isTTY),
    canSetRawMode: typeof stdinWithRawMode.setRawMode === 'function',
    term: process.env.TERM ?? '',
    ci: process.env.CI ?? '',
  };
}

function printTtyDiagnostics(): void {
  writeStdout(`${JSON.stringify(getTtyDiagnostics(), null, 2)}
`);
}

function getClackIo() {
  return {
    input: process.stdin,
    output: process.stdout,
  };
}

function assertClackTtyReady(options: InstallOptions): void {
  if (options.yes || options.json || options.checkTty) return;

  const diagnostics = getTtyDiagnostics();
  if (
    diagnostics.stdinIsTTY &&
    diagnostics.stdoutIsTTY &&
    diagnostics.stderrIsTTY &&
    diagnostics.canSetRawMode
  ) {
    return;
  }

  throw new Error(
    [
      'interactive Consuelo OS setup needs a real terminal for keyboard input.',
      `stdin.isTTY=${diagnostics.stdinIsTTY}`,
      `stdout.isTTY=${diagnostics.stdoutIsTTY}`,
      `stderr.isTTY=${diagnostics.stderrIsTTY}`,
      `canSetRawMode=${diagnostics.canSetRawMode}`,
      'Re-run non-interactively with: curl -fsSL https://install.consuelohq.com/os | bash -s -- --yes --install-daemons',
    ].join('\n'),
  );
}

function summarizeActions(result: ReturnType<typeof provisionLocalOs>): string {
  return `saved to ${result.home}`;
}

async function promptOptions(options: InstallOptions): Promise<InstallOptions> {
  try {
    if (options.yes || options.json) return options;
    assertClackTtyReady(options);

    printOsBanner(['home', 'skills', 'artifacts', 'agents', 'health']);
    info('finish home, skills, artifacts, agents, and health before the final background service step.');
    const clackIo = getClackIo();

    const mode = await select({
      ...clackIo,
      message: 'choose an OS mode',
      initialValue: options.mode ?? 'local',
      options: [
        { value: 'local' as const, label: 'local OS', hint: 'runs on this machine' },
        { value: 'cloud' as const, label: 'connect to cloud OS', hint: 'uses hosted workspace services later' },
      ],
    });
    if (isCancel(mode)) { cancel('setup cancelled.'); process.exit(0); }

    const home = await text({
      ...clackIo,
      message: 'OS home',
      initialValue: resolveOsHome(options.home),
      validate: (value) => (value.length > 0 ? undefined : 'home is required'),
    });
    if (isCancel(home)) { cancel('setup cancelled.'); process.exit(0); }

    const skillPrompt = getGroupedOnboardingSkillOptions();
    const selectedSkills = await groupMultiselect({
      ...clackIo,
      message: 'select skills to enable',
      options: skillPrompt.options,
      initialValues: skillPrompt.initialValues,
      cursorAt: skillPrompt.cursorAt,
      selectableGroups: skillPrompt.selectableGroups,
      groupSpacing: skillPrompt.groupSpacing,
      required: false,
    });
    if (isCancel(selectedSkills)) { cancel('setup cancelled.'); process.exit(0); }

    const artifactMode = await select({
      ...clackIo,
      message: 'choose artifact storage',
      initialValue: options.artifactMode,
      options: [{ value: 'local' as const, label: 'local artifacts', hint: 'save generated files under OS home' }],
    });
    if (isCancel(artifactMode)) { cancel('setup cancelled.'); process.exit(0); }

    const detectedAgents = detectAgents(home).filter((agent) => agent.detected);
    let connectAgents: AgentName[] = options.connectAgents;
    if (detectedAgents.length > 0) {
      const shouldConnect = await confirm({ ...clackIo, message: 'connect detected agents to the OS portal?', initialValue: true });
      if (!isCancel(shouldConnect) && shouldConnect) {
        const selectedAgents = await multiselect({
          ...clackIo,
          message: 'select agents to connect — Use Space to select agents, press Enter to continue',
          options: detectedAgents.map((agent) => ({ value: agent.name, label: agent.label, hint: agent.homePath })),
          required: false,
        });
        if (!isCancel(selectedAgents)) connectAgents = selectedAgents as AgentName[];
      }
    }

    const installDaemons = await confirm({ ...clackIo, message: 'install local background service?', initialValue: true });
    if (isCancel(installDaemons)) { cancel('setup cancelled.'); process.exit(0); }
    info('background service is the final setup step; tokens and secrets stay local and are not printed.');

    return { ...options, mode, home, selectedSkills: selectedSkills as SkillName[], artifactMode, connectAgents, installDaemons };
  } catch (error: unknown) {
    throw new Error(`install prompt failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  try {
    const parsedOptions = parseArgs(process.argv.slice(2));
    if (parsedOptions.checkTty) {
      printTtyDiagnostics();
      return;
    }

    const options = await promptOptions(parsedOptions);
    const spin =
      options.quiet || options.json
        ? null
        : spinner(
            options.dryRun
              ? 'planning local OS install...'
              : 'installing local OS...',
          ).start();
    const result = provisionLocalOs({
      home: options.home,
      mode: options.mode ?? 'local',
      dryRun: options.dryRun,
      connectAgents: options.connectAgents,
      selectedSkills: options.selectedSkills,
      artifactStorage: options.artifactMode,
    });
    const payload = {
      ...result,
      onboarding: {
        selectedSkills: options.selectedSkills,
        artifactMode: options.artifactMode,
        connectAgents: options.connectAgents,
        installDaemons: options.installDaemons,
      },
      installDaemons: options.installDaemons,
    };
    const resultFile = process.env.CONSUELO_ONBOARDING_RESULT_FILE;
    const suppressFinalSummary = Boolean(resultFile);
    if (resultFile) {
      fs.writeFileSync(resultFile, `${JSON.stringify(payload, null, 2)}\n`, {
        mode: 0o600,
      });
    }

    spin?.succeed(options.dryRun ? 'install plan ready' : 'local OS saved');

    if (options.json) {
      writeStdout(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    if (!options.quiet) {
      stepComplete('home');
      stepComplete('skills');
      stepComplete('artifacts');
      if (options.connectAgents.length > 0) stepComplete('agents');
      success(options.dryRun ? 'dry run complete' : 'configuration saved');
      info(summarizeActions(result));
      if (!suppressFinalSummary) {
        info(
          `next: CONSUELO_HOME=${result.home} bun --cwd ${result.home} run doctor`,
        );
        printEnd('OS ready');
      }
    }
  } catch (error: unknown) {
    throw new Error(
      `install failed: ${error instanceof Error ? error.message : String(error)}`,
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
