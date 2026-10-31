import { it, expect } from 'bun:test';
import {
  canRestoreWorkspacePreferences,
  canPersistWorkspacePreferences,
  selectScriptIdAfterReload,
} from './workspace-recovery';

it('defers scoped view restoration while a live call is active and restores at idle', () => {
  expect(canRestoreWorkspacePreferences('location:rep', null, true)).toBe(false);
  expect(canRestoreWorkspacePreferences('location:rep', null, false)).toBe(true);
  expect(canRestoreWorkspacePreferences('location:rep', 'location:rep', false)).toBe(false);
  expect(canPersistWorkspacePreferences('location:rep', null, true, true)).toBe(false);
  expect(canPersistWorkspacePreferences('other:rep', 'location:rep', true, false)).toBe(false);
  expect(canPersistWorkspacePreferences('location:rep', 'location:rep', true, false)).toBe(true);
});

it('keeps explicit no-script selection and only replaces stale saved script IDs', () => {
  const scripts = [{ id: 'first' }, { id: 'second' }];
  expect(selectScriptIdAfterReload(undefined, scripts)).toBeUndefined();
  expect(selectScriptIdAfterReload('second', scripts)).toBe('second');
  expect(selectScriptIdAfterReload('deleted', scripts)).toBe('first');
  expect(selectScriptIdAfterReload('deleted', [])).toBeUndefined();
});
