import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('macOS menu-bar platform', () => {
  it('should use SwiftUI MenuBarExtra when rendering the thin lifecycle client', async () => {
    const source = await readFile(
      resolve(
        packageRoot,
        'native/macos/Sources/ConsueloMenuBarApp/main.swift',
      ),
      'utf8',
    );

    expect(source).toContain('MenuBarExtra');
    expect(source).toContain('LifecycleClient');
    expect(source).toContain('ReleaseChannel.userSelectableCases');
    expect(source).not.toContain('ForEach(ReleaseChannel.allCases');
    expect(source).not.toContain('Button("Destructive repair…")');
    expect(source).toContain('DiagnosticsRedactor.redactText(message)');
    expect(source).toContain('Operation:');
    expect(source).toContain('if snapshot.actions.repair');
    expect(source).toContain('if snapshot.actions.restart');
    expect(source).toContain('if snapshot.actions.uninstall');
    expect(source.match(/Button\(\"Refresh\"\)/g)).toHaveLength(1);
    expect(source).toContain('@Published private(set) var presentation');
    expect(source).toContain('Remove node registration');
    expect(source).toContain('Remove user content');
    expect(source).not.toContain('launchctl');
    expect(source).not.toContain('Process(');
    expect(source).not.toContain('/bin/');
  });

  it('should package an unsigned development app when running the alpha build lane', async () => {
    const scriptPath = resolve(
      packageRoot,
      'scripts/testing/macos-alpha-package.sh',
    );
    const script = await readFile(scriptPath, 'utf8');
    expect(script).toContain('Consuelo.app/Contents/MacOS');
    expect(script).toContain('Info.plist');
    expect(script).toContain('swift build');
    expect(script).toContain('Consuelo.app.tar.gz');
    expect(script).toContain('tar -czf');
    expect(script).not.toContain('/Applications');
    expect(script).not.toContain('Developer ID Application');
    expect(script).not.toContain('notarytool');
    expect(script).not.toContain('launchctl');
  });

  it('should document the service boundary when describing the human checkpoint', async () => {
    const docs = await readFile(
      resolve(packageRoot, 'docs/macos-platform.md'),
      'utf8',
    );

    expect(docs).toContain('does not supervise');
    expect(docs).toContain('Closing the app');
    expect(docs).toContain('Human checkpoint');
    expect(docs).toContain('macos-26');
    expect(docs).toContain('tar -xzf Consuelo.app.tar.gz');
    expect(docs).toContain('approved test environment');
    expect(docs).not.toContain("Ko's Mac");
  });

  it('should start the owner-local lifecycle endpoint when the installed Bun daemon launches', async () => {
    const main = await readFile(
      resolve(packageRoot, 'scripts/server/main.ts'),
      'utf8',
    );
    const endpoint = await readFile(
      resolve(packageRoot, 'scripts/lib/native-lifecycle-endpoint.ts'),
      'utf8',
    );

    expect(main).toContain('startDefaultNativeLifecycleEndpoint');
    expect(main).toContain('lifecycle endpoint unavailable');
    expect(main).toContain("registerSignal('SIGINT'");
    expect(main).toContain("registerSignal('SIGTERM'");
    expect(endpoint).toContain('createDefaultLifecycleEngine');
    expect(endpoint).toContain('createServer');
    expect(endpoint).toContain('0o600');
    expect(endpoint).toContain('NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES');

    const transport = await readFile(
      resolve(
        packageRoot,
        'native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift',
      ),
      'utf8',
    );
    expect(transport).toContain('O_NONBLOCK');
    expect(transport).toContain('Darwin.poll');
    expect(transport).toContain('SO_ERROR');
  });

  it('should exclude scratch dumps when repository artifacts are discovered', async () => {
    const repositoryRoot = resolve(packageRoot, '../..');
    const ignore = await readFile(resolve(repositoryRoot, '.gitignore'), 'utf8');
    expect(ignore).toContain('/.tmp-*');
    expect(existsSync(resolve(repositoryRoot, '.tmp-native-lock-failures.txt'))).toBe(false);
  });
});
