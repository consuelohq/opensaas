#!/usr/bin/env bun

import { readFileSync } from 'node:fs';

import {
  acceptManagedComponentUpstream,
  applyReviewedManagedComponentMerge,
  applySafeManagedComponentItems,
  detachManagedComponent,
  inspectManagedComponentConflict,
  keepManagedComponentLocal,
  readManagedComponentState,
  refreshManagedComponentPlan,
  requiredManagedContentBaseRefs,
  restoreManagedComponentDefault,
  type ComponentTree,
} from './lib/managed-components';

type ParsedArgs = {
  command: string | null;
  flags: Map<string, string>;
  switches: Set<string>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = null, ...rest] = argv;
  const flags = new Map<string, string>();
  const switches = new Set<string>();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      switches.add(token);
      continue;
    }
    flags.set(token, next);
    index += 1;
  }
  return { command, flags, switches };
}

function required(args: ParsedArgs, flag: string): string {
  const value = args.flags.get(flag)?.trim();
  if (!value) throw new Error(`${flag} is required`);
  return value;
}


function print(value: unknown, json: boolean): void {
  process.stdout.write(`${JSON.stringify(value, null, json ? 2 : 2)}\n`);
}

function usage(): never {
  process.stderr.write([
    'Usage: bun scripts/managed-components.ts <command> [options]',
    '',
    'Commands:',
    '  inspect-plan --home <path> [--json]',
    '  refresh-plan --home <path> --user-root <path> [--json]',
    '  apply-safe --home <path> --user-root <path> [--json]',
    '  inspect-conflict --home <path> --component <kind:id> [--json]',
    '  accept-upstream --home <path> --user-root <path> --component <kind:id> [--json]',
    '  keep-local --home <path> --user-root <path> --component <kind:id> [--json]',
    '  apply-merge --home <path> --user-root <path> --component <kind:id> --input <tree.json> --expected-local-hash <sha256:...> --expected-upstream-hash <sha256:...> [--json]',
    '  detach --home <path> --component <kind:id> [--json]',
    '  restore-default --home <path> --user-root <path> --component <kind:id> --destination <relative-path> [--json]',
  ].join('\n'));
  process.exit(2);
}

function readTree(path: string): ComponentTree {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('reviewed merge input must be a JSON object of relative paths to UTF-8 text');
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new Error(`reviewed merge content must be text: ${key}`);
  }
  return parsed as ComponentTree;
}

export function runManagedComponentsCli(argv = process.argv.slice(2)): unknown {
  const args = parseArgs(argv);
  if (!args.command || args.switches.has('--help') || args.switches.has('-h')) usage();
  const home = required(args, '--home');

  switch (args.command) {
    case 'inspect-plan': {
      const state = readManagedComponentState(home);
      return {
        ok: true,
        command: args.command,
        plan: state.plan,
        requiredContentBaseRefs: requiredManagedContentBaseRefs(state.provenance, state.plan),
      };
    }
    case 'refresh-plan': {
      const state = refreshManagedComponentPlan({
        home,
        userRoot: required(args, '--user-root'),
      });
      return {
        ok: true,
        command: args.command,
        plan: state.plan,
        requiredContentBaseRefs: requiredManagedContentBaseRefs(state.provenance, state.plan),
      };
    }
    case 'apply-safe': {
      const result = applySafeManagedComponentItems({
        home,
        userRoot: required(args, '--user-root'),
      });
      return { ok: true, command: args.command, ...result };
    }
    case 'inspect-conflict': {
      const component = required(args, '--component');
      return {
        ok: true,
        command: args.command,
        component,
        conflict: inspectManagedComponentConflict(home, component),
      };
    }
    case 'accept-upstream': {
      const component = required(args, '--component');
      acceptManagedComponentUpstream({
        home,
        userRoot: required(args, '--user-root'),
        componentKey: component,
      });
      return { ok: true, command: args.command, component, resolution: 'accepted-upstream' };
    }
    case 'keep-local': {
      const component = required(args, '--component');
      keepManagedComponentLocal({
        home,
        userRoot: required(args, '--user-root'),
        componentKey: component,
      });
      return { ok: true, command: args.command, component, resolution: 'kept-local' };
    }
    case 'apply-merge': {
      const component = required(args, '--component');
      applyReviewedManagedComponentMerge({
        home,
        userRoot: required(args, '--user-root'),
        componentKey: component,
        merged: readTree(required(args, '--input')),
        expectedLocalHash: required(args, '--expected-local-hash'),
        expectedUpstreamHash: required(args, '--expected-upstream-hash'),
      });
      return { ok: true, command: args.command, component, resolution: 'reviewed-merge' };
    }
    case 'detach': {
      const component = required(args, '--component');
      detachManagedComponent({ home, componentKey: component });
      return { ok: true, command: args.command, component, resolution: 'detached' };
    }
    case 'restore-default': {
      const component = required(args, '--component');
      const restoredPath = restoreManagedComponentDefault({
        home,
        userRoot: required(args, '--user-root'),
        componentKey: component,
        destination: required(args, '--destination'),
      });
      return { ok: true, command: args.command, component, restoredPath };
    }
    default:
      throw new Error(`unknown managed component command: ${args.command}`);
  }
}

if (import.meta.main) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = runManagedComponentsCli(process.argv.slice(2));
    print(result, args.switches.has('--json'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const args = parseArgs(process.argv.slice(2));
    print({ ok: false, error: { code: 'MANAGED_COMPONENT_COMMAND_FAILED', message } }, args.switches.has('--json'));
    process.exit(1);
  }
}
