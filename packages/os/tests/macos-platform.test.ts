import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('macOS menu-bar platform', () => {
  it('defines a first-party native service host without making the menu app the supervisor', async () => {
    const packageManifest = await readFile(
      resolve(packageRoot, 'native/macos/Package.swift'),
      'utf8',
    );
    const serviceHost = await readFile(
      resolve(packageRoot, 'native/macos/Sources/ConsueloServiceHost/main.swift'),
      'utf8',
    );

    expect(packageManifest).toContain('.executable(name: "ConsueloServiceHost"');
    expect(packageManifest).toContain('.executableTarget(name: "ConsueloServiceHost"');
    expect(serviceHost).toContain('Process()');
    expect(serviceHost).toContain('start-consuelo-daemon.sh');
    expect(serviceHost).toContain('DispatchSource.makeSignalSource');
    expect(serviceHost).toContain('process.terminate()');
    expect(serviceHost).not.toContain('cloudflared');
    expect(serviceHost).not.toContain('caddy');
  });

  it('uses SwiftUI MenuBarExtra as a thin lifecycle client', async () => {
    const source = await readFile(
      resolve(
        packageRoot,
        'native/macos/Sources/ConsueloMenuBarApp/main.swift',
      ),
      'utf8',
    );

    expect(source).toContain('MenuBarExtra');
    expect(source).toContain('LifecycleClient');
    expect(source).toContain('model.showsUpdateBadge');
    expect(source).toContain('accessibilityLabel("Update available")');
    expect(source).toContain('pendingUpdate');
    expect(source).toContain('Menu("Troubleshooting")');
    expect(source).toContain('Label(');
    expect(source).toContain('model.operationSummary');
    expect(source).not.toContain('Text(DiagnosticsRedactor.redactText(message))');
    expect(source).not.toContain('Text("Operation:');
    expect(source).toContain('WorkspaceNodePresentation');
    expect(source).not.toContain('node.capabilities');
    expect(source).not.toContain('node.agents');
    expect(source).toContain('ReleaseChannel.userSelectableCases');
    expect(source).not.toContain('ForEach(ReleaseChannel.allCases');
    expect(source).not.toContain('Button("Destructive repair…")');
    expect(source).toContain('Remove node registration');
    expect(source).toContain('Remove user content');
    expect(source).not.toContain('launchctl');
    expect(source).not.toContain('Process(');
    expect(source).not.toContain('/bin/');
    expect(source).toContain('MenuBarInstanceLock.acquire');
    expect(source).toContain('isMenuContentEquivalent');
  });

  it('packages an unsigned development app with an opt-in user-local install path', async () => {
    const scriptPath = resolve(
      packageRoot,
      'scripts/testing/macos-alpha-package.sh',
    );
    const script = await readFile(scriptPath, 'utf8');
    expect(script).toContain('Consuelo.app/Contents/MacOS');
    expect(script).toContain('Info.plist');
    expect(script).toContain('swift build');
    expect(script).toContain('--product ConsueloServiceHost');
    expect(script).toContain('Contents/Library/LaunchServices');
    expect(script).toContain('ConsueloServiceHost');
    expect(script).toContain('Consuelo.app.tar.gz');
    expect(script).toContain('tar -czf');
    expect(script).toContain('--install');
    expect(script).toContain('--launch');
    expect(script).toContain('CONSUELO_MAC_APP_INSTALL_DIR');
    expect(script).toContain('$HOME/Applications');
    expect(script).toContain('ditto');
    expect(script).toContain('open "$INSTALLED_APP"');
    expect(script).not.toContain(['su', 'do'].join(''));
    expect(script).not.toContain('INSTALL_ROOT="/Applications"');
    expect(script).not.toContain('Developer ID Application');
    expect(script).not.toContain('notarytool');
    expect(script).not.toContain('launchctl');
  });

  it('documents the service boundary and human-only install checkpoint', async () => {
    const docs = await readFile(
      resolve(packageRoot, 'docs/macos-platform.md'),
      'utf8',
    );

    expect(docs).toContain('does not supervise');
    expect(docs).toContain('Closing the app');
    expect(docs).toContain('Human checkpoint');
    expect(docs).toContain('macos-26');
    expect(docs).toContain('macos-alpha-package.sh --install --launch');
    expect(docs).toContain('~/Applications/Consuelo.app');
  });

  it('starts the owner-local lifecycle endpoint from the installed Bun daemon', async () => {
    const main = await readFile(
      resolve(packageRoot, 'scripts/server/main.ts'),
      'utf8',
    );
    const endpoint = await readFile(
      resolve(packageRoot, 'scripts/lib/native-lifecycle-endpoint.ts'),
      'utf8',
    );

    expect(main).toContain('startDefaultNativeLifecycleEndpoint');
    expect(main.indexOf('startDefaultNativeLifecycleEndpoint();')).toBeLessThan(
      main.indexOf('Bun.serve({'),
    );
    expect(endpoint).toContain('createDefaultLifecycleEngine');
    expect(endpoint).toContain('createServer');
    expect(endpoint).toContain('0o600');
    expect(endpoint).toContain('NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES');
  });

  it('keeps node heartbeat inside the macOS supervisor instead of registering Bun with launchd', async () => {
    const supervisor = await readFile(
      resolve(packageRoot, 'scripts/server/supervisor.ts'),
      'utf8',
    );
    const serverMain = await readFile(
      resolve(packageRoot, 'scripts/server/main.ts'),
      'utf8',
    );
    const supervisedHeartbeat = await readFile(
      resolve(packageRoot, 'scripts/lib/macos-supervised-heartbeat.ts'),
      'utf8',
    );
    const installState = await readFile(
      resolve(packageRoot, 'scripts/lib/install-state.ts'),
      'utf8',
    );

    expect(supervisor).toContain("CONSUELO_OS_HEARTBEAT_OWNER: spec.slot === 0 ? '1' : '0'");
    expect(serverMain).toContain("process.platform === 'darwin'");
    expect(serverMain).toContain('shouldRunMacosSupervisedHeartbeat');
    expect(supervisedHeartbeat).toContain("input.heartbeatOwner === '1'");
    expect(serverMain).toContain('startWorkspaceNodeHeartbeatScheduler');
    expect(installState).not.toContain("message: 'workspace node heartbeat launchd service configured'");
    expect(installState).not.toContain('renderCloudflaredLaunchdPlist({\n            label: heartbeatLabel');
  });
});
