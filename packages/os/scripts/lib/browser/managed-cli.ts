import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

/** Resolve a browser CLI without changing PATH or touching existing user browser sessions. */
export function resolveAgentBrowserCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform | string = process.platform,
): string {
  if (env.CONSUELO_AGENT_BROWSER_BIN?.trim()) return env.CONSUELO_AGENT_BROWSER_BIN.trim();
  let home = resolve(env.CONSUELO_HOME || env.CONSUELO_OS_HOME || join(env.HOME || homedir(), '.consuelo'));
  if (basename(home) === 'os' && basename(dirname(home)) === '.consuelo') {
    home = dirname(home);
  }
  const root = join(home, 'managed', 'agent-browser');
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'active.json'), 'utf8')) as {
      schemaVersion?: unknown;
      version?: unknown;
      browserReady?: unknown;
    };
    if (manifest.schemaVersion !== 1 || manifest.browserReady !== true ||
      typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      return 'agent-browser';
    }
    const file = platform === 'win32' ? 'agent-browser.exe' : 'agent-browser';
    const executable = resolve(root, manifest.version, file);
    if (!executable.startsWith(root + sep) || !existsSync(executable)) return 'agent-browser';
    return executable;
  } catch {
    // Legacy global agent-browser installs continue working until OS provisions
    // a validated managed release. No implicit install on a browser command.
    return 'agent-browser';
  }
}
