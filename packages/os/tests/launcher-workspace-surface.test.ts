import { describe, expect, it } from 'vitest';

import { renderLauncherOnboarding } from '../scripts/lib/launcher-onboarding';

const WORKSPACE = 'internal.consuelohq.com';

const render = (hostname: string | null = WORKSPACE): string =>
  renderLauncherOnboarding({
    mcpUrl: 'https://os.consuelohq.com/mcp',
    workspaceHostname: hostname,
    localAgents: [
      { name: 'claude', label: 'Claude', status: 'verified' },
      { name: 'codex', label: 'Codex', status: 'verified' },
    ],
  });

describe('L1 sites links target the workspace host', () => {
  it.each([
    ['Go to market', '/gtm'],
    ['Artifacts', '/artifacts'],
    ['Observability', '/observability'],
    ['Code review', '/diffs'],
  ])('%s points at the workspace host %s', (label, pathname) => {
    expect(render()).toContain(`href="https://${WORKSPACE}${pathname}">${label}`);
  });

  it('never emits a link to the shared sites host', () => {
    expect(render()).not.toContain('sites.consuelohq.com');
  });

  it('refuses to build a launcher for a reserved host', () => {
    expect(() => render('sites.consuelohq.com')).toThrowError(/Invalid workspace hostname/);
  });
});

describe('L2 writing links to the public blog', () => {
  const BLOG =
    'https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/';

  it('points Decision loops at the published post', () => {
    expect(render()).toContain(`href="${BLOG}#the-future-interface-is-what-should-we-do-next"`);
  });

  it('uses the same blog link for every workspace, not a per-host path', () => {
    expect(render('other.consuelohq.com')).toContain(BLOG);
    expect(render()).not.toContain('/writing/on-decision-loops');
  });
});

describe('L4 meta values align under their labels', () => {
  it('resets the default dd indent', () => {
    expect(render()).toMatch(/\.meta-value[^}]*margin:\s*0/);
  });
});

describe('L3 the agent list survives a failed status fetch', () => {
  it('server-renders the agents it was given', () => {
    const html = render();
    expect(html).toContain('Claude');
    expect(html).toContain('Codex');
  });

  it('does not clear the list when the status fetch fails', () => {
    // The flash-then-vanish: the catch path wiped server-rendered agents.
    const html = render();
    const cat = html.slice(html.indexOf('.catch('));
    expect(cat).not.toMatch(/listElement\.replaceChildren\(\)/);
  });

  it('skips the status fetch on reserved hosts', () => {
    expect(render()).toContain('RESERVED_LAUNCHER_HOSTS');
  });
});
