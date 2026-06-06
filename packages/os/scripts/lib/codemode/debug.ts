import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const LOG_PATH = join(homedir(), '.kiro', 'codemode.log');
const enabled = !!process.env.CODEMODE_DEBUG;

export function debugLog(msg: string): void {
  if (!enabled) return;
  try {
    mkdirSync(join(homedir(), '.kiro'), { recursive: true });
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // silent — debug logging should never break execution
  }
}
