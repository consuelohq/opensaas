import { describe, expect, it } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const repoRoot = join(import.meta.dir, '..', '..', '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(repoRoot, ...parts), 'utf8');

describe('dialer GitHub release workflow contract', () => {
  it('executes the full release Worker upload, deployment and manifest capture with the intended argv', () => {
    const release = read(
      '.github',
      'workflows',
      'consuelo-production-release.yaml',
    );
    const scriptFor = (name: string) => {
      const step = release
        .split(`      - name: ${name}\n`)[1]
        ?.split('\n      - name:')[0];
      const script = step
        ?.split('        run: |\n')[1]
        ?.split('\n')
        .map((line) => line.replace(/^ {10}/, ''))
        .join('\n');
      if (!script) throw new Error(`Missing executable step: ${name}`);
      return script;
    };
    const temp = mkdtempSync(join(tmpdir(), 'dialer-worker-release-'));
    try {
      const bin = join(temp, 'bin');
      mkdirSync(bin);
      const log = join(temp, 'argv');
      writeFileSync(
        join(bin, 'bunx'),
        `#!/bin/bash\nset -eu\nprintf '%s\\n' BEGIN "$@" END >> "$ARGV_LOG"\nfor arg in "$@"; do [ "$arg" != + ] || exit 42; done\nif [ "${'${2:-}'}" = deployments ]; then\n  printf '%s\\n' "$CF_FIXTURE"\nfi\n`,
        { mode: 0o755 },
      );
      const validDeployment = [
        {
          annotations: { 'workers/message': 'Dialer source abc123' },
          versions: [{ version_id: 'version-fixture', percentage: 100 }],
        },
      ];
      const env = {
        PATH: `${bin}:${process.env.PATH}`,
        ARGV_LOG: log,
        RUNNER_TEMP: temp,
        GITHUB_SHA: 'abc123',
        CF_FIXTURE: JSON.stringify(validDeployment),
      };
      for (const name of [
        'Deploy LeadConnector worker',
        'Capture LeadConnector worker version',
      ]) {
        const result = Bun.spawnSync(['bash', '-c', scriptFor(name)], { env });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
      }
      expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
        'BEGIN',
        'wrangler@4.135.0',
        'versions',
        'upload',
        '--config',
        'packages/lead-connector/wrangler.jsonc',
        '--keep-vars',
        '--tag',
        'dialer-abc123',
        '--message',
        'Dialer source abc123',
        'END',
        'BEGIN',
        'wrangler@4.135.0',
        'versions',
        'deploy',
        '--config',
        'packages/lead-connector/wrangler.jsonc',
        '--version-tag',
        'dialer-abc123',
        '--message',
        'Dialer source abc123',
        '--yes',
        'END',
        'BEGIN',
        'wrangler@4.135.0',
        'deployments',
        'list',
        '--config',
        'packages/lead-connector/wrangler.jsonc',
        '--json',
        'END',
      ]);
      expect(
        JSON.parse(
          readFileSync(join(temp, 'cloudflare-deployment.json'), 'utf8'),
        ),
      ).toEqual({
        workerName: 'consuelo-lead-connector-embed',
        versionId: 'version-fixture',
        targets: ['https://calls.consuelohq.com'],
      });
      for (const invalid of [
        [
          {
            annotations: { 'workers/message': 'Dialer source stale' },
            versions: [{ version_id: 'version-fixture', percentage: 100 }],
          },
        ],
        [
          {
            annotations: { 'workers/message': 'Dialer source abc123' },
            versions: [{ version_id: 'version-fixture', percentage: 50 }],
          },
        ],
        [
          {
            annotations: { 'workers/message': 'Dialer source abc123' },
            versions: [],
          },
        ],
      ]) {
        rmSync(join(temp, 'cloudflare-deployment.json'));
        const result = Bun.spawnSync(
          ['bash', '-c', scriptFor('Capture LeadConnector worker version')],
          {
            env: { ...env, CF_FIXTURE: JSON.stringify(invalid) },
          },
        );
        expect(result.exitCode).not.toBe(0);
        expect(() =>
          readFileSync(join(temp, 'cloudflare-deployment.json')),
        ).toThrow();
        // Provide an empty placeholder for the next iteration; no stale manifest survives.
        writeFileSync(join(temp, 'cloudflare-deployment.json'), '');
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('classifies the complete deployed dialer surface and validates all three packages', () => {
    const ci = read('.github', 'workflows', 'consuelo-ci.yaml');
    const planner = read('packages', 'os', 'scripts', 'ci-plan.ts');
    expect(planner).toContain("file.startsWith('packages/dialer-server/')");
    expect(planner).toContain("file.startsWith('packages/lead-connector/')");
    expect(planner).toContain("file.startsWith('packages/contacts/')");
    expect(planner).toContain("file.startsWith('packages/logger/')");
    expect(ci).toContain('bun test packages/dialer/src');
    expect(ci).toContain('bun test packages/dialer-server/src');
    expect(ci).toContain('bun test packages/lead-connector/src');
    expect(ci).toContain('bun run --cwd packages/dialer typecheck');
    expect(ci).toContain('bun run --cwd packages/dialer-server typecheck');
    expect(ci).toContain('bun run --cwd packages/lead-connector typecheck');
    expect(ci).toContain('bun run --cwd packages/dialer-server build');
    expect(ci).toContain('bun run --cwd packages/lead-connector build');
    expect(ci).toContain('docker build');
    expect(ci).toContain('--file packages/dialer-server/Dockerfile');
    expect(ci).toContain('bun run --cwd packages/logger build');
    expect(ci.indexOf('bun run --cwd packages/logger build')).toBeLessThan(
      ci.indexOf('bun run --cwd packages/dialer typecheck'),
    );
  });

  it('builds clean Railway workspace dependencies in package order', () => {
    const dockerfile = read('packages', 'dialer-server', 'Dockerfile');
    const railway = read('packages', 'dialer-server', 'railway.json');
    expect(dockerfile).toContain('FROM oven/bun:1.3.14 AS dependencies');
    expect(dockerfile).toContain(
      'RUN bun install --frozen-lockfile --ignore-scripts',
    );
    expect(dockerfile).not.toContain('yarn install');
    const builds = [
      'bun run --cwd packages/logger build',
      'bun run --cwd packages/contacts build',
      'bun run --cwd packages/dialer build',
      'bun run --cwd packages/lead-connector build',
      'bun run --cwd packages/dialer-server build',
    ];
    let cursor = -1;
    for (const command of builds) {
      const next = dockerfile.indexOf(command);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(railway).toContain('packages/logger/**');
    expect(railway).toContain('packages/contacts/**');
    expect(railway).toContain('packages/conversation/**');
  });

  it('releases dialer changes from main in fail-closed provider order with deployment-only secrets', () => {
    const release = read(
      '.github',
      'workflows',
      'consuelo-production-release.yaml',
    );
    expect(release).toContain('- dialer');
    expect(release).toContain('environment: consuelo dialer / production');
    expect(release).toContain(
      'packages/(dialer|dialer-server|lead-connector|logger|contacts|conversation)/',
    );
    expect(release).toContain('bun run --cwd packages/logger build');
    expect(release.indexOf('bun run --cwd packages/logger build')).toBeLessThan(
      release.indexOf('bun run --cwd packages/dialer typecheck'),
    );
    const sourceValidation =
      release
        .split('      - name: Validate dialer release source\n')[1]
        ?.split('\n      - name:')[0] ?? '';
    const conversationBuild = sourceValidation.indexOf(
      'bun run --cwd packages/conversation build',
    );
    expect(conversationBuild).toBeGreaterThan(-1);
    expect(conversationBuild).toBeLessThan(
      sourceValidation.indexOf('bun test packages/dialer-server/src'),
    );
    expect(conversationBuild).toBeLessThan(
      sourceValidation.indexOf(
        'bun run --cwd packages/dialer-server typecheck',
      ),
    );
    const steps = [
      'Verify approved Marketplace bootstrap source',
      'Deploy dialer server to Railway',
      'Run safe dialer production smoke',
      'Deploy LeadConnector worker',
      'Verify LeadConnector worker',
      'Write dialer release manifest',
    ];
    let cursor = -1;
    for (const step of steps) {
      const next = release.indexOf(step);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(release).toContain('RAILWAY_DIALER_PROJECT_TOKEN');
    expect(release).not.toContain('Link Railway release target');
    expect(release).not.toContain('@railway/cli@5.27.2 link');
    expect(release).toContain('Configure dialer edge identity secret');
    expect(release).toContain('DIALER_EDGE_PROXY_SECRET');
    expect(release).toContain('CLOUDFLARE_DIALER_WORKER_API_TOKEN');
    expect(release).toContain(
      'consuelo-lead-connector-click-to-call.marketplace-loader.html',
    );
    expect(release).toContain('verify-marketplace-bootstrap.ts');
    expect(release).toContain('LEADCONNECTOR_MARKETPLACE_BOOTSTRAP_SHA256');
    expect(release).toContain('--launcher-bootstrap');
    expect(release).not.toContain('Reconcile GoHighLevel Custom Menu');
    expect(release).not.toContain('configure-production-menu.ts');
    expect(release).not.toContain(
      'LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN',
    );
    expect(release).not.toContain('LEADCONNECTOR_PRODUCTION_CUSTOM_MENU_ID');
    expect(release).not.toContain('LEADCONNECTOR_PRODUCTION_LOCATION_ID');
    expect(release).not.toMatch(
      /STRIPE_SECRET_KEY|TWILIO_AUTH_TOKEN|GROQ_API_KEY|DATABASE_URL|REDIS_URL/,
    );
  });

  it('rejects short trimmed edge secrets before deployment without exposing them', () => {
    const release = read(
      '.github',
      'workflows',
      'consuelo-production-release.yaml',
    );
    const step = release
      .split('      - name: Validate dialer deployment configuration\n')[1]
      ?.split('\n      - name:')[0];
    const script = step
      ?.split('        run: |\n')[1]
      ?.split('\n')
      .map((line) => line.replace(/^ {10}/, ''))
      .join('\n');
    expect(script).toBeDefined();
    if (!script) throw new Error('Missing dialer deployment preflight');

    const cases = [
      { secret: '', valid: false },
      { secret: '   ', valid: false },
      { secret: 's'.repeat(23), valid: false },
      { secret: '  ' + 's'.repeat(23) + '  ', valid: false },
      { secret: '\u2003' + 's'.repeat(23) + '\u2003', valid: false },
      { secret: 's'.repeat(24), valid: true },
      { secret: ' \t' + 's'.repeat(24) + '\n ', valid: true },
    ];
    for (const { secret, valid } of cases) {
      const result = Bun.spawnSync(['bash', '-c', script], {
        env: {
          PATH: process.env.PATH,
          RAILWAY_TOKEN: 'project-token-fixture',
          RAILWAY_DIALER_PROJECT_ID: 'project-fixture',
          RAILWAY_DIALER_ENVIRONMENT_ID: 'environment-fixture',
          RAILWAY_DIALER_SERVICE_ID: 'service-fixture',
          RAILWAY_DIALER_PUBLIC_ORIGIN: 'https://dialer.example',
          CLOUDFLARE_ACCOUNT_ID: 'cloudflare-fixture',
          CLOUDFLARE_API_TOKEN: 'edge-token-fixture',
          DIALER_EDGE_PROXY_SECRET: secret,
          LEADCONNECTOR_MARKETPLACE_BOOTSTRAP_SHA256: 'a'.repeat(64),
          LEADCONNECTOR_PRODUCTION_EMBED_URL: 'https://calls.example',
        },
      });
      expect(
        result.exitCode === 0,
        'trimmed length ' + secret.trim().length,
      ).toBe(valid);
      if (secret.trim()) {
        expect(
          result.stdout.toString() + result.stderr.toString(),
        ).not.toContain(secret.trim());
      }
    }
    expect(
      release.indexOf('Validate dialer deployment configuration'),
    ).toBeLessThan(release.indexOf('Configure dialer edge identity secret'));
  });

  it('provides explicit-id manual rollback and never guesses a previous release', () => {
    const rollback = read(
      '.github',
      'workflows',
      'consuelo-dialer-rollback.yaml',
    );
    expect(rollback).toContain('workflow_dispatch:');
    expect(rollback).toContain('railway_deployment_id:');
    expect(rollback).toContain('cloudflare_version_id:');
    expect(rollback).toContain('environment: consuelo dialer / production');
    expect(rollback).not.toContain('pull_request:');
    expect(rollback).not.toMatch(/previous|latest successful/i);
  });

  it('releases only the approved UI files to the Worker while fencing Railway and other changes', () => {
    const release = read(
      '.github',
      'workflows',
      'consuelo-production-release.yaml',
    );
    const classifier = release
      .split('  dialer-changes:\n')[1]
      ?.split('\n  public-changes:\n')[0]
      ?.split('        run: |\n')[1]
      ?.split('\n')
      .map((line) => line.replace(/^ {10}/, ''))
      .join('\n');
    expect(classifier).toBeDefined();
    if (!classifier) throw new Error('Dialer release classifier is absent');

    const temp = mkdtempSync(join(tmpdir(), 'dev1676-ui-classifier-'));
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(['git', ...args], {
        cwd: temp,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      if (result.exitCode !== 0)
        throw new Error('Fixture git failed: ' + result.stderr.toString());
      return result.stdout.toString().trim();
    };
    const put = (path: string, content: string) => {
      mkdirSync(dirname(join(temp, path)), { recursive: true });
      writeFileSync(join(temp, path), content);
    };
    const commit = (message: string) => {
      git('add', '.');
      git('commit', '-qm', message);
      return git('rev-parse', 'HEAD');
    };
    const classify = (
      before: string,
      after: string,
      event: 'push' | 'workflow_dispatch' = 'push',
      target = 'all',
    ) => {
      // Keep fixture outputs out of subsequent git commits: otherwise a
      // temporary test artifact looks like an unrelated production file.
      const outputFile = join(temp, '.git', 'classifier-output');
      writeFileSync(outputFile, '');
      const bash = classifier
        .replaceAll('$' + '{{ github.event_name }}', event)
        .replaceAll('$' + '{{ inputs.target }}', target)
        .replaceAll('$' + '{{ github.event.before }}', before);
      const result = Bun.spawnSync(['bash', '-c', bash], {
        cwd: temp,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          GITHUB_SHA: after,
          GITHUB_OUTPUT: outputFile,
          RUNNER_TEMP: join(temp, '.git'),
        },
      });
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      return readFileSync(outputFile, 'utf8');
    };
    try {
      git('init', '-q');
      git('config', 'user.email', 'release-test@consuelo.invalid');
      git('config', 'user.name', 'Release Test');
      put(
        'packages/lead-connector/src/embed/view.ts',
        'export const title = "before";\n',
      );
      put('packages/dialer-server/src/main.ts', 'export const live = true;\n');
      const packagePath = 'packages/dialer-server/package.json';
      const basePackage = {
        name: '@consuelo/dialer-server',
        scripts: { test: 'bun test' },
        dependencies: { hono: '4.0.0' },
      };
      put(packagePath, JSON.stringify(basePackage) + '\n');
      const base = commit('base');

      put(
        'packages/lead-connector/src/embed/view.ts',
        'export const title = "after";\n',
      );
      put(
        'packages/lead-connector/src/embed/compact-workspace-polish.test.ts',
        'test();\n',
      );
      put(
        'packages/lead-connector/src/deployment/release-workflow.contract.test.ts',
        'test();\n',
      );
      const ui = commit('scoped UI');
      expect(classify(base, ui)).toContain('release=false');
      expect(classify(base, ui)).toContain('frontend_only=true');
      expect(classify(base, ui, 'workflow_dispatch', 'dialer')).toContain(
        'release=true',
      );
      expect(classify(base, ui, 'workflow_dispatch', 'dialer')).toContain(
        'frontend_only=false',
      );

      put('packages/dialer-server/src/lab/launch-scenarios.ts', 'export {};\n');
      const mixedQaAndUi = commit('QA and UI together');
      expect(classify(base, mixedQaAndUi)).toContain('release=false');
      expect(classify(base, mixedQaAndUi)).toContain('frontend_only=true');

      const labPackage = {
        ...basePackage,
        scripts: {
          ...basePackage.scripts,
          'lab:launch': 'bun ./scripts/launch-scenarios.ts',
        },
      };
      put(packagePath, JSON.stringify(labPackage) + '\n');
      const mixedQaUiAndLabScript = commit('QA script and UI');
      expect(classify(base, mixedQaUiAndLabScript)).toContain('release=false');
      expect(classify(base, mixedQaUiAndLabScript)).toContain(
        'frontend_only=true',
      );

      put('packages/dialer-server/src/main.ts', 'export const live = false;\n');
      const backend = commit('runtime change');
      expect(classify(ui, backend)).toContain('release=true');
      expect(classify(ui, backend)).toContain('frontend_only=false');
      expect(classify(base, backend)).toContain('frontend_only=false');

      put(
        packagePath,
        JSON.stringify({
          ...labPackage,
          dependencies: { hono: '4.1.0' },
        }) + '\n',
      );
      const dependency = commit('dependency change');
      expect(classify(backend, dependency)).toContain('release=true');
      expect(classify(backend, dependency)).toContain('frontend_only=false');

      put('packages/dialer-server/scripts/local-dialer-lab.ts', 'export {};\n');
      const qa = commit('QA catalog');
      expect(classify(dependency, qa)).toContain('release=false');
      expect(classify(dependency, qa)).toContain('frontend_only=false');

      put(
        'packages/conversation/src/timeline.ts',
        'export const version = 2;\n',
      );
      const sharedCore = commit('conversation core only');
      expect(classify(qa, sharedCore)).toContain('release=true');
      expect(classify(qa, sharedCore)).toContain('frontend_only=false');
      put(
        'packages/lead-connector/src/embed/view.ts',
        'export const title = "later";\n',
      );
      const coreAndUi = commit('core and UI');
      expect(classify(qa, coreAndUi)).toContain('release=true');
      expect(classify(qa, coreAndUi)).toContain('frontend_only=false');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }

    const workerJob = release.split('\n  release-dialer-ui:\n')[1];
    expect(workerJob).toBeDefined();
    expect(workerJob).toContain(
      "needs.dialer-changes.outputs.frontend_only == 'true'",
    );
    expect(workerJob).toContain('CLOUDFLARE_DIALER_WORKER_API_TOKEN');
    expect(workerJob).toContain('bun run --cwd packages/lead-connector build');
    expect(workerJob).toContain('wrangler versions upload');
    expect(workerJob).toContain('wrangler versions deploy');
    expect(workerJob).toContain('wrangler deployments list');
    expect(workerJob).toContain('--version-tag');
    expect(workerJob).toContain('--keep-vars');
    expect(workerJob).toContain('versionId');
    expect(workerJob).not.toContain('release:deploy-worker');
    expect(workerJob).not.toContain('read-wrangler-deployment.ts');
    expect(workerJob).toContain('verify-production-edge.ts');
    expect(workerJob).not.toMatch(
      /RAILWAY_TOKEN|RAILWAY_DIALER_PROJECT_ID|railway up|railway-deployment/,
    );
  });
});
