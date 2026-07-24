import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type CutoverManifest = {
  evidence: {
    sandboxInstallation: boolean;
    sandboxIframe: boolean;
    sandboxResourceQueries: boolean;
    sandboxWriteback: boolean;
    liveHumanWinner: boolean;
  };
  compatibility: {
    legacyProviderApiRoutes: 'preserved' | 'removed';
    legacyTwentyDialerAdapters: 'preserved' | 'removed';
    legacyTwentyClickToCallAsset: 'preserved' | 'removed';
  };
};

const root = resolve(import.meta.dir, '../../..');
const manifest = JSON.parse(
  readFileSync(
    resolve(import.meta.dir, '../compatibility-cutover.json'),
    'utf8',
  ),
) as CutoverManifest;

const legacyClickAsset = resolve(
  root,
  'packages/twenty-front/public',
  `consuelo-${String.fromCharCode(103, 104, 108)}-click-to-call.js`,
);

describe('dialer compatibility cutover guard', () => {
  it('preserves legacy provider API routes until sandbox installation, resources, and writeback have parity', () => {
    const parity =
      manifest.evidence.sandboxInstallation &&
      manifest.evidence.sandboxResourceQueries &&
      manifest.evidence.sandboxWriteback;
    if (!parity) {
      expect(manifest.compatibility.legacyProviderApiRoutes).toBe('preserved');
      expect(existsSync(resolve(root, 'packages/api/src/routes/ghl.ts'))).toBe(
        true,
      );
    }
  });

  it('preserves Twenty call adapters until the standalone human-winner path is proven', () => {
    if (!manifest.evidence.liveHumanWinner) {
      expect(manifest.compatibility.legacyTwentyDialerAdapters).toBe(
        'preserved',
      );
      expect(
        existsSync(
          resolve(
            root,
            'packages/twenty-server/src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver.ts',
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          resolve(
            root,
            'packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.ts',
          ),
        ),
      ).toBe(true);
    }
  });

  it('preserves the legacy click-to-call asset until the installed iframe is proven', () => {
    if (!manifest.evidence.sandboxIframe) {
      expect(manifest.compatibility.legacyTwentyClickToCallAsset).toBe(
        'preserved',
      );
      expect(existsSync(legacyClickAsset)).toBe(true);
    }
  });
});
