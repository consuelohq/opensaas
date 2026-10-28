import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BrowserConfig } from './types';

export function resolveBrowserConfig(env: NodeJS.ProcessEnv = process.env): BrowserConfig {
  return {
    profilePath: env.AGENT_BROWSER_PROFILE || join(homedir(), '.agent-browser-ko'),
    screenshotDir: env.AGENT_SCREENSHOT_DIR || join(tmpdir(), 'opensaas-screenshots'),
    defaultTimeoutMs: 30_000,
  };
}
