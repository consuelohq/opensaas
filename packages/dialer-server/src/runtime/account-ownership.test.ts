import { describe, expect, it } from 'bun:test';
import { resolvePersistedCallOwner } from './railway';

const parent = 'AC' + '1'.repeat(32);
const child = 'AC' + '2'.repeat(32);
const other = 'AC' + '3'.repeat(32);
const callSid = 'CA' + '4'.repeat(32);

const binding = (group: Record<string, unknown> | null, mapped = true) => ({
  getCallMapping: async (_sid: string) => mapped ? 'group-1' : null,
  getGroup: async (_groupId: string) => group ? JSON.stringify(group) : null,
});
const group = (owner?: string) => ({
  groupId: 'group-1',
  workspaceId: 'workspace-1',
  calls: [{ callSid }],
  ...(owner ? { providerAccountId: owner } : {}),
});

describe('DEV-1695 immutable provider account ownership at completion', () => {
  it('retrieves an existing child-owned call from its persisted group, not current workspace assignment', async () => {
    expect(await resolvePersistedCallOwner(binding(group(child)), callSid, 'workspace-1', parent)).toBe(child);
  });
  it('treats a legacy group without an account as parent-owned after cutover', async () => {
    expect(await resolvePersistedCallOwner(binding(group()), callSid, 'workspace-1', parent)).toBe(parent);
  });
  it('refuses missing, cross-tenant, mismatched call and malformed owner evidence', async () => {
    await expect(resolvePersistedCallOwner(binding(group(other)), callSid, 'other-workspace', parent)).rejects.toThrow();
    await expect(resolvePersistedCallOwner(binding({ ...group(child), calls: [{ callSid: 'CA' + '7'.repeat(32) }] }), callSid, 'workspace-1', parent)).rejects.toThrow();
    await expect(resolvePersistedCallOwner(binding(group('invalid')), callSid, 'workspace-1', parent)).rejects.toThrow();
    await expect(resolvePersistedCallOwner(binding(null, false), callSid, 'workspace-1', parent)).rejects.toThrow();
  });
});
