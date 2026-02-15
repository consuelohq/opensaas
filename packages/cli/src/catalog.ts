import type { Command, Option, Argument } from 'commander';

// -- types --

interface ParameterDef {
  type: 'string' | 'number' | 'boolean';
  description: string;
  enum?: string[];
  default?: unknown;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDef>;
    required: string[];
  };
}

interface CommandCatalog {
  commands: ToolDefinition[];
  generatedAt: string;
}

// commands the assistant should not expose
const SKIP_COMMANDS = new Set(['init', 'status', 'catalog', 'coach', 'analytics']);

// -- extraction --

const inferOptionType = (opt: Option): 'string' | 'number' | 'boolean' => {
  if (opt.isBoolean?.() || (!opt.required && !opt.optional)) return 'boolean';
  const name = opt.long?.replace(/^--/, '') ?? opt.attributeName();
  if (/limit|size|overlap|threshold|count/i.test(name)) return 'number';
  return 'string';
};

const extractOptions = (cmd: Command): { properties: Record<string, ParameterDef>; required: string[] } => {
  const properties: Record<string, ParameterDef> = {};
  const required: string[] = [];

  for (const opt of cmd.options as Option[]) {
    if (opt.hidden) continue;
    // skip global flags inherited from root
    const name = opt.attributeName();
    if (['json', 'quiet', 'telemetry', 'workspace'].includes(name)) continue;

    const def: ParameterDef = {
      type: inferOptionType(opt),
      description: opt.description ?? name,
    };
    if (opt.defaultValue !== undefined) def.default = opt.defaultValue;
    if (opt.argChoices?.length) def.enum = opt.argChoices;

    properties[name] = def;
    if (opt.mandatory) required.push(name);
  }

  return { properties, required };
};

const extractArguments = (cmd: Command): { properties: Record<string, ParameterDef>; required: string[] } => {
  const properties: Record<string, ParameterDef> = {};
  const required: string[] = [];

  // commander exposes registered arguments via _args (public in newer versions as .registeredArguments)
  const args: Argument[] = (cmd as unknown as { registeredArguments?: Argument[]; _args?: Argument[] }).registeredArguments
    ?? (cmd as unknown as { _args?: Argument[] })._args
    ?? [];

  for (const arg of args) {
    const name = arg.name();
    properties[name] = {
      type: 'string',
      description: arg.description ?? name,
    };
    if (arg.required) required.push(name);
  }

  return { properties, required };
};

const walkCommands = (cmd: Command, prefix: string[]): ToolDefinition[] => {
  const results: ToolDefinition[] = [];
  const subs = cmd.commands as Command[];

  if (!subs.length) {
    // leaf command — extract it
    const fullName = prefix.join('_');
    if (!fullName || SKIP_COMMANDS.has(fullName)) return results;

    const opts = extractOptions(cmd);
    const args = extractArguments(cmd);

    results.push({
      name: fullName,
      description: cmd.description() || fullName,
      parameters: {
        type: 'object',
        properties: { ...args.properties, ...opts.properties },
        required: [...args.required, ...opts.required],
      },
    });
    return results;
  }

  for (const sub of subs) {
    if ((sub as unknown as { _hidden?: boolean })._hidden) continue;
    const name = sub.name();
    if (SKIP_COMMANDS.has(name)) continue;
    results.push(...walkCommands(sub, [...prefix, name]));
  }

  return results;
};

// -- public API --

export const extractCatalog = (program: Command): CommandCatalog => ({
  commands: walkCommands(program, []),
  generatedAt: new Date().toISOString(),
});

export const catalogToTools = (catalog: CommandCatalog): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: ToolDefinition['parameters'] };
}> =>
  catalog.commands.map((cmd) => ({
    type: 'function' as const,
    function: {
      name: cmd.name,
      description: cmd.description,
      parameters: cmd.parameters,
    },
  }));

export type { CommandCatalog, ToolDefinition, ParameterDef };
