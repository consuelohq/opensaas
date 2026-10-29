import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export type ConsueloReleasePlan = { docs: boolean; website: boolean; os: boolean };
const emptyPlan = (): ConsueloReleasePlan => ({ docs: false, website: false, os: false });
const crossCutting = new Set(['package.json', 'bun.lock', 'bunfig.toml', '.bun-version', 'nx.json']);

export function createConsueloReleasePlan(input: { eventName: string; target?: string; files: string[] }): ConsueloReleasePlan {
  const plan = emptyPlan();
  // Public content must not rotate the deployed auth/runtime surface as a side effect.
  if (input.eventName === 'workflow_dispatch') {
    const target = input.target === 'os-device-auth' ? 'os' : input.target;
    if (target === 'all') return { docs: true, website: true, os: true };
    if (target === 'dialer') return plan;
    if (target !== 'docs' && target !== 'website' && target !== 'os') {
      throw new Error('Unknown production release target');
    }
    plan[target] = true;
    return plan;
  }
  if (input.eventName !== 'push') throw new Error('Unsupported production release event');
  for (const file of input.files) {
    if (crossCutting.has(file) || /^tsconfig[^/]*\.json$/.test(file)) {
      return { docs: true, website: true, os: true };
    }
    if (file.startsWith('packages/documentation/') || file.startsWith('packages/dialer-documentation/')) plan.docs = true;
    if (file.startsWith('packages/consuelo-website/') || file.startsWith('packages/dialer-website/')) plan.website = true;
    if ((file.startsWith('packages/os/') && !file.startsWith('packages/os/tests/')
      && file !== 'packages/os/scripts/production-release-plan.ts')
      || file.startsWith('packages/cli/')
      || (file.startsWith('packages/workspace/') && !file.startsWith('packages/workspace/tests/')
        && !file.startsWith('packages/workspace/test-selection.'))) plan.os = true;

  }
  return plan;
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Cannot resolve production release changes');
  return result.stdout;
}

function main(): void {
  const eventName = process.env.CONSUELO_RELEASE_EVENT ?? '';
  let files: string[] = [];
  if (eventName === 'push') {
    const head = process.env.CONSUELO_RELEASE_HEAD ?? '';
    let before = process.env.CONSUELO_RELEASE_BEFORE ?? '';
    if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Invalid production release head');
    if (!before || /^0+$/.test(before)) before = git(['rev-parse', `${head}^`]).trim();
    if (!/^[a-f0-9]{40}$/.test(before)) throw new Error('Invalid production release base');
    files = git(['diff', '--name-only', '-z', '--no-renames', before, head]).split('\0').filter(Boolean);
  }
  const plan = createConsueloReleasePlan({ eventName, target: process.env.CONSUELO_RELEASE_TARGET, files });
  const output = process.env.GITHUB_OUTPUT;
  if (output) appendFileSync(output, `docs=${plan.docs}\nwebsite=${plan.website}\nos=${plan.os}\n`);
  process.stdout.write(`${JSON.stringify({ files, plan })}\n`);
}

if (import.meta.main) {
  try { main(); } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Production release planning failed'}\n`);
    process.exit(1);
  }
}
