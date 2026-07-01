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
    expect(install).toContain("{ label: 'security', state: 'complete' }");
    expect(install).toContain("'service'");
    expect(install).toContain("'health'");
  });

  test('local artifact storage is automatic after local mode is selected', () => {
    expect(install).toContain("artifactMode: 'local'");
    expect(install).toContain('artifactMode: options.artifactMode');
    expect(install).not.toContain("message: 'choose artifact storage'");
    expect(install).not.toContain('local artifacts (save generated files under OS home)');
  });

  test('workspace identity asks for a name and derives slug plus host internally', () => {
    expect(install).toContain('workspaceName');
    expect(install).toContain('--workspace-name');
    expect(install).toContain("message: 'enter workspace name'");
    expect(install).toContain('workspaceHostFromSlug');
    expect(install).toContain('consuelohq.com');
    expect(install).toContain('workspace name is required');
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
    expect(install).toContain('agentPromptSubject');
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

  test('hosted bootstrap resolves final runtime commands from OS package root', () => {
    expect(bootstrap).toContain('OS_HOME="${CONSUELO_HOME:-$HOME/.consuelo/os}"');
    expect(bootstrap).toContain('local os_home="$OS_HOME"');
    expect(bootstrap).toContain('local os_dir="$OS_HOME"');
    expect(bootstrap).toContain('log "Consuelo OS setup complete"');
    expect(bootstrap).toContain('log "Home: $os_home"');
    expect(bootstrap).not.toContain('$HOME/.consuelo/source/opensaas');
    expect(bootstrap).not.toContain('REPO_DIR/packages/os run doctor');
    expect(bootstrap).not.toContain('log "Source: $REPO_DIR"');
  });
});
