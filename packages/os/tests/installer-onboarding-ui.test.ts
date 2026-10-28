import { describe, expect, it } from 'vitest';

import {
  createOsBannerLines,
} from '../scripts/lib/cli-ui';
import {
  createInstallerProgressSteps,
  deviceLoginPromptLines,
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

  it('keeps successful browser authorization focused while always showing a fallback', () => {
    const output = deviceLoginPromptLines({
      userCode: 'SXCW-REHY',
      verificationUrl: 'https://os.consuelohq.com/login/device?user_code=SXCWREHY',
      browserOpened: true,
      copied: false,
    }).join('\n');

    expect(output).toContain('Approve Consuelo OS in your browser.');
    expect(output).toContain('SXCW-REHY');
    expect(output).toContain('Confirm this code in the browser.');
    expect(output).toContain('If the browser did not open or switched away:');
    expect(output).toContain('https://os.consuelohq.com/login/device?user_code=SXCWREHY');
    expect(output).toContain('Enter code SXCW-REHY.');
    expect(output).not.toContain('copied');
  });

  it('shows the authorization URL only when the browser could not be opened', () => {
    const output = deviceLoginPromptLines({
      userCode: 'SXCW-REHY',
      verificationUrl: 'https://os.consuelohq.com/login/device?user_code=SXCWREHY',
      browserOpened: false,
      copied: true,
    }).join('\n');

    expect(output).toContain('SXCW-REHY');
    expect(output).toContain('Open this link to continue:');
    expect(output).toContain('https://os.consuelohq.com/login/device?user_code=SXCWREHY');
    expect(output).toContain('Enter code SXCW-REHY.');
    expect(output).toContain('Authorization URL copied to clipboard.');
  });
});
