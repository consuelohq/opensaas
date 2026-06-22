import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readBootstrap = () => readFileSync(join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8');

describe('bootstrap source refresh controls', () => {
  it('declares the public installer dependency model explicitly', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('MACOS_EXPECTED_SYSTEM_TOOLS=(');
    expect(bootstrap).toContain('INSTALLER_MANAGED_RUNTIME_BINARIES=(');
    expect(bootstrap).toContain('PACKAGE_MANAGED_DEPENDENCIES_DESCRIPTION=');
    expect(bootstrap).toContain('OPERATOR_ONLY_TOOLS=(');
    expect(bootstrap).toContain('curl');
    expect(bootstrap).toContain('portless');
    expect(bootstrap).toContain('cloudflared');
    expect(bootstrap).toContain('wrangler');
  });

  it('documents an explicit source refresh option', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('--refresh-source');
    expect(bootstrap).toContain('REFRESH_SOURCE');
    expect(bootstrap).toContain('SOURCE_STATUS="refreshed"');
  });

  it('asks for local or cloud before dependency setup', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('choose_os_mode');
    expect(bootstrap).toContain('Choose Consuelo OS mode:');
    expect(bootstrap).toContain('1) local');
    expect(bootstrap).toContain('2) cloud');
    expect(bootstrap).toContain('CONTACT_URL="https://consuelohq.com/contact/"');
    expect(bootstrap).toContain('open_contact_url');

    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('prompt_dependency_setup'),
    );
    expect(bootstrap.indexOf('choose_os_mode')).toBeLessThan(
      bootstrap.indexOf('ensure_bun'),
    );
  });

  it('exits the cloud path before source download or dependency install', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('handle_cloud_mode');
    expect(bootstrap).toContain('Consuelo cloud is handled by the Consuelo team. Opening the contact page.');
    expect(bootstrap).toContain('exit 0');
    expect(bootstrap).toContain('OS_MODE="cloud"');
    expect(bootstrap).toContain('handle_cloud_mode');

    expect(bootstrap.indexOf('handle_cloud_mode')).toBeLessThan(
      bootstrap.indexOf('resolve_source'),
    );
    expect(bootstrap.indexOf('handle_cloud_mode')).toBeLessThan(
      bootstrap.indexOf('ensure_dependencies'),
    );
  });

  it('uses one dependency gate before the Bun onboarding UI for local installs', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('Consuelo OS needs its dependencies to continue.');
    expect(bootstrap).toContain('render_dependency_progress');
    expect(bootstrap).toContain('● dependencies');
    expect(bootstrap).toContain('○ home');
    expect(bootstrap).toContain('○ skills');
    expect(bootstrap).toContain('○ artifacts');
    expect(bootstrap).toContain('○ agents');
    expect(bootstrap).toContain('○ health');
    expect(bootstrap).not.toContain('Consuelo OS needs the local runtime source to continue.');
    expect(bootstrap).not.toContain('Consuelo OS needs its local runtime dependencies to continue.');
    expect(bootstrap).not.toContain('We can download/setup this now.');
    expect(bootstrap).not.toContain('We can install/setup this now.');
  });

  it('pins cloudflared darwin archive checksums to the currently served release assets', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain(
      'CLOUDFLARED_DARWIN_ARM64_SHA256="f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d"',
    );
    expect(bootstrap).toContain(
      'CLOUDFLARED_DARWIN_AMD64_SHA256="d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b"',
    );
  });
});
