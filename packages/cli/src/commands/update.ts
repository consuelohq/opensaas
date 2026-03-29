import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { log, success, error, info } from '../output.js';
import { captureError } from '../sentry.js';

const CLI_PACKAGE_NAME = '@consuelo/cli';

const getInstalledVersion = (): string => {
  try {
    const pkgPath = require.resolve(`${CLI_PACKAGE_NAME}/package.json`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
};

const getLatestVersion = (): string | null => {
  try {
    const result = execSync(`npm view ${CLI_PACKAGE_NAME} version --json`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const parsed = JSON.parse(result) as string;
    return parsed.trim();
  } catch {
    return null;
  }
};

const isLocalDev = (): boolean => {
  try {
    const cliPath = require.resolve(CLI_PACKAGE_NAME);
    const realPath = fs.realpathSync(cliPath);
    const stat = fs.lstatSync(path.dirname(cliPath));
    if (stat.isSymbolicLink()) return true;
    if (realPath.includes('/packages/cli')) return true;
    if (process.env.CONSUELO_DEV === 'true') return true;
    return false;
  } catch {
    return false;
  }
};

const rebuildLocal = async (): Promise<boolean> => {
  const cliPath = require.resolve(CLI_PACKAGE_NAME);
  const cliDir = path.dirname(cliPath);
  const srcDir = path.resolve(cliDir, '..', 'src');

  if (!fs.existsSync(srcDir)) {
    error('could not find CLI source directory');
    return false;
  }

  info('rebuilding CLI from source...');

  try {
    execSync('npx tsc', {
      cwd: path.resolve(srcDir, '..'),
      stdio: 'pipe',
      timeout: 60000,
    });
    return true;
  } catch (err: unknown) {
    captureError(err, { command: 'update' });
    return false;
  }
};

const updateFromNpm = async (): Promise<boolean> => {
  info('updating CLI from npm...');

  try {
    execSync(`npm install -g ${CLI_PACKAGE_NAME}@latest`, {
      stdio: 'inherit',
      timeout: 120000,
    });
    return true;
  } catch (err: unknown) {
    captureError(err, { command: 'update' });
    return false;
  }
};

export const updateCommand = async (): Promise<void> => {
  try {
  const currentVersion = getInstalledVersion();
  log(`current version: ${currentVersion}`);

  if (isLocalDev()) {
    info('local development mode detected');

    const rebuilt = await rebuildLocal();
    if (rebuilt) {
      success('CLI rebuilt successfully');
    } else {
      error('rebuild failed — check the TypeScript errors above');
      log('run `cd packages/cli && npx tsc` to see full error output');
      process.exit(1);
    }
    return;
  }

  const latestVersion = getLatestVersion();

  if (!latestVersion) {
    error('could not check for updates — npm registry unavailable');
    log('try again later or run: npm install -g @consuelo/cli@latest');
    process.exit(1);
  }

  log(`latest version: ${latestVersion}`);

  if (currentVersion === latestVersion) {
    success('already on the latest version');
    return;
  }

  const updated = await updateFromNpm();

  if (updated) {
    success(`updated to ${latestVersion}`);
    log('run `consuelo --version` to verify');
  } else {
    error('update failed');
    log('try manually: npm install -g @consuelo/cli@latest');
    process.exit(1);
  }
  } catch (err: unknown) {
    captureError(err, { command: 'update' });
    error(err instanceof Error ? err.message : 'unexpected error during update');
    process.exit(1);
  }
};

export const registerUpdate = (program: Command): void => {
  program
    .command('update')
    .description('update the CLI to the latest version')
    .action(async () => {
      try {
        await updateCommand();
      } catch (err: unknown) {
        captureError(err, { command: 'update' });
        process.exit(1);
      }
    });
};
