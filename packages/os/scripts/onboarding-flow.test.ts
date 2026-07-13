import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  attemptWorkspaceDeviceLogin,
  completeWorkspaceDeviceSelection,
  registerInstallerDiagnosticsLifecycleHooks,
} from './install';
import type { InstallDiagnostics } from './lib/install-diagnostics';

const install = readFileSync(new URL('./install.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('./bootstrap.sh', import.meta.url), 'utf8');
const daemonInstall = readFileSync(
  new URL('./install-system-daemons.sh', import.meta.url),
  'utf8',
);
const daemonGenerator = readFileSync(
  new URL('./generate-system-daemons.sh', import.meta.url),
  'utf8',
);

type RecordedInstallerStep = {
  step: string;
  status: string;
  data?: Record<string, unknown>;
};

function createMockDiagnostics() {
  const steps: RecordedInstallerStep[] = [];
  const diagnostics: InstallDiagnostics = {
    enabled: true,
    reportDir: '',
    recordStep: vi.fn((step: string, status: string, data?: unknown) => {
      steps.push({ step, status, data: data as Record<string, unknown> | undefined });
    }),
    recordPromptDecision: vi.fn(),
    recordHttp: vi.fn(),
    finish: vi.fn(),
  };

  return { diagnostics, steps };
}

describe('Consuelo OS hosted onboarding flow', () => {
  test('skills are a real prompt with explicit multiselect instructions', () => {
    expect(install).toContain('selectedSkills');
    expect(install).toContain("message: 'select skills to enable — Use Space to select skills, press Enter to continue'");
    expect(install).toContain('createInstallerProgressSteps');
    expect(install).toContain("'service'");
    expect(install).toContain("'health'");
  });

  test('local artifact storage is automatic after local mode is selected', () => {
    expect(install).toContain("artifactMode: 'local'");
    expect(install).toContain('artifactMode: options.artifactMode');
    expect(install).not.toContain("message: 'choose artifact storage'");
    expect(install).not.toContain('local artifacts (save generated files under OS home)');
  });

  test('workspace identity starts with authorization before naming a new workspace', () => {
    expect(install).toContain('workspaceName');
    expect(install).toContain('--workspace-name');
    expect(install).toContain("message: 'enter workspace name'");
    expect(install).toContain('workspaceHostFromSlug');
    expect(install).toContain('consuelohq.com');
    expect(install).toContain('workspace name is required');
    expect(install).toContain('requestWorkspaceDeviceCode({');
    expect(install).toContain('readLocalNodeIdentity');
    expect(install).toContain('nodeId: localNodeIdentity?.nodeId');
    expect(install).toContain('nodeName: localNodeIdentity?.nodeName');
    expect(install).toContain('resolveWorkspaceIdentity');
    const promptOptionsSource = install.slice(install.indexOf('async function promptOptions'));
    expect(promptOptionsSource.indexOf('attemptWorkspaceDeviceLogin({')).toBeLessThan(
      promptOptionsSource.indexOf('resolveWorkspaceIdentity({'),
    );
    const resolveWorkspaceIdentitySource = install.slice(
      install.indexOf('async function resolveWorkspaceIdentity'),
      install.indexOf('async function promptOptions'),
    );
    expect(resolveWorkspaceIdentitySource.indexOf('const approvedBootstrap = input.deviceLogin.workspaceBootstrap')).toBeLessThan(
      resolveWorkspaceIdentitySource.indexOf("message: 'enter workspace name'"),
    );
    expect(resolveWorkspaceIdentitySource).toContain("input.deviceLogin.status !== 'workspace_required'");
    expect(install).not.toContain("message: 'Consuelo workspace URL'");
    expect(install).not.toContain("message: 'workspace short name'");
    expect(install).not.toContain('workspace URL is required');
    expect(install).not.toContain('internal.consuelohq.com');
  });

  test('normal installer attempts real device login and falls back cleanly', () => {
    expect(install).toContain('attemptWorkspaceDeviceLogin');
    expect(install).toContain('requestWorkspaceDeviceCode');
    expect(install).toContain('pollWorkspaceDeviceAccessToken');
    expect(install).toContain('openDeviceVerificationUrl');
    expect(install).toContain('Device login unavailable; continuing with local workspace bootstrap.');
    expect(install).toContain("if (liveDeviceCode.status !== 'started')");
    expect(install).not.toContain('workspaceActivation');
    expect(install).not.toContain('app.consuelohq.com/os/activate');
  });

  test('local and cloud mode labels are plain choices', () => {
    expect(install).toContain("label: 'local'");
    expect(install).toContain("label: 'cloud'");
    expect(install).not.toContain("label: 'local compute'");
    expect(install).not.toContain("label: 'cloud compute'");
    expect(install).not.toContain('workspace URL stays the stable access path');
    expect(install).not.toContain('connect to cloud OS');
  });

  test('agent multiselect explains default-selected detected agents', () => {
    expect(install).toContain('formatLocalAgentsPromptMessage');
    expect(install).toContain('found — press Space to not connect to this workspace, Enter to continue');
  });

  test('background service confirmation stays in install.ts onboarding intent', () => {
    expect(install).toContain('installDaemons');
    expect(install).toContain("message: 'install local background service?'");
    expect(bootstrap).not.toContain('Consuelo OS runs a local background service on your Mac so agents and apps can reach your OS while you work.');
  });

  test('human bootstrap consumes install.ts json intent for daemon install', () => {
    expect(bootstrap).toContain('run_onboarding_json');
    expect(bootstrap).toContain('ONBOARDING_JSON');
    expect(bootstrap).toContain('installDaemons');
  });

  test('normal install output is compact and does not print every provision action', () => {
    expect(install).toContain('summarizeActions');
    expect(install).toContain('saved to');
    expect(install).not.toContain('for (const action of result.actions)');
  });


  test('should serialize interactive daemon choice when returning to hosted bootstrap', () => {
    const payloadSource = install.slice(install.indexOf('const payload ='));
    expect(payloadSource).toContain('installDaemons: installDaemons');
    expect(payloadSource).not.toContain('installDaemons: options.installDaemons');
  });

  test('should default new installs to flattened Consuelo home when hosted bootstrap runs', () => {
    expect(bootstrap).toContain('DEFAULT_OS_HOME="${CONSUELO_DEFAULT_HOME:-$HOME/.consuelo}"');
    expect(bootstrap).toContain('OS_HOME="$(resolve_os_home)"');
    expect(bootstrap).toContain(`printf '%s\\n' "$OS_HOME/runtime/current"`);
    expect(bootstrap).toContain('log "Home: $os_home"');
    expect(bootstrap).not.toContain('OS_HOME="${CONSUELO_HOME:-$HOME/.consuelo/os}"');
  });

  test('should gate development diagnostics when preparing installer diagnostics for launch removal', () => {
    expect(bootstrap).toContain('CONSUELO_OS_DEV_DIAGNOSTICS');
    expect(bootstrap).toContain('CONSUELO_OS_DEV_REPORT_DIR');
    expect(bootstrap).toContain('bootstrap.log');
    expect(install).toContain('createInstallDiagnostics');
    expect(install).toContain('recordInstallerStep');
    expect(install).toContain('recordPromptDecision');
  });


  test('should fail hosted bootstrap when child installer does not emit valid onboarding json', () => {
    expect(bootstrap).toContain('validate_onboarding_json');
    expect(bootstrap).toContain('interactive onboarding did not complete');
    expect(bootstrap).toContain('onboarding result file was empty');
    expect(bootstrap).toContain('onboarding result did not include installDaemons');
    expect(bootstrap).toContain('install_status=$?');
    expect(bootstrap).toContain('Consuelo OS installer exited before onboarding completed');
    expect(bootstrap).toContain('child-installer.log');
    expect(bootstrap).toContain('Child installer transcript');
    const validateOnboardingJsonIndex = bootstrap.indexOf('validate_onboarding_json "$ONBOARDING_JSON"');
    const installDaemonsCheckIndex = bootstrap.indexOf(`if printf '%s' "$ONBOARDING_JSON"`);
    expect(validateOnboardingJsonIndex).toBeGreaterThanOrEqual(0);
    expect(installDaemonsCheckIndex).toBeGreaterThanOrEqual(0);
    expect(validateOnboardingJsonIndex).toBeLessThan(installDaemonsCheckIndex);
  });


  test('should record process lifecycle diagnostics when installer lifecycle events fire', () => {
    const { diagnostics, steps } = createMockDiagnostics();
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const lifecycleTarget = {
      once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler);
        return lifecycleTarget;
      }),
    };
    const kill = vi.fn();

    registerInstallerDiagnosticsLifecycleHooks(diagnostics, lifecycleTarget, { kill, pid: 12345 });
    handlers.get('beforeExit')?.(0);
    handlers.get('exit')?.(0);
    handlers.get('SIGTERM')?.();

    expect(steps).toEqual([
      { step: 'process_lifecycle', status: 'beforeExit', data: { exitCode: 0 } },
      { step: 'process_lifecycle', status: 'exit', data: { exitCode: 0 } },
      { step: 'process_lifecycle', status: 'signal', data: { signal: 'SIGTERM' } },
    ]);
    expect(kill).toHaveBeenCalledWith(12345, 'SIGTERM');
  });

  test('should record device login polling breadcrumbs in runtime order', async () => {
    const { diagnostics, steps } = createMockDiagnostics();
    const order: string[] = [];
    const dependencies = {
      readLocalNodeIdentity: vi.fn(() => undefined),
      requestWorkspaceDeviceCode: vi.fn(async () => {
        order.push('request-code');
        return {
          status: 'started' as const,
          deviceKeyPair: {
            algorithm: 'Ed25519' as const,
            publicKeyJwk: '{}',
            signingKeyJwk: '{}',
          },
          session: {
            deviceCode: 'device-secret',
            userCode: '7YMS4KV8',
            verificationUri: 'https://os.consuelohq.com/login/device',
            verificationUriComplete: 'https://os.consuelohq.com/login/device?user_code=7YMS4KV8',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            intervalSeconds: 5,
          },
        };
      }),
      printDeviceLoginPrompt: vi.fn(async () => {
        order.push('prompt');
      }),
      openDeviceVerificationUrl: vi.fn(async () => {
        order.push('open');
        return true;
      }),
      sleep: vi.fn(async () => {
        order.push('sleep');
      }),
      withRuntimeHold: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => {
        order.push('runtime-hold');
        return operation();
      }),
      pollWorkspaceDeviceAccessToken: vi.fn(async () => {
        order.push('poll');
        return { status: 'workspace_required' as const, intervalSeconds: 5, message: 'workspace name required' };
      }),
    };

    const result = await attemptWorkspaceDeviceLogin(
      { dryRun: false, home: '/tmp/consuelo-home', diagnostics },
      dependencies,
    );

    expect(result.status).toBe('workspace_required');
    expect(order).toEqual(['request-code', 'prompt', 'open', 'runtime-hold', 'sleep', 'poll']);
    const deviceLoginSteps = steps.filter((step) => step.step === 'device_login');
    expect(deviceLoginSteps.map((step) => step.status)).toEqual([
      'start',
      'prompt_displayed',
      'browser_open',
      'poll_wait',
      'poll_request',
      'poll_result',
      'complete',
    ]);
    expect(deviceLoginSteps.find((step) => step.status === 'prompt_displayed')?.data).toEqual({ displayed: true });
    expect(deviceLoginSteps.find((step) => step.status === 'poll_request')?.data).toEqual({ intervalSeconds: 5 });
    expect(JSON.stringify(deviceLoginSteps.find((step) => step.status === 'prompt_displayed')?.data)).not.toContain('https://');
  });

  test('should record explicit diagnostics breadcrumbs when workspace selection posts', () => {
    expect(install).toContain("'workspace_selection'");
    expect(install).toContain("recordInstallerStep(diagnostics, 'workspace_selection', 'start'");
    expect(install).toContain("recordInstallerStep(diagnostics, 'workspace_selection', 'request'");
    expect(install).toContain("diagnostics.recordHttp('device.workspace_selection'");
    expect(install).toContain("recordInstallerStep(diagnostics, 'workspace_selection', 'complete'");
    expect(install).toContain("recordInstallerStep(diagnostics, 'workspace_selection', 'failed'");
    const selectionSource = install.slice(
      install.indexOf("let selected: Awaited<ReturnType<typeof selectWorkspaceForDeviceLogin>>"),
      install.indexOf(`if (selected.status === 'approved')`),
    );
    expect(selectionSource).toContain('try');
    expect(selectionSource).toContain('catch (error: unknown)');
  });

  test('should hold runtime while workspace selection posts when device login needs workspace creation', async () => {
    const { diagnostics, steps } = createMockDiagnostics();
    const order: string[] = [];
    const dependencies = {
      withRuntimeHold: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => {
        order.push('runtime-hold:start');
        const result = await operation();
        order.push('runtime-hold:end');
        return result;
      }),
      selectWorkspaceForDeviceLogin: vi.fn(async () => {
        order.push('select-workspace');
        return {
          status: 'approved' as const,
          workspaceId: 'workspace-alpha',
          workspaceSlug: 'alpha',
          workspaceHost: 'alpha.consuelohq.com',
          connectorId: 'connector-alpha',
          connectorBootstrapToken: 'connector-token-alpha',
          nodeId: 'node-alpha',
          nodeName: 'Alpha Mac',
          nodeRole: 'home' as const,
          nodeStatus: 'created' as const,
        };
      }),
    };

    const result = await completeWorkspaceDeviceSelection(
      {
        diagnostics,
        selection: {
          deviceCode: 'device-code-alpha',
          intervalSeconds: 5,
          deviceKeyPair: {
            algorithm: 'Ed25519',
            publicKeyJwk: 'public-key-alpha',
            signingKeyJwk: 'signing-key-alpha',
          },
        },
        workspaceName: 'alpha',
        workspaceSlug: 'alpha',
        workspaceHost: 'alpha.consuelohq.com',
      },
      dependencies,
    );

    expect(order).toEqual(['runtime-hold:start', 'select-workspace', 'runtime-hold:end']);
    expect(dependencies.selectWorkspaceForDeviceLogin).toHaveBeenCalledWith({
      clientId: 'consuelo-os-installer',
      deviceCode: 'device-code-alpha',
      intervalSeconds: 5,
      deviceKeyPair: {
        algorithm: 'Ed25519',
        publicKeyJwk: 'public-key-alpha',
        signingKeyJwk: 'signing-key-alpha',
      },
      workspaceName: 'alpha',
      workspaceSlug: 'alpha',
      workspaceHost: 'alpha.consuelohq.com',
    });
    expect(result.workspaceBootstrap?.workspaceId).toBe('workspace-alpha');
    expect(diagnostics.recordHttp).toHaveBeenCalledWith('device.workspace_selection', 200, 'approved');
    expect(steps.filter((step) => step.step === 'workspace_selection').map((step) => step.status)).toEqual([
      'start',
      'request',
      'complete',
    ]);
    expect(JSON.stringify(steps)).not.toContain('connector-token-alpha');
  });

  test('should preserve workspace selection failure details when cloud handoff is rejected', async () => {
    const { diagnostics, steps } = createMockDiagnostics();
    const dependencies = {
      withRuntimeHold: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => operation()),
      selectWorkspaceForDeviceLogin: vi.fn(async () => ({
        status: 'unavailable' as const,
        message: 'workspace_host_conflict: workspace host is already registered',
      })),
    };

    await expect(completeWorkspaceDeviceSelection(
      {
        diagnostics,
        selection: {
          deviceCode: 'device-code-beta',
          intervalSeconds: 5,
          deviceKeyPair: {
            algorithm: 'Ed25519',
            publicKeyJwk: 'public-key-beta',
            signingKeyJwk: 'signing-key-beta',
          },
        },
        workspaceName: 'beta',
        workspaceSlug: 'beta',
        workspaceHost: 'beta.consuelohq.com',
      },
      dependencies,
    )).rejects.toThrow('workspace selection failed: unavailable: workspace_host_conflict: workspace host is already registered');

    expect(diagnostics.recordHttp).toHaveBeenCalledWith('device.workspace_selection', 400, 'unavailable');
    expect(steps.filter((step) => step.step === 'workspace_selection').map((step) => step.status)).toEqual([
      'start',
      'request',
      'failed',
    ]);
    expect(steps.find((step) => step.status === 'failed')?.data).toEqual({
      status: 'unavailable',
      message: 'workspace_host_conflict: workspace host is already registered',
    });
  });

  test('should keep daemon installer output compact when setup succeeds normally', () => {
    expect(daemonInstall).toContain('print_debug_state');
    expect(daemonInstall).toContain('background service setup complete');
    expect(daemonInstall).not.toContain('generated user LaunchAgent plists in');
  });

  test('should default daemon logs to writable OS home log directory when generating launch agents', () => {
    expect(daemonInstall).toContain('log_dir="${CONSUELO_DAEMON_LOG_DIR:-$root_dir/logs}"');
    expect(daemonGenerator).toContain('log_dir="${CONSUELO_DAEMON_LOG_DIR:-$root_dir/logs}"');
    expect(daemonInstall).not.toContain('$daemon_home/Library/Logs/Consuelo');
    expect(bootstrap).not.toContain('$daemon_home/Library/Logs/Consuelo');
  });

  test('should resolve final runtime commands from flattened Consuelo home when hosted bootstrap completes', () => {
    expect(bootstrap).toContain('DEFAULT_OS_HOME="${CONSUELO_DEFAULT_HOME:-$HOME/.consuelo}"');
    expect(bootstrap).toContain('OS_HOME="$(resolve_os_home)"');
    expect(bootstrap).toContain('local os_home="$OS_HOME"');
    expect(bootstrap).toContain('log "Consuelo OS setup complete"');
    expect(bootstrap).toContain('log "Home: $os_home"');
    expect(bootstrap).not.toContain('$HOME/.consuelo/source/opensaas');
    expect(bootstrap).not.toContain('REPO_DIR/packages/os run doctor');
    expect(bootstrap).not.toContain('log "Source: $REPO_DIR"');
  });
});
