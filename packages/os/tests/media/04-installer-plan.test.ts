import { describe, expect, it } from 'vitest';

import { expectJsonCliSuccess, importMediaModule, runMediaCli } from './helpers';

type InstallPlanStep = {
  dependencyId: string;
  packageName?: string;
  commands?: string[];
  skipped?: boolean;
};

type InstallPlan = {
  schema: string;
  dryRun: boolean;
  profiles: string[];
  packageManager: string;
  steps: InstallPlanStep[];
  estimatedInstalledSizeMb: number;
  warnings?: string[];
};

function expectInstallPlanStep(plan: Record<string, unknown>, dependencyId: string): void {
  const steps = plan.steps;
  expect(Array.isArray(steps), 'install plan should include steps array').toBe(true);
  expect(
    (steps as InstallPlanStep[]).some((step) => step.dependencyId === dependencyId),
    'install plan should include dependency step ' + dependencyId,
  ).toBe(true);
}

describe('media installer plan', () => {
  it('should satisfy media contract when it exposes a pure install-plan builder for dry-run tests', async () => {
    const module = await importMediaModule('scripts/lib/media/install-plan.ts');
    expect(typeof module.createMediaInstallPlan).toBe('function');

    const createMediaInstallPlanExport = module.createMediaInstallPlan;
    expect(typeof createMediaInstallPlanExport).toBe('function');
    const createMediaInstallPlan = createMediaInstallPlanExport as (input: { profiles: string[]; dryRun: boolean; installedCommands?: Record<string, string> }) => InstallPlan;
    const plan = createMediaInstallPlan({ profiles: ['media-core'], dryRun: true, installedCommands: { ffmpeg: '/opt/homebrew/bin/ffmpeg', ffprobe: '/opt/homebrew/bin/ffprobe' } });

    expect(plan).toMatchObject({ schema: 'media.install-plan.v1', dryRun: true, packageManager: 'homebrew' });
    expect(plan.profiles).toEqual(['media-core']);
    expect(plan.steps.map((step) => step.dependencyId)).toEqual(expect.arrayContaining(['ffmpeg', 'mediainfo', 'imagemagick', 'exiftool']));
    expect(plan.steps.find((step) => step.dependencyId === 'ffmpeg')?.commands).toEqual(['ffmpeg', 'ffprobe']);
    expect(plan.estimatedInstalledSizeMb).toBeGreaterThan(0);
  });

  it('should satisfy media contract when it returns structured JSON from media install dry-runs without mutating the filesystem', () => {
    const json = expectJsonCliSuccess(['install', '--profile', 'media-core', '--dry-run', '--json']);

    expect(json.schema).toBe('media.install-plan.v1');
    expect(json.dryRun).toBe(true);
    expect(json.profiles).toEqual(['media-core']);
    expectInstallPlanStep(json, 'ffmpeg');
    expect((json.steps as InstallPlanStep[]).find((step) => step.dependencyId === 'ffmpeg')?.commands).toEqual(expect.arrayContaining(['ffmpeg', 'ffprobe']));
    expect((json.steps as InstallPlanStep[]).some((step) => /vlc/i.test(step.dependencyId))).toBe(false);
  });

  it('should satisfy media contract when it keeps optional profiles explicit and enforces size warnings', () => {
    const json = expectJsonCliSuccess(['install', '--profile', 'media-vision-pose', '--dry-run', '--json', '--max-estimated-size-mb', '200']);

    expect(json.schema).toBe('media.install-plan.v1');
    expect(json.profiles).toEqual(['media-vision-pose']);
    expectInstallPlanStep(json, 'mediapipe');
    expectInstallPlanStep(json, 'opencv-python-headless');
    expect((json.steps as InstallPlanStep[]).some((step) => step.dependencyId === 'opencv-python')).toBe(false);
    expect(json.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/size|budget|estimate/i)]));
  });

  it('should satisfy media contract when it fails clearly when Homebrew is unavailable and install is requested', () => {
    const result = runMediaCli(['install', '--profile', 'media-core', '--json'], { env: { CONSUELO_MEDIA_TEST_DISABLE_HOMEBREW: '1' } });
    const output = result.stdout || result.stderr;

    expect(result.status).not.toBe(0);
    expect(output).toContain('media.install-error.v1');
    expect(output).toMatch(/homebrew/i);
    expect(output).not.toMatch(/command not found|ENOENT/);
  });
});
