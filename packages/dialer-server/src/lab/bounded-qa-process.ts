import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

// Every nested suite cluster is created inside this child's private TMPDIR.
// PostgreSQL daemonizes, so killing only Bun does not clean those clusters up.
const stopOwnedClusters = async (root: string, env: Record<string, string>) => {
  const directories: string[] = [];
  const scan = async (directory: string, depth: number): Promise<void> => {
    try {
      if (depth > 6) throw new Error('QA temporary-directory depth exceeded');
      const entries = await readdir(directory, { withFileTypes: true });
      if (entries.some((e) => e.name === 'postmaster.pid' && e.isFile()))
        directories.push(directory);
      for (const entry of entries)
        if (entry.isDirectory())
          await scan(join(directory, entry.name), depth + 1);
    } catch (cause: unknown) {
      throw new Error('QA owned-cluster inventory failed', { cause });
    }
  };
  await scan(root, 0);
  if (!directories.length) return 0;
  const config = Bun.spawn(['pg_config', '--bindir'], {
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const bindir = (await new Response(config.stdout).text()).trim();
  if ((await config.exited) !== 0 || !bindir)
    throw new Error('QA cleanup requires pg_config');
  for (const directory of directories) {
    const identity = (
      await readFile(join(directory, 'postmaster.pid'), 'utf8')
    ).split('\n');
    if (resolve(identity[1] ?? '') !== resolve(directory))
      throw new Error('Refuse to stop an unowned PostgreSQL cluster');
    const stop = Bun.spawn(
      [
        join(bindir, 'pg_ctl'),
        '-D',
        directory,
        '-m',
        'immediate',
        '-w',
        '-t',
        '10',
        'stop',
      ],
      { env, stdout: 'ignore', stderr: 'ignore' },
    );
    if (
      (await stop.exited) !== 0 &&
      (await Bun.file(join(directory, 'postmaster.pid')).exists())
    )
      throw new Error('QA owned PostgreSQL cleanup failed');
  }
  return directories.length;
};
export const runBoundedQaProcess = async (
  command: string[],
  env: Record<string, string>,
  timeoutMilliseconds = 90_000,
  cwd?: string,
) => {
  if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1)
    throw new Error('Invalid QA process deadline');
  const root = await mkdtemp(join(tmpdir(), 'consuelo-qa-child-'));
  const childEnv = {
    ...env,
    TMPDIR: root,
    TMP: root,
    TEMP: root,
    LC_ALL: 'C',
    LANG: 'C',
  };
  let cleaned = false;
  try {
    const child = Bun.spawn(command, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: childEnv,
      cwd,
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        timedOut = true;
        child.kill('SIGKILL');
      }
    }, timeoutMilliseconds);
    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      const recoveredPostgres = await stopOwnedClusters(root, childEnv);
      cleaned = true;
      return {
        stdout,
        stderr,
        exitCode: timedOut ? 124 : recoveredPostgres ? 125 : exitCode,
        timedOut,
        recoveredPostgres,
      };
    } catch (cause: unknown) {
      child.kill('SIGKILL');
      await child.exited;
      await stopOwnedClusters(root, childEnv);
      cleaned = true;
      throw new Error('QA child process failed', { cause });
    } finally {
      clearTimeout(timer);
    }
  } catch (cause: unknown) {
    throw new Error(
      'QA child failed; inspect owned temporary directory ' + root,
      { cause },
    );
  } finally {
    if (cleaned) await rm(root, { recursive: true, force: true });
  }
};
