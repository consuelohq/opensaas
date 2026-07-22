import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execAsync = promisify(exec);

export async function bash(
  basePath: string, command: string, cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: resolve(basePath, cwd ?? '.'),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
      shell: '/bin/bash',
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'stdout' in err) {
      const e = err as { stdout: string; stderr: string; code: number };
      return { stdout: e.stdout, stderr: e.stderr, exitCode: e.code ?? 1 };
    }
    throw err;
  }
}
