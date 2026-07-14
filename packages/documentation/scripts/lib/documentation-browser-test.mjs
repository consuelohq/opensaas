import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const astroCli = fileURLToPath(new URL('../../node_modules/astro/bin/astro.mjs', import.meta.url));
const playwrightCli = fileURLToPath(new URL('../../node_modules/playwright/cli.js', import.meta.url));
const nodeExecutable = process.env.NODE_BINARY ?? 'node';

function ensureChromiumInstalled() {
  if (existsSync(chromium.executablePath())) return;

  const installArgs = ['install', 'chromium'];
  const install = spawnSync(nodeExecutable, [playwrightCli, ...installArgs], {
    cwd: packageRoot,
    stdio: 'inherit',
  });
  if (install.status !== 0 || !existsSync(chromium.executablePath())) {
    throw new Error(`Unable to install the Playwright Chromium browser (exit ${install.status ?? 'unknown'}).`);
  }
}

export async function launchDocumentationBrowser() {
  ensureChromiumInstalled();
  return chromium.launch({ headless: true });
}

export function startDocumentationServer({ port, force = false }) {
  const args = [astroCli, 'dev'];
  if (force) args.push('--force');
  args.push('--host', '127.0.0.1', '--port', String(port));
  return spawn(nodeExecutable, args, {
    cwd: packageRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
}

function waitForExit(server, timeoutMs) {
  if (server.exitCode !== null || server.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      server.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    server.once('exit', onExit);
  });
}

function isMissingProcess(error) {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH';
}

export async function stopDocumentationServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;

  try {
    if (process.platform !== 'win32' && server.pid) process.kill(-server.pid, 'SIGTERM');
    else server.kill('SIGTERM');
  } catch (error) {
    if (!isMissingProcess(error)) throw error;
  }

  if (await waitForExit(server, 3000)) return;

  try {
    if (process.platform !== 'win32' && server.pid) process.kill(-server.pid, 'SIGKILL');
    else server.kill('SIGKILL');
  } catch (error) {
    if (!isMissingProcess(error)) throw error;
  }
  await waitForExit(server, 3000);
}
