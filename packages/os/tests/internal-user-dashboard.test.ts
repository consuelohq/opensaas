import { describe, expect, it } from 'vitest';

import {
  INTERNAL_DASHBOARD_API_REQUESTS,
  INTERNAL_DASHBOARD_CSS,
  INTERNAL_DASHBOARD_FIXTURES,
  INTERNAL_DASHBOARD_JAVASCRIPT,
  renderInternalUserDashboard,
  resolveInternalDashboardRoute,
} from '../scripts/lib/internal-user-dashboard';
import { INSTALL_DASHBOARD_API_ROUTES } from '../scripts/lib/install-telemetry-contract';

describe('internal user dashboard', () => {
  it('resolves only the supported read-only product routes', () => {
    expect(resolveInternalDashboardRoute('/')).toEqual({ kind: 'users', nav: 'users' });
    expect(resolveInternalDashboardRoute('/users')).toEqual({ kind: 'users', nav: 'users' });
    expect(resolveInternalDashboardRoute('/installs')).toEqual({ kind: 'installs', nav: 'installs' });
    expect(resolveInternalDashboardRoute('/devices')).toEqual({ kind: 'devices', nav: 'devices' });
    expect(resolveInternalDashboardRoute('/errors')).toEqual({ kind: 'errors', nav: 'errors' });
    expect(resolveInternalDashboardRoute('/users/usr_fixture_01')).toEqual({
      kind: 'user-detail',
      nav: 'users',
      id: 'usr_fixture_01',
    });
    expect(resolveInternalDashboardRoute('/installs/ins_11111111-1111-4111-8111-111111111111')).toEqual({
      kind: 'install-detail',
      nav: 'installs',
      id: 'ins_11111111-1111-4111-8111-111111111111',
    });
    expect(resolveInternalDashboardRoute('/not-a-real-surface')).toEqual({ kind: 'users', nav: 'users' });
  });

  it('keeps the read API bounded and exposes only the explicit enrollment reset mutation', () => {
    expect(INTERNAL_DASHBOARD_API_REQUESTS.overview).toEqual([
      INSTALL_DASHBOARD_API_ROUTES.overview,
      INSTALL_DASHBOARD_API_ROUTES.users,
      INSTALL_DASHBOARD_API_ROUTES.errors,
    ]);
    expect(INTERNAL_DASHBOARD_API_REQUESTS['user-detail']).toEqual([
      INSTALL_DASHBOARD_API_ROUTES.users,
      INSTALL_DASHBOARD_API_ROUTES.installs,
      INSTALL_DASHBOARD_API_ROUTES.devices,
    ]);

    const serialized = JSON.stringify(INTERNAL_DASHBOARD_API_REQUESTS);
    expect(serialized).not.toContain('/users/:');
    expect(serialized).not.toContain('/api/internal/os/v1/users/');
    expect(INTERNAL_DASHBOARD_JAVASCRIPT).toContain("method: 'POST'");
    expect(INTERNAL_DASHBOARD_JAVASCRIPT).toContain('/api/internal/os/v1/enrollment/reset');
    expect(INTERNAL_DASHBOARD_JAVASCRIPT).toContain('x-consuelo-dashboard-action');
    expect(INTERNAL_DASHBOARD_JAVASCRIPT).toContain('result.error.message');
    expect(INTERNAL_DASHBOARD_JAVASCRIPT).not.toContain("method: 'PATCH'");
    expect(INTERNAL_DASHBOARD_JAVASCRIPT).not.toContain('method: \'DELETE\'');
  });

  it('ships fixtures that exercise the important read-model states', () => {
    expect(INTERNAL_DASHBOARD_FIXTURES.overview.users.registered).toBeGreaterThan(0);
    expect(INTERNAL_DASHBOARD_FIXTURES.overview.trend.length).toBeGreaterThanOrEqual(14);

    expect(new Set(INTERNAL_DASHBOARD_FIXTURES.users.items.map((user) => user.activationState))).toEqual(
      new Set(['registered', 'authorized', 'installed', 'active']),
    );
    expect(new Set(INTERNAL_DASHBOARD_FIXTURES.installs.items.map((install) => install.status))).toEqual(
      expect.objectContaining(new Set(['completed', 'failed', 'in_progress', 'degraded'])),
    );
    expect(INTERNAL_DASHBOARD_FIXTURES.installs.items.some((install) => install.userId === undefined)).toBe(true);
    expect(new Set(INTERNAL_DASHBOARD_FIXTURES.devices.items.map((device) => device.state))).toEqual(
      new Set(['active', 'offline', 'revoked']),
    );
    expect(INTERNAL_DASHBOARD_FIXTURES.errors.items.some((error) => error.errorCode === 'BACKGROUND_SERVICE_START_FAILED')).toBe(true);
    expect(INTERNAL_DASHBOARD_FIXTURES.errors.items.some((error) => error.errorCode === 'DEVICE_AUTH_TIMEOUT')).toBe(true);
  });

  it('renders a findings-first overview with Tufte-clean charts and direct labels', () => {
    const html = renderInternalUserDashboard({ pathname: '/users', assetMode: 'inline', fixtureMode: true });

    expect(html).toContain('class="workspace-window"');
    expect(html).toContain('data-workspace-shell');
    expect(html).toContain('data-workspace-chrome');
    expect(html).toContain('data-workspace-route-trigger');
    expect(html).toContain('people have joined Consuelo');
    expect(html).toContain('Activation progression');
    expect(html).toContain('<table class="activation-table"');
    expect(html).toContain('aria-label="Thirty-day signup and install trend');
    expect(html).toContain('data-series-label="Registered"');
    expect(html).toContain('data-series-label="Completed"');
    expect(html).not.toContain('<legend');
    expect(html).not.toContain('class="chart-grid');
    expect(html).toContain('aria-label="Install failures ranked by error code');
    expect(html).toContain('BACKGROUND SERVICE START FAILED');
  });

  it('renders text status semantics, current navigation, and install evidence without mutation controls', () => {
    const users = renderInternalUserDashboard({ pathname: '/users', assetMode: 'inline', fixtureMode: true });
    const install = renderInternalUserDashboard({
      pathname: '/installs/ins_22222222-2222-4222-8222-222222222222',
      assetMode: 'inline',
      fixtureMode: true,
    });

    expect(users).toContain('aria-current="page"');
    expect(users).toContain('status-text');
    expect(users).toContain('Active');
    expect(install).toContain('Install timeline');
    expect(install).toContain('Sentry evidence');
    expect(install).toContain('Cloudflare trace');
    expect(install).toContain('Diagnostic bundle');
    expect(install).not.toContain('Revoke device');
    expect(install).not.toContain('Delete user');
    expect(install).not.toContain('Retry install');
  });

  it('renders a bounded enrollment reset control without destructive user actions', () => {
    const devices = renderInternalUserDashboard({
      pathname: '/devices',
      assetMode: 'inline',
      fixtureMode: true,
    });

    expect(devices).toContain('data-enrollment-reset');
    expect(devices).toContain('data-workspace-host="maya.consuelohq.com"');
    expect(devices).toContain('Reset workspace enrollment');
    expect(devices).not.toContain('Delete user');
    expect(devices).not.toContain('Delete workspace');
  });

  it('authors responsive, reduced-motion, and light/dark screen behavior explicitly', () => {
    expect(INTERNAL_DASHBOARD_CSS).toContain('--dash-bg: #151515');
    expect(INTERNAL_DASHBOARD_CSS).toContain('--site-color-paper: var(--dash-bg)');
    expect(INTERNAL_DASHBOARD_CSS).toContain('#fffff8');
    expect(INTERNAL_DASHBOARD_CSS).toContain('@media (max-width: 760px)');
    expect(INTERNAL_DASHBOARD_CSS).toContain('@media (max-width: 420px)');
    expect(INTERNAL_DASHBOARD_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(INTERNAL_DASHBOARD_CSS).toContain('@media (prefers-color-scheme: light)');
    expect(INTERNAL_DASHBOARD_CSS).not.toContain('box-shadow:');
    expect(INTERNAL_DASHBOARD_CSS).not.toContain('linear-gradient');
  });
});
