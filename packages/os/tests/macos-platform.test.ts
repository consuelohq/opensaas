import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('macOS menu-bar platform', () => {
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
    expect(source).toContain('Operation:');
    expect(source).toContain('Remove node registration');
    expect(source).toContain('Remove user content');
    expect(source).not.toContain('launchctl');
    expect(source).not.toContain('Process(');
    expect(source).not.toContain('/bin/');
  });

  it('packages an unsigned development app without installation or production signing', async () => {
    const script = await readFile(
      resolve(packageRoot, 'scripts/testing/macos-alpha-package.sh'),
      'utf8',
    );

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

  it('documents the service boundary and human-only install checkpoint', async () => {
    const docs = await readFile(
      resolve(packageRoot, 'docs/macos-platform.md'),
      'utf8',
    );

    expect(docs).toContain('does not supervise');
    expect(docs).toContain('Closing the app');
    expect(docs).toContain('Human checkpoint');
    expect(docs).toContain('macos-26');
  });
});
