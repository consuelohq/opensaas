import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const exec = promisify(execFile);

export async function grep(
  basePath: string, pattern: string, path?: string,
  options?: { caseSensitive?: boolean; include?: string; maxMatches?: number },
): Promise<string> {
  const args = [pattern, resolve(basePath, path ?? '.'), '--line-number', '--no-heading', '--color=never'];
  if (!options?.caseSensitive) args.push('--ignore-case');
  if (options?.include) args.push('--glob', options.include);
  if (options?.maxMatches) args.push('--max-count', String(options.maxMatches));

  try {
    const { stdout } = await exec('rg', args, { maxBuffer: 5 * 1024 * 1024 });
    return stdout;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 1) return '';
    throw err;
  }
}

export async function glob(
  basePath: string, pattern: string, path?: string,
): Promise<string[]> {
  try {
    const { stdout } = await exec('fd', [pattern, resolve(basePath, path ?? '.'), '--color=never'], { maxBuffer: 5 * 1024 * 1024 });
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
