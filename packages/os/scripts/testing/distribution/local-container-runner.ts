import { resolve } from 'node:path';

export type LocalContainerEngine = {
  command: string;
  kind: 'apple-container' | 'docker';
};

type WhichCommand = (command: string) => string | null;

type LocalContainerCommandOptions = {
  engine: LocalContainerEngine;
  repoRoot: string;
};

const DISTRIBUTION_TEST_IMAGE = 'docker.io/oven/bun:1.3.14';

export function selectLocalContainerEngine(
  which: WhichCommand = Bun.which,
): LocalContainerEngine | null {
  const appleContainer = which('container');
  if (appleContainer) {
    return { command: appleContainer, kind: 'apple-container' };
  }

  const docker = which('docker');
  if (docker) {
    return { command: docker, kind: 'docker' };
  }

  return null;
}

export function createLocalContainerCommand(
  options: LocalContainerCommandOptions,
): string[] {
  return [
    options.engine.command,
    'run',
    '--rm',
    '--volume',
    `${resolve(options.repoRoot)}:/workspace:ro`,
    '--workdir',
    '/workspace',
    DISTRIBUTION_TEST_IMAGE,
    'bun',
    'packages/os/scripts/testing/distribution/environment-probe.ts',
    '--json',
  ];
}

type LocalContainerProbeResult =
  | {
      engine: LocalContainerEngine['kind'];
      report: unknown;
      status: 'passed';
    }
  | {
      reason: string;
      status: 'skipped';
    };

export function classifyLocalContainerFailure(
  stderr: string,
): Extract<LocalContainerProbeResult, { status: 'skipped' }> | null {
  if (stderr.includes('Cannot connect to the Docker daemon')) {
    return {
      reason: 'Docker is installed, but its local daemon is not running.',
      status: 'skipped',
    };
  }

  return null;
}

export async function runLocalContainerProbe(
  repoRoot: string,
): Promise<LocalContainerProbeResult> {
  try {
    const engine = selectLocalContainerEngine();
    if (!engine) {
      return {
        reason: 'Apple Container and Docker CLIs are not installed.',
        status: 'skipped',
      };
    }

    if (engine.kind === 'apple-container') {
      const start = Bun.spawn([engine.command, 'system', 'start'], {
        stderr: 'pipe',
        stdout: 'pipe',
      });
      const startError = await new Response(start.stderr).text();
      if ((await start.exited) !== 0) {
        throw new Error(`Apple Container failed to start: ${startError.trim()}`);
      }
    }

    const process = Bun.spawn(createLocalContainerCommand({ engine, repoRoot }), {
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);

    if (exitCode !== 0) {
      const skipped = classifyLocalContainerFailure(stderr);
      if (skipped) {
        return skipped;
      }

      throw new Error(
        `${engine.kind} distribution probe failed with exit code ${exitCode}: ${stderr.trim()}`,
      );
    }

    return {
      engine: engine.kind,
      report: JSON.parse(stdout),
      status: 'passed',
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Local distribution container probe failed.', {
      cause: error,
    });
  }
}

if (import.meta.main) {
  const repoRoot = resolve(import.meta.dir, '../../../../..');

  try {
    const result = await runLocalContainerProbe(repoRoot);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message, status: 'failed' })}\n`);
    process.exitCode = 1;
  }
}
