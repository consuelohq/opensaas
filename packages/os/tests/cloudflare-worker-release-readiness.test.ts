import { describe, expect, it } from 'vitest';

import {
  assertRequiredCloudflareWorkerSecrets,
  deployCloudflareWorker,
} from '../scripts/lib/cloudflare-worker-release-readiness';

describe('Cloudflare Worker release readiness', () => {
  it('allows deployment with the optional internal dashboard disabled', async () => {
    const commands: string[][] = [];
    await deployCloudflareWorker({
      target: 'workspace-edge',
      runner: async ({ argv }) => {
        commands.push(argv);
        return argv[1] === 'secret'
          ? {
              exitCode: 0,
              stdout: JSON.stringify([
                { name: 'CONSUELO_EDGE_SIGNING_SECRET' },
                { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET' },
              ]),
              stderr: '',
            }
          : { exitCode: 0, stdout: '', stderr: '' };
      },
    });
    expect(commands[1]).toEqual([
      'wrangler',
      'deploy',
      '--config',
      'cloudflare/workspace-edge/wrangler.toml',
    ]);
  });

  it('validates required secrets before issuing deployment', async () => {
    const commands: string[][] = [];
    await deployCloudflareWorker({
      target: 'os-device-authority',
      runner: async ({ argv }) => {
        commands.push(argv);
        return argv[1] === 'secret'
          ? {
              exitCode: 0,
              stdout: JSON.stringify({ secrets: [
                { name: 'CLOUDFLARE_API_TOKEN' },
                { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET' },
                { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET' },
                { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET' },
              ] }),
              stderr: '',
            }
          : { exitCode: 0, stdout: '', stderr: '' };
      },
    });
    expect(commands[1]).toEqual([
      'wrangler',
      'deploy',
      '--config',
      'cloudflare/os-device-authority/wrangler.toml',
    ]);
  });

  it('rejects malformed metadata without exposing secret values', () => {
    expect(() => assertRequiredCloudflareWorkerSecrets(
      'workspace-edge',
      'not-json',
    )).toThrow('Workspace edge secret list response was not valid JSON');
  });
});
