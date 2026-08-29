import { describe, expect, it } from 'vitest';

import { renderWorkspaceChromeBar } from '../scripts/lib/workspace-chrome';

describe('workspace chrome custom routes', () => {
  it('renders validated launcher sections in the current route menu and turns the private dashboard link into a same-origin handoff', () => {
    const html = renderWorkspaceChromeBar('overview', 'Overview', {
      extraSections: [
        {
          id: 'internal',
          label: 'Internal <ops>',
          links: [
            {
              label: 'Users & installs',
              href: 'https://internal.consuelohq.com/users?view=recent',
            },
          ],
        },
      ],
    });

    expect(html).toContain('data-custom-route-group="internal"');
    expect(html).toContain('>Internal &lt;ops&gt;</p>');
    expect(html).not.toContain('<ops>');
    expect(html).toContain('>Users &amp; installs</span>');
    expect(html).toContain('/auth/handoff/start?target_host=internal.consuelohq.com&amp;return_to=%2Fusers%3Fview%3Drecent');
    expect(html).not.toContain('href="https://internal.consuelohq.com/users?view=recent"');
    expect(html).not.toContain('target="_blank" rel="noopener noreferrer" href="/auth/handoff/start');
  });

  it('keeps ordinary HTTPS custom links external without changing stock routes', () => {
    const html = renderWorkspaceChromeBar('tools', 'Tools', {
      extraSections: [
        {
          id: 'team',
          label: 'Team',
          links: [{ label: 'Runbook', href: 'https://docs.example.com/runbook' }],
        },
      ],
    });

    expect(html).toContain('data-custom-route-group="team"');
    expect(html).toContain('href="https://docs.example.com/runbook"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('href="/configuration"');
    expect(html).toContain('href="/tracing"');
  });
});
