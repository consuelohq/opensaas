import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll } from 'vitest';

export function isolateOsTestEnvironment(
  env: NodeJS.ProcessEnv,
  traceDbPath: string,
): NodeJS.ProcessEnv {
  delete env.TRACE_DB;
  env.CONSUELO_TRACE_DB = traceDbPath;
  return env;
}

const testTraceRoot = mkdtempSync(join(tmpdir(), 'consuelo-os-vitest-traces-'));
isolateOsTestEnvironment(process.env, join(testTraceRoot, 'traces.db'));

afterAll(() => {
  rmSync(testTraceRoot, { recursive: true, force: true });
});
