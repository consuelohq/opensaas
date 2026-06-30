import { describe, expect, it } from 'vitest';

import {
  createOsBannerLines,
} from '../scripts/lib/cli-ui';
import {
  createInstallerProgressSteps,
  formatLocalAgentsPromptMessage,
} from '../scripts/install';

describe('installer onboarding UI', () => {
  it('renders the OS banner with the requested identity, tagline, and active step symbol', () => {
    const output = createOsBannerLines([
      { label: 'dependencies', state: 'complete' },
      { label: 'workspace', state: 'complete' },
      { label: 'security', state: 'complete' },
      { label: 'skills', state: 'active' },
      { label: 'agents', state: 'pending' },
      { label: 'service', state: 'pending' },
      { label: 'health', state: 'pending' },
    ]).join('\n');

    expect(output).toContain('CONSUELO OS');
    expect(output).toContain('One workspace. Any agent.');
    expect(output).toContain('●  dependencies');
    expect(output).toContain('●  security');
    expect(output).toContain('◆  skills');
    expect(output).toContain('○  agents');
    expect(output).toContain('○  service');
    expect(output).toContain('○  health');
    expect(output).not.toContain('make your company agent-ready');
  });

  it('advances installer progress through agents, service, and health', () => {
    expect(createInstallerProgressSteps('agents')).toEqual([
      { label: 'dependencies', state: 'complete' },
      { label: 'workspace', state: 'complete' },
      { label: 'security', state: 'complete' },
      { label: 'skills', state: 'complete' },
      { label: 'agents', state: 'active' },
      { label: 'service', state: 'pending' },
      { label: 'health', state: 'pending' },
    ]);

    expect(createInstallerProgressSteps('service')).toEqual([
      { label: 'dependencies', state: 'complete' },
      { label: 'workspace', state: 'complete' },
      { label: 'security', state: 'complete' },
      { label: 'skills', state: 'complete' },
      { label: 'agents', state: 'complete' },
      { label: 'service', state: 'active' },
      { label: 'health', state: 'pending' },
    ]);

    expect(createInstallerProgressSteps('health')).toEqual([
      { label: 'dependencies', state: 'complete' },
      { label: 'workspace', state: 'complete' },
      { label: 'security', state: 'complete' },
      { label: 'skills', state: 'complete' },
      { label: 'agents', state: 'complete' },
      { label: 'service', state: 'complete' },
      { label: 'health', state: 'active' },
    ]);
  });

  it('keeps the local agent multiselect prompt clear', () => {
    expect(formatLocalAgentsPromptMessage(1)).toBe(
      '1 agents found — press Space to not connect to this workspace, Enter to continue',
    );
    expect(formatLocalAgentsPromptMessage(3)).toBe(
      '3 agents found — press Space to not connect to this workspace, Enter to continue',
    );
  });
});
