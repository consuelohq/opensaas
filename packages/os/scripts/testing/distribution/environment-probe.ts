import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

export type DistributionEnvironmentReport = {
  schemaVersion: 1;
  runtime: {
    arch: string;
    bunVersion: string;
    ci: boolean;
    platform: string;
  };
  home: {
    atomicReplace: boolean;
    cleanup: boolean;
    isolated: boolean;
    writable: boolean;
  };
};

const PROBE_DIRECTORY_PREFIX = '.consuelo-os-environment-probe-';

type DistributionEnvironmentProbeOptions = {
  arch?: string;
  cleanup?: boolean;
  environment?: Record<string, string | undefined>;
  home: string;
  platform?: string;
};

function isRealConsueloHome(home: string): boolean {
  return resolve(home) === resolve(join(homedir(), '.consuelo'));
}

export async function runDistributionEnvironmentProbe(
  options: DistributionEnvironmentProbeOptions,
): Promise<DistributionEnvironmentReport> {
  if (!isAbsolute(options.home)) {
    throw new Error('Distribution probe home must be an absolute path.');
  }

  if (isRealConsueloHome(options.home)) {
    throw new Error('Distribution probe refuses to use the real Consuelo home.');
  }

  const cleanup = options.cleanup ?? true;
  const environment = options.environment ?? process.env;
  const probeParent = resolve(options.home);
  await mkdir(probeParent, { recursive: true });
  const probeHome = await mkdtemp(join(probeParent, PROBE_DIRECTORY_PREFIX));
  const probeDirectory = join(probeHome, 'node', 'tmp', 'environment-probe');
  const currentPath = join(probeDirectory, 'current');
  const candidatePath = join(probeDirectory, 'candidate');

  try {
    await mkdir(probeDirectory, { recursive: true });
    await writeFile(currentPath, 'before', 'utf8');
    await writeFile(candidatePath, 'after', 'utf8');
    await rename(candidatePath, currentPath);
    const current = await readFile(currentPath, 'utf8');

    if (current !== 'after') {
      throw new Error('Atomic replacement did not activate the candidate.');
    }

    return {
      schemaVersion: 1,
      runtime: {
        arch: options.arch ?? process.arch,
        bunVersion: process.versions.bun ?? 'unavailable',
        ci: environment.CI === 'true',
        platform: options.platform ?? process.platform,
      },
      home: {
        atomicReplace: true,
        cleanup,
        isolated: true,
        writable: true,
      },
    };
  } finally {
    if (cleanup) {
      await rm(probeHome, { force: true, recursive: true });
    }
  }
}

function argumentValue(name: string): string | undefined {
  const index = Bun.argv.indexOf(name);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

if (import.meta.main) {
  const suppliedHome = argumentValue('--home');
  const home = suppliedHome ? resolve(suppliedHome) : tmpdir();

  try {
    const report = await runDistributionEnvironmentProbe({
      cleanup: !Bun.argv.includes('--no-cleanup'),
      home,
    });
    const serialized = `${JSON.stringify(report)}\n`;
    const output = argumentValue('--output');
    if (output) {
      await Bun.write(resolve(output), serialized);
    }
    process.stdout.write(serialized);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message, status: 'failed' })}\n`);
    process.exitCode = 1;
  }
}
