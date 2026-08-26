import { describe, expect, it } from 'vitest';

import { CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS } from '../scripts/lib/consuelo-sites-secrets-adapter';
import { generateNodeEncryptionKeyPair, openSealedCredential } from '../scripts/lib/node-credential-sealing';
import { secretsClientScript } from '../scripts/lib/secrets-site';
import { renderConfigurationSite } from '../scripts/lib/settings-site';
import { createWorkspaceEdgeRouteSeedSql } from '../scripts/lib/workspace-edge-route-seed';

describe('secrets surface is backed by the node sealed store', () => {
  it('registers read and sealed-write services scoped to the secrets site', () => {
    expect(CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS).toHaveLength(2);
    expect(CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'secrets',
        capability: 'secrets-read',
        serviceName: 'secrets-sites-read-endpoints',
        gatewayRouteFamily: '/gateway/secrets/*',
        publicSiteRouteFamily: '/secrets/*',
      }),
      expect.objectContaining({
        site: 'secrets',
        capability: 'secrets-write',
        serviceName: 'secrets-sites-write-endpoints',
        gatewayRouteFamily: '/gateway/secrets/*',
        publicSiteRouteFamily: '/secrets/*',
      }),
    ]));
  });

  it('seeds read and sealed-write /gateway/secrets routes for a workspace session', () => {
    const sql = createWorkspaceEdgeRouteSeedSql({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      siteSnapshotKey: 'sites/workspace_internal/launcher/v1/index.html',
      siteVersionId: 'v1',
      publishedSiteIds: ['launcher'],
      siteContentHashes: { launcher: 'a'.repeat(64) },
    }).replace(/\\/g, '');

    expect(sql).toContain('\"pathPrefix\":\"/gateway/secrets/install\",\"auth\":\"workspace-session\"');
    expect(sql).toContain('\"serviceName\":\"secrets-sites-write-endpoints\"');
    expect(sql).toContain('\"pathPrefix\":\"/gateway/secrets\",\"auth\":\"workspace-session\"');
    expect(sql).toContain('\"serviceName\":\"secrets-sites-read-endpoints\"');
  });
});

describe('secrets page is a compact sealed-credential manager', () => {
  const html = renderConfigurationSite('secrets');

  it('renders a Railway-like inventory with search and an obvious add action', () => {
    expect(html).toContain('id="secret-search"');
    expect(html).toContain('id="add-secret-button"');
    expect(html).toContain('+ New secret');
    expect(html).toContain('id="secret-rows"');
    expect(html).toContain('id="secret-dialog"');
    expect(html).toContain('id="secret-binding"');
    expect(html).toContain('id="secret-value"');
    expect(html).toContain('/gateway/secrets/bindings');
    expect(html).toContain('/gateway/secrets/setup');
    expect(html).toContain('/gateway/secrets/install');
    expect(html).toContain("credentials: 'same-origin'");
  });

  it('encrypts in the browser and submits only a sealed envelope', () => {
    expect(html).toContain("name: 'X25519'");
    expect(html).toContain("name: 'HKDF'");
    expect(html).toContain("name: 'AES-GCM'");
    expect(html).toContain('JSON.stringify({ bindingId, envelope })');
    expect(html).not.toContain('JSON.stringify({ bindingId, value })');
    expect(html).not.toContain('JSON.stringify({ bindingId, plaintext })');
  });

  it('stays concise and never renders a reveal or plaintext value surface', () => {
    expect(html).toContain('Encrypted in this browser before it is sent.');
    expect(html).not.toContain('Values are never returned to this page or to an agent. Never paste a credential into an agent conversation.');
    expect(html).not.toContain('Connect credentials to the nodes and tools that need them without exposing secret values to agents.');
    expect(html).not.toMatch(/<th>\s*Value\s*<\/th>/i);
    expect(html).not.toContain('Reveal');
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });


  it('produces a browser WebCrypto envelope the node can open', async () => {
    const script = secretsClientScript().replace(
      'void loadBindings();',
      'globalThis.__consueloTestSealSecret = sealSecret;',
    );
    const fakeDocument = { getElementById: () => null };
    new Function('document', script)(fakeDocument);
    const seal = (globalThis as typeof globalThis & {
      __consueloTestSealSecret?: (setup: Record<string, string>, bindingId: string, plaintext: string) => Promise<unknown>;
    }).__consueloTestSealSecret;
    expect(seal).toBeTypeOf('function');

    const keys = generateNodeEncryptionKeyPair();
    const setup = {
      workspaceId: 'workspace_browser_crypto',
      nodeId: 'node_browser_crypto',
      algorithm: 'X25519',
      publicKeyJwk: keys.publicKeyJwk,
    };
    const bindingId = 'BROWSER_INTEROP_TOKEN';
    const plaintext = 'browser-encrypted-test-value';
    const envelope = await seal!(setup, bindingId, plaintext);
    expect(openSealedCredential({
      recipientPrivateKeyJwk: keys.privateKeyJwk,
      expectedRecipient: { workspaceId: setup.workspaceId, nodeId: setup.nodeId, bindingId },
      envelope: envelope as never,
    })).toBe(plaintext);
    delete (globalThis as typeof globalThis & { __consueloTestSealSecret?: unknown }).__consueloTestSealSecret;
  });
});
