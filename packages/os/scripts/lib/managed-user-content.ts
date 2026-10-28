import fs from 'node:fs';
import path from 'node:path';

/**
 * Reconciles the visible `~/Consuelo` content that must exist on every node.
 *
 * This runs on install *and* update. Provisioning previously only ran during install, so anything
 * seeded there never reached an existing user who ran `consuelo update` — which is the normal path,
 * since almost nobody uninstalls and reinstalls. Reconciling after every release activation is what
 * makes that content actually arrive.
 *
 * Two ownership classes, matching the update-plan vocabulary in the foundation plan:
 *
 *   - `preserve-custom`: seeded once, never rewritten. The user's own system prompt.
 *   - `update-clean`: regenerated every time. Catalogs and examples that describe the runtime, so
 *     they must track it rather than go stale.
 *
 * Getting that split wrong in either direction is a real failure: overwriting the first destroys
 * user work, and preserving the second leaves a catalog describing a runtime that no longer exists.
 */

export const USER_SYSTEM_PROMPT = 'system.md';
export const USER_SYSTEM_EXAMPLE = 'example-system.md';

export type ManagedUserContentAction = {
  path: string;
  ownership: 'preserve-custom' | 'update-clean';
  status: 'created' | 'preserved' | 'updated' | 'unchanged';
};

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

const writeOwned = (file: string, contents: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: DIR_MODE });
  fs.writeFileSync(file, contents, { mode: FILE_MODE });
  // writeFileSync honours umask on create, so tighten explicitly.
  fs.chmodSync(file, FILE_MODE);
};

/** Seeded once and then left alone forever. */
const seedOnce = (file: string, contents: string): ManagedUserContentAction => {
  if (fs.existsSync(file)) {
    return { path: file, ownership: 'preserve-custom', status: 'preserved' };
  }
  writeOwned(file, contents);
  return { path: file, ownership: 'preserve-custom', status: 'created' };
};

/** Regenerated whenever it differs, because it describes the runtime rather than the user. */
const refresh = (file: string, contents: string): ManagedUserContentAction => {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (existing === contents) {
    return { path: file, ownership: 'update-clean', status: 'unchanged' };
  }
  writeOwned(file, contents);
  return {
    path: file,
    ownership: 'update-clean',
    status: existing === null ? 'created' : 'updated',
  };
};

export function userSystemPromptTemplate(): string {
  return [
    '# Your system prompt',
    '',
    `This ${USER_SYSTEM_PROMPT} file is the primary steering for your Consuelo workspace.`,
    'OS seeds it once and never overwrites it on update.',
    '',
    `See \`${USER_SYSTEM_EXAMPLE}\` in this folder for a worked example.`,
    'That file is an example only and is never loaded into steering.',
    '',
    'Any other `.md` file you add to this directory is loaded after this file, in filename order.',
    '',
    'Changes and newly added Markdown files are picked up on the next steering read; no service restart is required.',
    '',
    '## House rules',
    '',
    '<!-- Add project conventions, tone, or constraints here. -->',
    '',
  ].join('\n');
}

/**
 * A generic worked example that is safe to refresh on every update.
 * It is excluded from active steering by filename.
 */
export function steeringExampleTemplate(): string {
  const header = [
    '<!--',
    '  example-system.md',
    '',
    '  This is a worked example only. It is NOT loaded into steering.',
    '  Every other .md in this folder is loaded, so do not rename this file unless you mean it.',
    '',
    `  Copy anything useful into ${USER_SYSTEM_PROMPT} or another .md file in this folder.`,
    '',
    '  This example is regenerated on update, so edits here may be replaced.',
    '-->',
    '',
  ].join('\n');
  return [
    header,
    '# Example system prompt',
    '',
    '## Working style',
    '',
    '- Prefer concise answers unless more detail is useful.',
    '- State important assumptions when they affect the result.',
    '',
    '## Project rules',
    '',
    '- Prefer existing project patterns before introducing new ones.',
    '- Verify meaningful changes before declaring work complete.',
    '',
  ].join('\n');
}

export function toolCatalogTemplate(
  tools: ReadonlyArray<{ name: string; description?: string }>,
): string {
  return [
    '# OS tools',
    '',
    'A tool is a thin façade. The bun script beside it is what actually executes, which is why',
    'credential grants and permissions are declared against the script rather than the façade name.',
    '',
    '## Viewing and editing',
    '',
    'Built-in tools ship inside the active immutable runtime and are replaced on every update, so',
    'edits there do not survive. To change one, copy it into this directory and edit the copy —',
    'anything here is yours and is never overwritten.',
    '',
    '| what | where |',
    '| --- | --- |',
    '| built-in tool façades | `~/.consuelo/runtime/current/tools/` |',
    '| the scripts they wrap | `~/.consuelo/runtime/current/scripts/` |',
    '| your own tools | `~/Consuelo/Tools/` (this directory) |',
    '| your system prompt | `~/Consuelo/Steering/system.md` |',
    '',
    '## Built-in catalog',
    '',
    ...tools
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(
        (tool) =>
          `- \`${tool.name}\`${tool.description ? ` — ${tool.description}` : ''}`,
      ),
    '',
  ].join('\n');
}

/**
 * Idempotent. Safe to call on every install and every update; repeated calls converge.
 */
export function reconcileManagedUserContent(input: {
  userRoot: string;
  tools: ReadonlyArray<{ name: string; description?: string }>;
  skillsIndex?: string;
}): ManagedUserContentAction[] {
  const actions: ManagedUserContentAction[] = [];

  actions.push(
    seedOnce(
      path.join(input.userRoot, 'Steering', USER_SYSTEM_PROMPT),
      userSystemPromptTemplate(),
    ),
  );
  actions.push(
    refresh(
      path.join(input.userRoot, 'Steering', USER_SYSTEM_EXAMPLE),
      steeringExampleTemplate(),
    ),
  );
  actions.push(
    refresh(
      path.join(input.userRoot, 'Tools', 'TOOLS.md'),
      toolCatalogTemplate(input.tools),
    ),
  );
  if (input.skillsIndex !== undefined) {
    actions.push(
      refresh(
        path.join(input.userRoot, 'Skills', 'skills.json'),
        input.skillsIndex,
      ),
    );
  }

  // The previous catalog filename, removed so Tools cannot hold two catalogs that drift apart.
  const legacyCatalog = path.join(input.userRoot, 'Tools', 'BUILT_INS.md');
  if (fs.existsSync(legacyCatalog)) fs.rmSync(legacyCatalog, { force: true });

  return actions;
}
