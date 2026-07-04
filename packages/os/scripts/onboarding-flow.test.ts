import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

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


  test('interactive daemon choice is serialized back to hosted bootstrap', () => {
    const payloadSource = install.slice(install.indexOf('const payload ='));
    expect(payloadSource).toContain('installDaemons: installDaemons');
    expect(payloadSource).not.toContain('installDaemons: options.installDaemons');
  });

  test('hosted bootstrap defaults new installs to flattened Consuelo home', () => {
    expect(bootstrap).toContain('DEFAULT_OS_HOME="${CONSUELO_DEFAULT_HOME:-$HOME/.consuelo}"');
    expect(bootstrap).toContain('OS_HOME="$(resolve_os_home)"');
    expect(bootstrap).toContain(`printf '%s\\n' "$OS_HOME/runtime/current"`);
    expect(bootstrap).toContain('log "Home: $os_home"');
    expect(bootstrap).not.toContain('OS_HOME="${CONSUELO_HOME:-$HOME/.consuelo/os}"');
  });

  test('development diagnostics are explicitly gated and easy to remove before launch', () => {
    expect(bootstrap).toContain('CONSUELO_OS_DEV_DIAGNOSTICS');
    expect(bootstrap).toContain('CONSUELO_OS_DEV_REPORT_DIR');
    expect(bootstrap).toContain('bootstrap.log');
    expect(install).toContain('createInstallDiagnostics');
    expect(install).toContain('recordInstallerStep');
    expect(install).toContain('recordPromptDecision');
  });


  test('hosted bootstrap fails when child installer does not emit valid onboarding json', () => {
    expect(bootstrap).toContain('validate_onboarding_json');
    expect(bootstrap).toContain('interactive onboarding did not complete');
    expect(bootstrap).toContain('onboarding result file was empty');
    expect(bootstrap).toContain('onboarding result did not include installDaemons');
    expect(bootstrap).toContain('install_status=$?');
    expect(bootstrap).toContain('Consuelo OS installer exited before onboarding completed');
    expect(bootstrap.indexOf('validate_onboarding_json "$ONBOARDING_JSON"')).toBeLessThan(
      bootstrap.indexOf(`if printf '%s' "$ONBOARDING_JSON"`),
    );
  });

  test('workspace selection POST has explicit diagnostics breadcrumbs', () => {
    expect(install).toContain("'workspace_selection'");
    expect(install).toContain("recordInstallerStep(input.diagnostics, 'workspace_selection', 'start'");
    expect(install).toContain("input.diagnostics.recordHttp('device.workspace_selection'");
    expect(install).toContain("recordInstallerStep(input.diagnostics, 'workspace_selection', 'complete'");
    expect(install).toContain("recordInstallerStep(input.diagnostics, 'workspace_selection', 'failed'");
    const selectionSource = install.slice(
      install.indexOf("let selected: Awaited<ReturnType<typeof selectWorkspaceForDeviceLogin>>"),
      install.indexOf(`if (selected.status === 'approved')`),
    );
    expect(selectionSource).toContain('try');
    expect(selectionSource).toContain('catch (error: unknown)');
  });

  test('daemon installer normal output is compact', () => {
    expect(daemonInstall).toContain('print_debug_state');
    expect(daemonInstall).toContain('background service setup complete');
    expect(daemonInstall).not.toContain('generated user LaunchAgent plists in');
  });

  test('daemon installer defaults logs to the writable OS home log directory', () => {
    expect(daemonInstall).toContain('log_dir="${CONSUELO_DAEMON_LOG_DIR:-$root_dir/logs}"');
    expect(daemonGenerator).toContain('log_dir="${CONSUELO_DAEMON_LOG_DIR:-$root_dir/logs}"');
    expect(daemonInstall).not.toContain('$daemon_home/Library/Logs/Consuelo');
    expect(bootstrap).not.toContain('$daemon_home/Library/Logs/Consuelo');
  });

  test('hosted bootstrap resolves final runtime commands from flattened Consuelo home', () => {
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
