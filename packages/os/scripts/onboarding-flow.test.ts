import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const install = readFileSync(new URL('./install.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('./bootstrap.sh', import.meta.url), 'utf8');
const daemonInstall = readFileSync(
  new URL('./install-system-daemons.sh', import.meta.url),
  'utf8',
);

describe('Consuelo OS hosted onboarding flow', () => {
  test('skills and artifacts are real prompts, not banner-only steps', () => {
    expect(install).toContain('selectedSkills');
    expect(install).toContain("message: 'select skills to enable'");
    expect(install).toContain('artifactMode');
    expect(install).toContain("message: 'choose artifact storage'");
    expect(install).toContain('skills, artifacts, agents, and health');
  });

  test('agent multiselect explains Space selection', () => {
    expect(install).toContain('Use Space to select agents');
    expect(install).toContain('press Enter to continue');
  });

  test('background service confirmation is part of install.ts onboarding intent', () => {
    expect(install).toContain('installDaemons');
    expect(install).toContain("message: 'install local background service?'");
    expect(install).toContain('background service is the final setup step');
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

  test('hosted bootstrap resolves final runtime commands from OS package root', () => {
    expect(bootstrap).toContain('OS_HOME="${CONSUELO_HOME:-$HOME/.consuelo/os}"');
    expect(bootstrap).toContain('local os_home="$OS_HOME"');
    expect(bootstrap).toContain('local os_dir="$OS_HOME"');
    expect(bootstrap).toContain('local doctor_cmd="CONSUELO_HOME=$os_home $BUN_BIN --cwd $os_home run doctor"');
    expect(bootstrap).toContain('log "Package: $os_home"');
    expect(bootstrap).not.toContain('$HOME/.consuelo/source/opensaas');
    expect(bootstrap).not.toContain('REPO_DIR/packages/os run doctor');
    expect(bootstrap).not.toContain('log "Source: $REPO_DIR"');
  });
});
