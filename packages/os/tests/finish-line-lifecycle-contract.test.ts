import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = join(import.meta.dirname, '..');
const read = (relativePath: string): string =>
  readFileSync(join(packageRoot, relativePath), 'utf8');

describe('Consuelo finish-line lifecycle contract', () => {
  it('keeps app-local MCP processes as thin authenticated bridges to the host daemon', () => {
    const stdio = read('scripts/mcp-stdio.ts');
    const bridge = read('scripts/lib/local-agent-mcp-bridge.ts');

    expect(stdio).toContain("from './lib/local-agent-mcp-bridge'");
    expect(stdio).not.toContain("from './lib/mcp-gateway'");
    expect(stdio).not.toContain("from './lib/facade/executor'");
    expect(stdio).toContain('Buffer.concat');
    expect(bridge).toContain('CONSUELO_NODE_UNAVAILABLE');
    expect(bridge).toContain("hostname !== '127.0.0.1'");
    expect(bridge).toContain("protocol !== 'http:'");
    expect(bridge).toContain("'x-consuelo-agent-id'");
  });

  it('resolves the installed MCP bridge through the active hosted runtime', () => {
    const connectivity = read('scripts/lib/local-agent-connectivity.ts');

    expect(connectivity).toContain('runtime/current/scripts/mcp-stdio.ts');
    expect(connectivity).toContain('scripts/mcp-stdio.ts');
    expect(connectivity.indexOf('runtime/current/scripts/mcp-stdio.ts')).toBeLessThan(
      connectivity.indexOf('scripts/mcp-stdio.ts', connectivity.indexOf('runtime/current/scripts/mcp-stdio.ts') + 1),
    );
    expect(connectivity).not.toContain('runtime/current/packages/os/scripts/mcp-stdio.ts');
    expect(connectivity).not.toContain('exec bun ./scripts/mcp-stdio.ts');
  });

  it('publishes the main local MCP as Consuelo and removes the legacy name', () => {
    const connectivity = read('scripts/lib/local-agent-connectivity.ts');

    expect(connectivity).toContain("const CONSUELO_MCP_NAME = 'os'");
    expect(connectivity).toContain("'consuelo', 'consuelo-os'");
    expect(connectivity).toContain("path.join(home, 'bin', 'consuelo-mcp')");
    expect(connectivity).toContain('CONSUELO_AGENT_ID');
    expect(connectivity).toContain('remove legacy');
  });

  it('defaults unattended installation to detected agents and managed daemons', () => {
    const installer = read('scripts/install.ts');
    const bootstrap = read('scripts/bootstrap.sh');

    expect(installer).toContain("'--skip-agents'");
    expect(installer).toContain('options.yes || options.json');
    expect(installer).toContain('detectedAgents.map((agent) => agent.name)');
    expect(installer).toContain('installDaemons = !options.skipDaemons');
    expect(bootstrap).toContain('INSTALL_DAEMONS=1');
    expect(bootstrap).toContain('install_args+=(--install-daemons)');
  });

  it('places managed loopback Caddy between the Cloudflare tunnel and private Bun', () => {
    const state = read('scripts/lib/install-state.ts');
    const gateway = read('scripts/lib/security-gateway.ts');

    expect(state).toContain('const DEFAULT_INGRESS_PORT = 46320');
    expect(state).toContain('local-agent-mcp.json');
    expect(state).toContain('const localServiceUrl = `http://127.0.0.1:${input.port}`');
    expect(gateway).toContain('bind 127.0.0.1');
    expect(gateway).toContain('auto_https off');
    expect(gateway).toContain('reverse_proxy ${input.upstream.host}:${input.upstream.port}');
  });

  it('pins, verifies, installs, supervises, and uninstalls Caddy', () => {
    const bootstrap = read('scripts/bootstrap.sh');
    const generator = read('scripts/generate-system-daemons.sh');
    const installer = read('scripts/install-system-daemons.sh');
    const uninstaller = read('scripts/uninstall-system-daemons.sh');
    const runner = read('scripts/start-caddy-daemon.sh');

    expect(bootstrap).toContain('CADDY_VERSION="2.11.4"');
    expect(bootstrap).toContain('CADDY_DARWIN_ARM64_SHA256');
    expect(generator).toContain('com.consuelo.caddy');
    expect(installer).toContain('start-caddy-daemon.sh');
    expect(installer.indexOf('workspace_label')).toBeLessThan(installer.indexOf('caddy_label'));
    expect(installer.indexOf('caddy_label')).toBeLessThan(installer.indexOf('cloudflared_label'));
    expect(uninstaller).toContain('com.consuelo.caddy');
    expect(runner).toContain('"$caddy_bin" validate');
    expect(runner).toContain('exec "$caddy_bin" run');
  });

  it('recovers the pinned Caddy binary from flattened install state', () => {
    const installer = read('scripts/install-system-daemons.sh');

    expect(installer).toContain('state_env_file="$consuelo_data_home/.env"');
    expect(installer).toContain('load_env_file "$state_env_file"');
    expect(installer).toContain('managed_caddy_bin="$consuelo_data_home/bin/caddy"');
  });

  it('retires only recognized conflicting Portless services and scrubs inherited secrets', () => {
    const generator = read('scripts/generate-system-daemons.sh');
    const installer = read('scripts/install-system-daemons.sh');
    const reload = read('scripts/consuelo-reload.js');
    const runtime = read('scripts/start-consuelo-daemon.sh');
    const portless = read('scripts/start-portless-daemon.sh');
    const caddy = read('scripts/start-caddy-daemon.sh');

    expect(generator).toContain('PORTLESS_ENABLED:-0');
    expect(installer).toContain('com.consuelo.portless');
    expect(installer).toContain('com.consuelo.portless.system');
    expect(installer).toContain('portless-backup');
    for (const source of [runtime, portless, caddy]) {
      expect(source).toContain('unset WORKSPACE_MCP_TOKEN');
    }
    expect(reload).toContain("runBestEffort('launchctl', ['unsetenv', 'WORKSPACE_MCP_TOKEN'])");
    expect(runtime).toContain('unset INTERNAL_CONSUELO_API_KEY');
    expect(caddy).toContain('unset CLOUDFLARE_API_TOKEN');
  });

  it('verifies configured local agents only after the host daemon is healthy', () => {
    const installer = read('scripts/install-system-daemons.sh');
    const verifier = read('scripts/verify-local-agents.ts');

    expect(installer).toContain('verify-local-agents.ts');
    expect(installer.indexOf('wait_for_workspace_health')).toBeLessThan(
      installer.indexOf('verify-local-agents.ts'),
    );
    expect(verifier).toContain('verifyLocalAgents');
    expect(verifier).toContain('previouslyVerified');
  });

  it('returns a transport-valid retryable JSON-RPC response while a node restarts', () => {
    const edge = read('scripts/lib/workspace-cloudflare-edge-router.ts');

    expect(edge).toContain('CONSUELO_NODE_UNAVAILABLE');
    expect(edge).toContain("'retry-after': '2'");
    expect(edge).toContain("'cache-control': 'no-store'");
    expect(edge).toContain("jsonrpc: '2.0'");
    expect(edge).toContain('retryable: true');
  });
});
