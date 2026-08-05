import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
export const ROOT_AGENT_INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'] as const;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..');
const rootAgentInstructionsPath = path.join(
  packageRoot,
  'steering',
  'root-agent-instructions.md',
);

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

export function rootAgentInstructionsTemplate(): string {
  return fs.readFileSync(rootAgentInstructionsPath, 'utf8');
}

export function userSystemPromptTemplate(): string {
  return [
    '# Your system prompt',
    '',
    'Anything here is appended to the steering every agent receives, after the built-in runtime',
    'steering. This file is yours: OS seeds it once and never overwrites it on update.',
    '',
    `See \`${USER_SYSTEM_EXAMPLE}\` in this folder for a worked example — steal whatever is useful.`,
    'That file is only ever an example; it is never loaded into steering.',
    '',
    'Any other `.md` in this directory is loaded too, in filename order.',
    '',
    'Changes are picked up when the OS service reloads:',
    '',
    '```sh',
    'consuelo restart',
    '```',
    '',
    'The built-in steering this extends lives in the immutable runtime at',
    '`~/.consuelo/runtime/current/steering/system_prompt.md` and is replaced on every update, so',
    'edit this file instead of that one.',
    '',
    '## House rules',
    '',
    '<!-- Add project conventions, tone, or constraints here. -->',
    '',
  ].join('\n');
}

/**
 * The example is the real bundled steering, verbatim, behind a header.
 *
 * It is generated from the same source the runtime loads, so the two cannot drift: a user reading
 * the example is reading exactly what their agents are actually given. It is excluded from steering
 * by filename, which is why it can safely contain a full instruction document.
 */
export function steeringExampleTemplate(steeringBody?: string): string {
  const header = [
    '<!--',
    '  example-system.md',
    '',
    `  This is Consuelo's own steering, verbatim. It is NOT loaded: OS excludes this filename, so`,
    '  nothing here reaches an agent no matter what it says. Every other .md in this folder IS',
    '  loaded, so do not rename this file unless you mean it.',
    '',
    `  Steal whatever is useful into ${USER_SYSTEM_PROMPT}, which is loaded.`,
    '',
    '  Regenerated on every update from the same steering the runtime serves, so your edits here',
    '  would be replaced. Edit ' + USER_SYSTEM_PROMPT + ' instead.',
    '-->',
    '',
  ].join('\n');

  if (!steeringBody) {
    return [
      header,
      '# Example steering',
      '',
      'The bundled steering could not be read from this release, so there is nothing to show here.',
      '',
    ].join('\n');
  }
  return `${header}${steeringBody.endsWith('\n') ? steeringBody : `${steeringBody}\n`}`;
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
  /** The bundled steering, reproduced verbatim as the example. */
  steeringBody?: string;
  /** Candidate-release root agent instructions; current runtime source is the fallback. */
  rootAgentInstructionsBody?: string;
}): ManagedUserContentAction[] {
  const actions: ManagedUserContentAction[] = [];
  const rootAgentInstructions =
    input.rootAgentInstructionsBody ?? rootAgentInstructionsTemplate();

  for (const fileName of ROOT_AGENT_INSTRUCTION_FILES) {
    actions.push(refresh(path.join(input.userRoot, fileName), rootAgentInstructions));
  }

  actions.push(
    seedOnce(
      path.join(input.userRoot, 'Steering', USER_SYSTEM_PROMPT),
      userSystemPromptTemplate(),
    ),
  );
  actions.push(
    refresh(
      path.join(input.userRoot, 'Steering', USER_SYSTEM_EXAMPLE),
      steeringExampleTemplate(input.steeringBody),
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
