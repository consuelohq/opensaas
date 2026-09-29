#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

type SmokeSummary = {
  swampVersion: string;
  modelTool: string;
  workflowTool: string;
  modelScope: string;
  workflowScope: string;
  missingInputRejected: boolean;
  modelStatus: string;
  workflowStatus: string;
  workflowJobStatus: string;
  workflowStepStatus: string;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string {
  return isObject(value) && typeof value[key] === 'string' ? value[key] : '';
}

function firstMatch(search: JsonObject): JsonObject {
  const matches = search.matches;
  return Array.isArray(matches) && isObject(matches[0]) ? matches[0] : {};
}

function usage(): never {
  throw new Error('usage: bun .github/scripts/consuelo-swamp-compat.ts --swamp-bin <path>');
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): string {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(
      [
        'command failed: ' + [command, ...args].join(' '),
        stderr,
        stdout,
      ].filter(Boolean).join('\n'),
    );
  }
  return (result.stdout || '').trim();
}

function smokeWorkflowYaml(): string {
  const expression = '$' + '{{ inputs.message }}';
  return [
    'id: 488edee0-e978-4d13-ba67-be3be16929d3',
    'name: smoke-flow',
    'tags: {}',
    'inputs:',
    '  message:',
    '    type: string',
    '    description: Message to echo',
    'jobs:',
    '  - name: main',
    '    description: Echo the workflow input',
    '    steps:',
    '      - name: echo',
    '        description: Echo through the command shell model',
    '        task:',
    '          type: model_method',
    '          modelIdOrName: echoer',
    '          methodName: execute',
    '          inputs:',
    '            run: echo "' + expression + '"',
    '        dependsOn: []',
    '        weight: 0',
    '        allowFailure: false',
    '    dependsOn: []',
    '    weight: 0',
    'version: 1',
    '',
  ].join('\n');
}

export async function runSwampCompatibilitySmoke(swampBinary: string): Promise<SmokeSummary> {
  const cliPath = path.resolve(swampBinary);
  if (!fs.existsSync(cliPath)) {
    throw new Error('Swamp binary not found: ' + cliPath);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-swamp-compat-'));
  const repoDir = path.join(tempRoot, 'fixture');
  const consueloHome = path.join(tempRoot, 'consuelo-home');
  const swampHome = path.join(tempRoot, 'swamp-home');
  const xdgHome = path.join(tempRoot, 'xdg');
  const providerEnv: NodeJS.ProcessEnv = {
    ...process.env,
    SWAMP_HOME: swampHome,
    SWAMP_NO_TELEMETRY: '1',
    XDG_CONFIG_HOME: xdgHome,
  };

  try {
    fs.mkdirSync(consueloHome, { recursive: true });
    fs.mkdirSync(swampHome, { recursive: true });
    fs.mkdirSync(xdgHome, { recursive: true });

    const swampVersion = runCommand(cliPath, ['--version'], {
      cwd: tempRoot,
      env: providerEnv,
    });

    runCommand(cliPath, [
      'repo',
      'init',
      'fixture',
      '--tool',
      'none',
      '--no-telemetry',
      '--json',
    ], {
      cwd: tempRoot,
      env: providerEnv,
    });

    runCommand(cliPath, [
      'model',
      'create',
      'command/shell',
      'echoer',
      '--repo-dir',
      repoDir,
      '--no-telemetry',
      '--json',
    ], {
      cwd: tempRoot,
      env: providerEnv,
    });

    fs.writeFileSync(
      path.join(repoDir, 'workflows', 'workflow-smoke-flow.yaml'),
      smokeWorkflowYaml(),
      'utf8',
    );

    Object.assign(process.env, providerEnv, {
      CONSUELO_HOME: consueloHome,
      CONSUELO_OS_HOME: consueloHome,
      CONSUELO_SWAMP_BIN: cliPath,
      CONSUELO_TOOL_CALLER_CWD: repoDir,
      SWAMP_REPO_DIR: repoDir,
    });

    const { runToolSearch } = await import('../../packages/os/scripts/tools-search');
    const { executeTool } = await import('../../packages/os/scripts/lib/facade/executor');
    const { resolveToolScope } = await import('../../packages/os/scripts/lib/security-gateway');

    const modelSearch = await runToolSearch({
      query: 'swamp.model.echoer.execute',
      includeDocs: false,
      includeEmbeddings: false,
      detail: 'full',
    });
    const workflowSearch = await runToolSearch({
      query: 'swamp.workflow.smoke-flow.run',
      includeDocs: false,
      includeEmbeddings: false,
      detail: 'full',
    });

    const modelMatch = firstMatch(modelSearch);
    const workflowMatch = firstMatch(workflowSearch);
    const modelTool = stringField(modelMatch, 'name');
    const workflowTool = stringField(workflowMatch, 'name');
    const modelSignature = stringField(modelMatch, 'inputSignature');
    const workflowSignature = stringField(workflowMatch, 'inputSignature');

    if (modelSearch.recommended !== 'swamp.model.echoer.execute'
      || modelTool !== 'swamp.model.echoer.execute'
      || !modelSignature.includes('run')) {
      throw new Error('Consuelo did not discover the expected real Swamp model method.');
    }
    if (workflowSearch.recommended !== 'swamp.workflow.smoke-flow.run'
      || workflowTool !== 'swamp.workflow.smoke-flow.run'
      || !workflowSignature.includes('message')) {
      throw new Error('Consuelo did not discover the expected real Swamp workflow.');
    }

    const modelScope = resolveToolScope('swamp.model.echoer.execute');
    const workflowScope = resolveToolScope('swamp.workflow.smoke-flow.run');
    if (!modelScope.ok || modelScope.requiredScope !== 'tool:swamp.model.echoer.execute:write') {
      throw new Error('Consuelo did not authorize the real Swamp model method as a write tool.');
    }
    if (!workflowScope.ok || workflowScope.requiredScope !== 'tool:swamp.workflow.smoke-flow.run:write') {
      throw new Error('Consuelo did not authorize the real Swamp workflow as a write tool.');
    }

    const executionOptions = {
      cwd: repoDir,
      env: { ...process.env },
      logMode: 'silent' as const,
    };

    const missing = await executeTool('swamp.workflow.smoke-flow.run', {}, executionOptions);
    if (missing.ok || missing.code !== 'VALIDATION_ERROR') {
      throw new Error('Consuelo did not reject a missing required Swamp workflow input.');
    }

    const model = await executeTool('swamp.model.echoer.execute', {
      run: "printf 'consuelo-real-model-smoke'",
    }, executionOptions);
    const workflow = await executeTool('swamp.workflow.smoke-flow.run', {
      message: 'consuelo-real-workflow-smoke',
    }, executionOptions);

    const modelData = isObject(model.data) ? model.data : {};
    const workflowData = isObject(workflow.data) ? workflow.data : {};
    const jobs = Array.isArray(workflowData.jobs) ? workflowData.jobs : [];
    const firstJob = isObject(jobs[0]) ? jobs[0] : {};
    const steps = Array.isArray(firstJob.steps) ? firstJob.steps : [];
    const firstStep = isObject(steps[0]) ? steps[0] : {};

    const modelStatus = stringField(modelData, 'status');
    const workflowStatus = stringField(workflowData, 'status');
    const workflowJobStatus = stringField(firstJob, 'status');
    const workflowStepStatus = stringField(firstStep, 'status');

    if (!model.ok || modelStatus !== 'succeeded') {
      throw new Error('Real Swamp model execution through Consuelo did not succeed.');
    }
    if (!workflow.ok
      || workflowStatus !== 'succeeded'
      || workflowJobStatus !== 'succeeded'
      || workflowStepStatus !== 'succeeded') {
      throw new Error('Real Swamp workflow execution through Consuelo did not succeed.');
    }

    return {
      swampVersion,
      modelTool,
      workflowTool,
      modelScope: modelScope.requiredScope,
      workflowScope: workflowScope.requiredScope,
      missingInputRejected: true,
      modelStatus,
      workflowStatus,
      workflowJobStatus,
      workflowStepStatus,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const swampBinary = argValue('--swamp-bin') ?? usage();
    const summary = await runSwampCompatibilitySmoke(swampBinary);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(message + '\n');
    process.exit(1);
  }
}
