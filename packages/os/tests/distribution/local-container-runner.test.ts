import { describe, expect, it } from 'vitest';

import {
  classifyLocalContainerFailure,
  createLocalContainerCommand,
  selectLocalContainerEngine,
} from '../../scripts/testing/distribution/local-container-runner';

describe('local distribution container runner', () => {
  it('should prefer Apple Container when both supported engines are installed', () => {
    const engine = selectLocalContainerEngine((command) =>
      command === 'container' || command === 'docker'
        ? `/usr/local/bin/${command}`
        : null,
    );

    expect(engine).toEqual({
      command: '/usr/local/bin/container',
      kind: 'apple-container',
    });
  });

  it('should use Docker when Apple Container is unavailable', () => {
    const engine = selectLocalContainerEngine((command) =>
      command === 'docker' ? '/usr/local/bin/docker' : null,
    );

    expect(engine).toEqual({
      command: '/usr/local/bin/docker',
      kind: 'docker',
    });
  });

  it('should return a clear skip when no supported engine is installed', () => {
    expect(selectLocalContainerEngine(() => null)).toBeNull();
  });

  it('should run the same read-only OCI fixture for either engine', () => {
    const command = createLocalContainerCommand({
      engine: {
        command: '/usr/local/bin/container',
        kind: 'apple-container',
      },
      repoRoot: '/tmp/opensaas',
    });

    expect(command).toEqual([
      '/usr/local/bin/container',
      'run',
      '--rm',
      '--volume',
      '/tmp/opensaas:/workspace:ro',
      '--workdir',
      '/workspace',
      'docker.io/oven/bun:1.3.14',
      'bun',
      'packages/os/scripts/testing/distribution/environment-probe.ts',
      '--json',
    ]);
  });

  it('should skip locally when the installed Docker CLI has no running daemon', () => {
    expect(
      classifyLocalContainerFailure(
        'Cannot connect to the Docker daemon at unix:///tmp/docker.sock',
      ),
    ).toEqual({
      reason: 'Docker is installed, but its local daemon is not running.',
      status: 'skipped',
    });
  });
});
