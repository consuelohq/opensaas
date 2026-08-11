import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeTool, getToolManifestEntry } from '../scripts/lib/facade/executor';
import type { ToolInput, ToolRunner } from '../scripts/lib/facade/types';

function runner(): ToolRunner {
  return async () => ({ stdout: '', stderr: '', exitCode: 0 });
}

function options(cwd: string, env: NodeJS.ProcessEnv) {
  return {
    cwd,
    env,
    runner: runner(),
    branchResolver: ({ explicitBranch }: { explicitBranch?: string }) => ({
      ok: true as const,
      branch: explicitBranch || 'task/workspace-agents/subagent-contract',
      source: explicitBranch ? 'explicit' : 'test',
    }),
    now: () => Date.now(),
    randomUUID: () => 'trc_subagent_contract',
    currentTask: null,
    candidates: [] as Array<{ branch: string; area: string; worktree: string }>,
  };
}

function writeInstruction(root: string, content = 'Return a short success message.'): string {
  const instructionPath = join(root, 'instructions.md');
  writeFileSync(instructionPath, content);
  return instructionPath;
}

function writeFakeCodex(root: string): { executable: string; argsPath: string; spawnPath: string; promptPath: string } {
  const binDir = join(root, 'bin');
  mkdirSync(binDir, { recursive: true });
  const executable = join(binDir, 'codex');
  const argsPath = join(root, 'codex-args.log');
  const spawnPath = join(root, 'codex-spawns.log');
  const promptPath = join(root, 'codex-prompt.md');
  writeFileSync(executable, [
    '#!/bin/sh',
    'if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then',
    '  printf "%s\\n" "Usage: codex exec [OPTIONS] [PROMPT]" "instructions are read from stdin" "--cd <DIR>" "--sandbox <SANDBOX_MODE>" "--json" "-m, --model <MODEL>" "-c, --config <key=value>"',
    '  exit 0',
    'fi',
    'for arg in "$@"; do printf "%s\\n" "$arg" >> "$CODEX_ARGS_PATH"; done',
    'printf "%s\\n" spawn >> "$CODEX_SPAWN_PATH"',
    'cat > "$CODEX_PROMPT_PATH"',
    'if [ -n "$CODEX_SLEEP" ]; then sleep "$CODEX_SLEEP"; fi',
    'printf "%s\\n" \'{"type":"item.completed","item":{"type":"agent_message","text":"fake complete"}}\'',
    'printf "%s\\n" \'{"type":"turn.completed","usage":{"input_tokens":11,"cached_input_tokens":2,"output_tokens":3,"reasoning_output_tokens":4}}\'',
    '',
  ].join('\n'));
  chmodSync(executable, 0o700);
  return { executable, argsPath, spawnPath, promptPath };
}

function input(overrides: ToolInput): ToolInput {
  return { provider: 'codex', policy: 'read', ...overrides };
}

describe('subagent orchestration contract', () => {
  it('passes the requested Codex model and reasoning effort as exact argv', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    try {
      const fake = writeFakeCodex(durableHome);
      const instructionPath = writeInstruction(worktree);
      const result = await executeTool('subagent', input({
        model: 'gpt-5.6-luna',
        reasoningEffort: 'xhigh',
        instructionPath,
      }), options(worktree, {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
        PATH: process.env.PATH || '',
      }));

      expect(result.ok).toBe(true);
      expect(result.data.command).toEqual(expect.arrayContaining([
        '--model',
        'gpt-5.6-luna',
        '-c',
        'model_reasoning_effort="xhigh"',
      ]));
    } finally {
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('allows edit-mode self-bootstrap and makes task lifecycle boundaries explicit', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    try {
      const fake = writeFakeCodex(durableHome);
      const instructionPath = writeInstruction(worktree, 'Start the repository task and implement the requested repair.');
      const result = await executeTool('subagent', input({
        policy: 'edit',
        instructionPath,
      }), options(worktree, {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
      }));

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(readFileSync(fake.promptPath, 'utf8')).toContain('task.start');
      expect(readFileSync(fake.promptPath, 'utf8')).toContain('task.pr merges');
    } finally {
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('stages canonical OS tmp instructions into the durable run directory', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    const handoffDir = join(tmpdir(), 'opensaas-handoffs', `os-subagent-${Date.now()}`);
    const source = join(handoffDir, 'instructions.md');
    try {
      const fake = writeFakeCodex(durableHome);
      mkdirSync(handoffDir, { recursive: true });
      writeFileSync(source, 'Use task.start before any scoped repository mutation.');
      const result = await executeTool('subagent', input({
        instructionPath: source,
      }), options(worktree, {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
      }));

      expect(result.ok).toBe(true);
      expect(result.data.instructionPath).not.toBe(source);
      expect(result.data.instructionPath).toContain(join(durableHome, 'node', 'runs'));
      expect(existsSync(`${result.data.instructionPath}.provenance.json`)).toBe(true);
    } finally {
      rmSync(handoffDir, { recursive: true, force: true });
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('makes start idempotent and lets status, wait, and logs attach without spawning', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    try {
      const fake = writeFakeCodex(durableHome);
      const instructionPath = writeInstruction(worktree);
      const env = {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
        CODEX_SLEEP: '0.1',
      };
      const startInput = input({ action: 'start', instructionPath, requestId: 'req_subagent_once' });
      const started = await executeTool('subagent', startInput, options(worktree, env));
      expect(started.ok).toBe(true);
      expect(started.data.status).toBe('running');
      expect(started.data.runId).toMatch(/^run_/);

      const retried = await executeTool('subagent', startInput, options(worktree, env));
      expect(retried.data.runId).toBe(started.data.runId);

      const status = await executeTool('subagent', { action: 'status', runId: started.data.runId }, options(durableHome, env));
      expect(status.data.runId).toBe(started.data.runId);
      const waited = await executeTool('subagent', { action: 'wait', runId: started.data.runId, waitMs: 2_000 }, options(durableHome, env));
      expect(waited.data.status).toBe('completed');
      const logs = await executeTool('subagent', { action: 'logs', runId: started.data.runId }, options(durableHome, env));
      expect(logs.data.runId).toBe(started.data.runId);
      expect(logs.data.finalMessage).toBe('fake complete');
      expect(readFileSync(fake.spawnPath, 'utf8').trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('rejects changed instruction content for the same requestId without overwriting the winning run', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    try {
      const fake = writeFakeCodex(durableHome);
      const instructionPath = writeInstruction(worktree, 'winner instruction');
      const env = {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
        CODEX_SLEEP: '0.2',
      };
      const requestId = 'req_subagent_instruction_conflict';
      const started = await executeTool('subagent', input({ action: 'start', instructionPath, requestId }), options(worktree, env));
      expect(started.ok).toBe(true);
      expect(started.data.runId).toMatch(/^run_/);
      const persistedInstructionPath = started.data.instructionPath;
      expect(readFileSync(persistedInstructionPath, 'utf8')).toBe('winner instruction');

      writeFileSync(instructionPath, 'conflicting retry instruction');
      const retried = await executeTool('subagent', input({ action: 'start', instructionPath, requestId }), options(worktree, env));

      expect(retried.ok).toBe(false);
      expect(retried.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(retried.data.runId).toBe(started.data.runId);
      expect(readFileSync(persistedInstructionPath, 'utf8')).toBe('winner instruction');
      const spawnDeadline = Date.now() + 1_000;
      while (!existsSync(fake.spawnPath) && Date.now() < spawnDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(existsSync(fake.spawnPath)).toBe(true);
      expect(readFileSync(fake.spawnPath, 'utf8').trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('reports bounded waits and completion-unknown states without losing the run identity', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    try {
      const fake = writeFakeCodex(durableHome);
      const instructionPath = writeInstruction(worktree);
      const env = {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
        CODEX_SLEEP: '2',
      };
      const started = await executeTool('subagent', input({ action: 'start', instructionPath, requestId: 'req_subagent_timeout' }), options(worktree, env));
      const waited = await executeTool('subagent', { action: 'wait', runId: started.data.runId, waitMs: 10 }, options(durableHome, env));
      expect(waited.data.runId).toBe(started.data.runId);
      expect(['running', 'completion_unknown']).toContain(waited.data.status);
      expect(waited.code).toBe('WAIT_TIMEOUT');

      const cancelled = await executeTool('subagent', { action: 'cancel', runId: started.data.runId }, options(durableHome, env));
      expect(cancelled.data.runId).toBe(started.data.runId);
      expect(cancelled.data.status).toBe('cancelled');
    } finally {
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('returns an explicit capability outcome for strict workspace-only on Codex', async () => {
    const durableHome = mkdtempSync(join(tmpdir(), 'os-subagent-home-'));
    const worktree = mkdtempSync(join(tmpdir(), 'os-subagent-worktree-'));
    try {
      const fake = writeFakeCodex(durableHome);
      const result = await executeTool('subagent', input({
        workspaceOnly: 'strict',
        instructionPath: writeInstruction(worktree),
      }), options(worktree, {
        ...process.env,
        CONSUELO_HOME: durableHome,
        WORKSPACE_SUBAGENT_CODEX_BIN: fake.executable,
        CODEX_ARGS_PATH: fake.argsPath,
        CODEX_SPAWN_PATH: fake.spawnPath,
        CODEX_PROMPT_PATH: fake.promptPath,
      }));

      expect(result.ok).toBe(true);
      expect(result.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(result.data.status).toBe('not_supported');
      expect(result.data.capabilities.strictWorkspaceOnly).toBe(false);
      expect(result.data.unsupportedCapabilities).toContain('strictWorkspaceOnly');

      const piReasoning = await executeTool('subagent', input({
        provider: 'pi',
        reasoningEffort: 'xhigh',
        instructionPath: writeInstruction(worktree),
      }), options(worktree, {
        ...process.env,
        CONSUELO_HOME: durableHome,
      }));
      expect(piReasoning.ok).toBe(true);
      expect(piReasoning.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(piReasoning.data.status).toBe('not_supported');
      expect(piReasoning.data.capabilities.reasoningEffort).toBe(false);
      expect(piReasoning.data.unsupportedCapabilities).toContain('reasoningEffort');
    } finally {
      rmSync(durableHome, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it('documents attach-only lifecycle and merge-sensitive task boundaries', () => {
    const description = getToolManifestEntry('subagent')?.description || '';
    expect(description).toContain('task.push publishes only the task branch');
    expect(description).toContain('task.pr merges to the stream');
    expect(description).toContain('status/wait/logs attach');
    expect(description).toContain('never spawn');
    expect(description).toContain('requestId');
  });
});
