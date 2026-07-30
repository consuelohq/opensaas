import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  reconcileManagedUserContent,
  USER_STEERING_EXAMPLE,
  USER_SYSTEM_PROMPT,
} from '../scripts/lib/managed-user-content';
import {
  ensureNodeEncryptionKeyForHome,
  reconcileManagedUserContentForRelease,
  resolveVisibleUserRoot,
} from '../scripts/lib/managed-user-content-release';

let userRoot: string;
let releasePath: string;

const tools = [
  { name: 'git.status', description: 'show working tree status' },
  { name: 'artifacts.check', description: 'run boundary checks' },
];

const at = (...parts: string[]) => path.join(userRoot, ...parts);
const read = (...parts: string[]) => fs.readFileSync(at(...parts), 'utf8');

const reconcile = () => reconcileManagedUserContent({ userRoot, tools });

/** Stands in for a runtime release directory as shipped in the bundle. */
const writeRelease = (toolNames: string[], skills: string[]): void => {
  const manifestDir = path.join(releasePath, 'manifests', 'generated');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, 'tool.manifest.json'),
    JSON.stringify({ tools: toolNames.map((name) => ({ name })) }),
  );
  fs.mkdirSync(path.join(releasePath, 'skills'), { recursive: true });
  fs.writeFileSync(
    path.join(releasePath, 'skills', 'skills.json'),
    JSON.stringify({ version: 1, skills: skills.map((name) => ({ name })) }),
  );
};

beforeEach(() => {
  userRoot = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-user-content-')),
    'Consuelo',
  );
  releasePath = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-release-'));
});

afterEach(() => {
  fs.rmSync(path.dirname(userRoot), { recursive: true, force: true });
  fs.rmSync(releasePath, { recursive: true, force: true });
});

describe('managed user content', () => {
  describe('fresh install', () => {
    it('creates the system prompt, the example, and the tool catalog', () => {
      const actions = reconcile();

      expect(fs.existsSync(at('Steering', USER_SYSTEM_PROMPT))).toBe(true);
      expect(fs.existsSync(at('Steering', USER_STEERING_EXAMPLE))).toBe(true);
      expect(fs.existsSync(at('Tools', 'TOOLS.md'))).toBe(true);
      expect(actions.every((action) => action.status === 'created')).toBe(true);
    });

    it('writes everything owner-only', () => {
      reconcile();
      for (const file of [
        at('Steering', USER_SYSTEM_PROMPT),
        at('Steering', USER_STEERING_EXAMPLE),
        at('Tools', 'TOOLS.md'),
      ]) {
        expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      }
    });

    it('lists the runtime tools in the catalog, sorted', () => {
      reconcile();
      const catalog = read('Tools', 'TOOLS.md');
      expect(catalog.indexOf('artifacts.check')).toBeLessThan(
        catalog.indexOf('git.status'),
      );
      expect(catalog).toContain('show working tree status');
    });

    it('points the user at the example and tells them to steal from it', () => {
      reconcile();
      const prompt = read('Steering', USER_SYSTEM_PROMPT);
      expect(prompt).toContain(USER_STEERING_EXAMPLE);
      expect(prompt).toContain('steal');
    });

    it('marks the example as never loaded', () => {
      reconcile();
      const example = read('Steering', USER_STEERING_EXAMPLE);
      expect(example).toContain('never loaded');
      expect(example).toContain(USER_SYSTEM_PROMPT);
    });
  });

  describe('update, the path a real user takes', () => {
    it('never overwrites the user system prompt', () => {
      reconcile();
      fs.writeFileSync(
        at('Steering', USER_SYSTEM_PROMPT),
        '# Mine\n\nAlways use tabs.\n',
      );

      reconcile();

      expect(read('Steering', USER_SYSTEM_PROMPT)).toBe(
        '# Mine\n\nAlways use tabs.\n',
      );
    });

    it('reports the preserved prompt as preserve-custom', () => {
      reconcile();
      const second = reconcile();
      const prompt = second.find((action) =>
        action.path.endsWith(USER_SYSTEM_PROMPT),
      );
      expect(prompt).toMatchObject({
        ownership: 'preserve-custom',
        status: 'preserved',
      });
    });

    it('refreshes the catalog when the runtime tools change', () => {
      reconcile();
      const actions = reconcileManagedUserContent({
        userRoot,
        tools: [{ name: 'brand.new.tool', description: 'added by an update' }],
      });

      expect(read('Tools', 'TOOLS.md')).toContain('brand.new.tool');
      expect(read('Tools', 'TOOLS.md')).not.toContain('git.status');
      expect(
        actions.find((action) => action.path.endsWith('TOOLS.md')),
      ).toMatchObject({ ownership: 'update-clean', status: 'updated' });
    });

    it('restores the example if the user deletes it', () => {
      reconcile();
      fs.rmSync(at('Steering', USER_STEERING_EXAMPLE));
      reconcile();
      expect(fs.existsSync(at('Steering', USER_STEERING_EXAMPLE))).toBe(true);
    });

    it('is idempotent: a second run changes nothing', () => {
      reconcile();
      const actions = reconcile();
      expect(
        actions.every((action) =>
          ['preserved', 'unchanged'].includes(action.status),
        ),
      ).toBe(true);
    });

    it('removes the superseded BUILT_INS.md catalog', () => {
      fs.mkdirSync(at('Tools'), { recursive: true });
      fs.writeFileSync(at('Tools', 'BUILT_INS.md'), '# old catalog\n');

      reconcile();

      expect(fs.existsSync(at('Tools', 'BUILT_INS.md'))).toBe(false);
      expect(fs.existsSync(at('Tools', 'TOOLS.md'))).toBe(true);
    });

    it('seeds content into a home that predates it, which is the upgrade case', () => {
      // An existing install has the directories but none of the managed content, because
      // provisioning only ever ran during install.
      fs.mkdirSync(at('Steering'), { recursive: true });
      fs.mkdirSync(at('Tools'), { recursive: true });

      reconcile();

      expect(fs.existsSync(at('Steering', USER_SYSTEM_PROMPT))).toBe(true);
      expect(fs.existsSync(at('Tools', 'TOOLS.md'))).toBe(true);
    });
  });

  describe('reconciling against a release directory', () => {
    it('reads the catalog and skills index out of the activated release', () => {
      writeRelease(['release.tool.a', 'release.tool.b'], ['task', 'sites']);

      reconcileManagedUserContentForRelease({ releasePath, userRoot });

      expect(read('Tools', 'TOOLS.md')).toContain('release.tool.a');
      expect(JSON.parse(read('Skills', 'skills.json')).skills).toHaveLength(2);
    });

    it('tracks a newer release on a subsequent update', () => {
      writeRelease(['old.tool'], ['task']);
      reconcileManagedUserContentForRelease({ releasePath, userRoot });

      writeRelease(['new.tool'], ['task', 'sites', 'browser']);
      reconcileManagedUserContentForRelease({ releasePath, userRoot });

      expect(read('Tools', 'TOOLS.md')).toContain('new.tool');
      expect(read('Tools', 'TOOLS.md')).not.toContain('old.tool');
      expect(JSON.parse(read('Skills', 'skills.json')).skills).toHaveLength(3);
    });

    it('still seeds the system prompt when the release has no manifest', () => {
      expect(() =>
        reconcileManagedUserContentForRelease({ releasePath, userRoot }),
      ).not.toThrow();
      expect(fs.existsSync(at('Steering', USER_SYSTEM_PROMPT))).toBe(true);
    });

    it('honours CONSUELO_USER_HOME when resolving the visible root', () => {
      expect(resolveVisibleUserRoot('/tmp/somewhere')).toBe(
        path.join('/tmp/somewhere', 'Consuelo'),
      );
    });
  });
});

describe('node encryption key on update', () => {
  let home: string;

  const writeIdentity = (workspaceId: string, nodeId: string): void => {
    fs.writeFileSync(
      path.join(home, 'consuelo.yaml'),
      `version: 1\nactiveWorkspace: ${workspaceId}\nactiveNode: ${nodeId}\n`,
    );
  };

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-key-home-'));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('mints a key for a home that reached this state through update', () => {
    writeIdentity('workspace_internal', 'node_existing');
    const published = ensureNodeEncryptionKeyForHome(home);

    expect(published).toEqual(expect.any(String));
    expect(JSON.parse(published!).crv).toBe('X25519');
    expect(
      fs.existsSync(
        path.join(home, 'node', 'security', 'generated', 'node-encryption-key.json'),
      ),
    ).toBe(true);
  });

  it('reuses an existing key rather than rotating and orphaning sealed credentials', () => {
    writeIdentity('workspace_internal', 'node_existing');
    const first = ensureNodeEncryptionKeyForHome(home);
    const second = ensureNodeEncryptionKeyForHome(home);
    expect(second).toBe(first);
  });

  it('returns undefined before onboarding has set an identity', () => {
    expect(ensureNodeEncryptionKeyForHome(home)).toBeUndefined();
    writeIdentity('workspace_internal', '');
    expect(ensureNodeEncryptionKeyForHome(home)).toBeUndefined();
  });

  it('does not throw when the home is unusable, so a release is never failed by it', () => {
    writeIdentity('workspace_internal', 'node_existing');
    ensureNodeEncryptionKeyForHome(home);
    fs.writeFileSync(
      path.join(home, 'node', 'security', 'generated', 'node-encryption-key.json'),
      'not json',
    );
    expect(() => ensureNodeEncryptionKeyForHome(home)).not.toThrow();
  });
});

describe('engine does not touch a real home', () => {
  it('skips reconciliation when no visible user root is supplied', async () => {
    // Regression: the engine defaulted this from os.homedir(), so any test constructing it without
    // isolating HOME wrote managed content into the developer's actual ~/Consuelo.
    const { createLifecycleEngine } = await import(
      '../scripts/lib/lifecycle/engine'
    );
    const engine = createLifecycleEngine({
      home: fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-engine-home-')),
    } as never);
    expect(engine).toBeDefined();
    // The dependency is optional and absent, so nothing can be written outside the temp home.
    expect(
      (engine as unknown as { visibleUserRoot?: string }).visibleUserRoot,
    ).toBeUndefined();
  });

  it('writes only under the supplied root', () => {
    const scoped = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-scoped-')),
      'Consuelo',
    );
    writeRelease(['scoped.tool'], ['task']);
    reconcileManagedUserContentForRelease({ releasePath, userRoot: scoped });

    expect(fs.existsSync(path.join(scoped, 'Tools', 'TOOLS.md'))).toBe(true);
    fs.rmSync(path.dirname(scoped), { recursive: true, force: true });
  });
});
