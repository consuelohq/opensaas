import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'cron_jobs';

type JobManifest = {
  schema: 'consuelo.cron.v1';
  name: string;
  kind: 'diff-cockpit';
  enabled: boolean;
  intervalMs: number;
};

async function main(): Promise<void> {
  try {
    const [command = 'help', ...args] = process.argv.slice(2);
    if (command === 'help' || command === '--help') return writeLine(usage());
    if (command === 'provision') return provision(args);
    if (command === 'list') return list();
    if (command === 'watch') return watch(args);
    throw new Error(`unknown cron command: ${command}`);
  } catch (error: unknown) {
    process.stderr.write(error instanceof Error ? `${error.message}\n` : `${String(error)}\n`);
    process.exitCode = 1;
  }
}

export function sanitizeName(input: string): string {
  const value = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!value) throw new Error('cron job name is required');
  return value;
}

export function launchAgentLabel(name: string): string {
  return `com.consuelo.cronjobs.${sanitizeName(name)}`;
}

async function provision(args: string[]): Promise<void> {
  const name = sanitizeName(args[0] || '');
  const dir = path.join(ROOT, name);
  await mkdir(dir, { recursive: true });
  const manifest: JobManifest = {
    schema: 'consuelo.cron.v1',
    name,
    kind: 'diff-cockpit',
    enabled: true,
    intervalMs: Number(readFlag(args, '--interval-ms') || '30000'),
  };
  await writeFile(path.join(dir, 'cron.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(dir, 'README.md'), `# ${name}\n\nLocal Consuelo cron job.\n`);
  writeLine(`provisioned ${name}`);
}

async function list(): Promise<void> {
  const jobs = await discoverJobs();
  if (jobs.length === 0) return writeLine('no cron jobs found');
  for (const job of jobs) writeLine(`${job.name}\t${job.kind}\t${job.intervalMs}ms`);
}

async function watch(args: string[]): Promise<void> {
  const intervalMs = Number(readFlag(args, '--interval-ms') || '30000');
  writeLine(`watching ${ROOT} every ${intervalMs}ms`);
  while (true) {
    await list();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function discoverJobs(root = ROOT): Promise<JobManifest[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const jobs: JobManifest[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, 'cron.json');
    if (!existsSync(file)) continue;
    const job = JSON.parse(await readFile(file, 'utf8')) as JobManifest;
    if (job.enabled) jobs.push(job);
  }
  return jobs.sort((a, b) => a.name.localeCompare(b.name));
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function usage(): string {
  return 'usage: bun run cron -- provision <name> | list | watch';
}

function writeLine(value: string): void {
  process.stdout.write(`${value}\n`);
}

if (import.meta.main) void main();
