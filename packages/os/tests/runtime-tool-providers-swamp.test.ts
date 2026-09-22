import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { executeTool } from '../scripts/lib/facade/executor';
import { resolveToolScope } from '../scripts/lib/security-gateway';
import { runToolSearch } from '../scripts/tools-search';

type SearchResult = {
  recommended?: string;
  matches: Array<Record<string, unknown>>;
};

const previousEnv = {
  CONSUELO_HOME: process.env.CONSUELO_HOME,
  CONSUELO_OS_HOME: process.env.CONSUELO_OS_HOME,
  CONSUELO_SWAMP_BIN: process.env.CONSUELO_SWAMP_BIN,
  SWAMP_REPO_DIR: process.env.SWAMP_REPO_DIR,
  SWAMP_FAKE_LOG: process.env.SWAMP_FAKE_LOG,
};

const root = mkdtempSync(path.join(tmpdir(), 'consuelo-swamp-tools-'));
const home = path.join(root, 'home');
const repo = path.join(root, 'repo');
const fakeBin = path.join(root, 'swamp');
const fakeLog = path.join(root, 'swamp.log');

function setSwampEnvironment(input: { home: string; bin: string }): void {
  process.env.CONSUELO_HOME = input.home;
  process.env.CONSUELO_OS_HOME = input.home;
  process.env.CONSUELO_SWAMP_BIN = input.bin;
  process.env.SWAMP_REPO_DIR = repo;
  process.env.SWAMP_FAKE_LOG = fakeLog;
}

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
    else process.env[key as keyof NodeJS.ProcessEnv] = value;
  }
}

beforeAll(() => {
  mkdirSync(repo, { recursive: true });
  writeFileSync(path.join(root, '.keep'), '');
  writeFileSync(path.join(repo, '.swamp.yaml'), 'version: 1\n', { flag: 'w' });
});

beforeAll(() => {
  const script = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const logPath = process.env.SWAMP_FAKE_LOG;
if (logPath) fs.appendFileSync(logPath, JSON.stringify(args) + '\n');

function inputFile() {
  const index = args.indexOf('--input-file');
  if (index === -1) return {};
  return JSON.parse(fs.readFileSync(args[index + 1], 'utf8'));
}

function emit(value) {
  process.stdout.write((typeof value === 'string' ? value : JSON.stringify(value)) + '\n');
}

if (args[0] === '--version') {
  emit('swamp 0.99.0-test');
  process.exit(0);
}

if (args[0] === 'model' && args[1] === 'search') {
  emit({
    query: '',
    results: [{
      id: 'model-cache-warmer',
      name: 'cache-warmer',
      type: 'command/shell',
      methods: [{
        name: 'run',
        description: 'Warm a named cache target',
        arguments: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: {
            target: { type: 'string', minLength: 1, description: 'Cache target' },
            retries: { type: 'integer', minimum: 0 },
          },
          required: ['target'],
          additionalProperties: false,
        },
      }],
    }],
  });
  process.exit(0);
}

if (args[0] === 'workflow' && args[1] === 'search') {
  emit({
    query: '',
    results: [{
      id: 'workflow-deploy-pipeline',
      name: 'deploy-pipeline',
      description: 'Deploy the selected environment',
      jobCount: 1,
      hasInputs: true,
    }],
  });
  process.exit(0);
}

if (args[0] === 'workflow' && args[1] === 'get') {
  emit({
    id: 'workflow-deploy-pipeline',
    name: 'deploy-pipeline',
    description: 'Deploy the selected environment',
    inputs: {
      environment: { type: 'string', enum: ['staging', 'production'] },
    },
    jobs: [],
    version: 1,
  });
  process.exit(0);
}

if (args[0] === 'model' && args[1] === 'method' && args[2] === 'run') {
  emit({
    kind: 'model-run',
    model: args[3],
    method: args[4],
    input: inputFile(),
  });
  process.exit(0);
}

if (args[0] === 'workflow' && args[1] === 'run') {
  emit({
    kind: 'workflow-run',
    workflow: args[2],
    input: inputFile(),
  });
  process.exit(0);
}

process.stderr.write('unexpected fake swamp args: ' + JSON.stringify(args) + '\n');
process.exit(2);
`;
  writeFileSync(fakeBin, script);
  chmodSync(fakeBin, 0o755);
  setSwampEnvironment({ home, bin: fakeBin });
});

afterAll(() => {
  restoreEnvironment();
  rmSync(root, { recursive: true, force: true });
});

describe('Swamp runtime tool provider', () => {
  it('discovers model methods and workflows into the normal search catalog and caches discovery', async () => {
    const model = await runToolSearch({
      query: 'swamp.model.cache-warmer.run',
      includeDocs: false,
      includeEmbeddings: false,
      detail: 'full',
    }) as SearchResult;

    expect(model.recommended).toBe('swamp.model.cache-warmer.run');
    expect(model.matches[0]).toMatchObject({
      name: 'swamp.model.cache-warmer.run',
      category: 'swamp',
    });
    expect(String(model.matches[0].inputSignature)).toContain('target');

    const workflow = await runToolSearch({
      query: 'swamp.workflow.deploy-pipeline.run',
      includeDocs: false,
      includeEmbeddings: false,
      detail: 'full',
    }) as SearchResult;

    expect(workflow.recommended).toBe('swamp.workflow.deploy-pipeline.run');
    expect(String(workflow.matches[0].inputSignature)).toContain('environment');

    const firstDiscoveryCalls = readFileSync(fakeLog, 'utf8').trim().split('\n').length;

    await runToolSearch({
      query: 'swamp.model.cache-warmer.run',
      includeDocs: false,
      includeEmbeddings: false,
    });

    const secondDiscoveryCalls = readFileSync(fakeLog, 'utf8').trim().split('\n').length;
    expect(secondDiscoveryCalls).toBe(firstDiscoveryCalls);
  });

  it('authorizes discovered tools as write-capable while unknown tools remain fail-closed', () => {
    expect(resolveToolScope('swamp.model.cache-warmer.run')).toMatchObject({
      ok: true,
      category: 'write',
      requiredScope: 'tool:swamp.model.cache-warmer.run:write',
    });

    expect(resolveToolScope('swamp.model.missing.run')).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNKNOWN_TOOL_SCOPE' },
    });
  });

  it('validates discovered JSON Schema before execution and passes structured input through --input-file', async () => {
    const invalid = await executeTool('swamp.model.cache-warmer.run', {}, {
      cwd: repo,
      env: { ...process.env },
      logMode: 'silent',
    });
    expect(invalid).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    const model = await executeTool('swamp.model.cache-warmer.run', {
      target: 'users',
      retries: 2,
    }, {
      cwd: repo,
      env: { ...process.env },
      logMode: 'silent',
    });
    expect(model).toMatchObject({
      ok: true,
      code: 'OK',
      data: {
        kind: 'model-run',
        model: 'cache-warmer',
        method: 'run',
        input: { target: 'users', retries: 2 },
      },
    });

    const missingWorkflowInput = await executeTool('swamp.workflow.deploy-pipeline.run', {}, {
      cwd: repo,
      env: { ...process.env },
      logMode: 'silent',
    });
    expect(missingWorkflowInput).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    const invalidWorkflowInput = await executeTool('swamp.workflow.deploy-pipeline.run', {
      environment: 'qa',
    }, {
      cwd: repo,
      env: { ...process.env },
      logMode: 'silent',
    });
    expect(invalidWorkflowInput).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    const workflow = await executeTool('swamp.workflow.deploy-pipeline.run', {
      environment: 'staging',
    }, {
      cwd: repo,
      env: { ...process.env },
      logMode: 'silent',
    });
    expect(workflow).toMatchObject({
      ok: true,
      code: 'OK',
      data: {
        kind: 'workflow-run',
        workflow: 'deploy-pipeline',
        input: { environment: 'staging' },
      },
    });
  });

  it('stays inert when Swamp is not installed', async () => {
    const absentHome = path.join(root, 'absent-home');
    setSwampEnvironment({ home: absentHome, bin: path.join(root, 'missing-swamp') });

    const result = await runToolSearch({
      query: 'swamp.model.cache-warmer.run',
      includeDocs: false,
      includeEmbeddings: false,
    }) as SearchResult;

    expect(result.recommended).toBeUndefined();
    expect(result.matches.some((match) => match.name === 'swamp.model.cache-warmer.run')).toBe(false);

    setSwampEnvironment({ home, bin: fakeBin });
  });
});
