export type JsonObject = Record<string, unknown>;

export type ToolCommand = JsonObject & { script: string };
export type ToolDefinition = JsonObject & { name: string; command: ToolCommand };

export type ToolSchemaContribution = {
  name: string;
  order: readonly string[];
  definition: JsonObject & { name: string };
};

export type ToolHandlerContribution = {
  name: string;
  command: ToolCommand;
};

export type ToolPackage = {
  domain: string;
  sourcePath: string;
  definitions: ToolDefinition[];
  schemas: readonly ToolSchemaContribution[];
  handlers: readonly ToolHandlerContribution[];
};

export function defineToolPackage(input: {
  domain: string;
  sourcePath: string;
  schemas: readonly ToolSchemaContribution[];
  handlers: readonly ToolHandlerContribution[];
}): ToolPackage {
  const handlerByName = new Map(input.handlers.map((handler) => [handler.name, handler]));
  if (handlerByName.size !== input.handlers.length) throw new Error(input.domain + ': duplicate handler name');
  const definitions = input.schemas.map((schema) => {
    const handler = handlerByName.get(schema.name);
    if (!handler) throw new Error(input.domain + ': missing handler for ' + schema.name);
    if (schema.definition.name !== schema.name) throw new Error(input.domain + ': schema name mismatch for ' + schema.name);
    const definition: JsonObject = {};
    for (const key of schema.order) {
      if (key === 'command') definition.command = handler.command;
      else if (key in schema.definition) definition[key] = schema.definition[key];
    }
    if (!('command' in definition)) definition.command = handler.command;
    return definition as ToolDefinition;
  });
  const schemaNames = input.schemas.map((schema) => schema.name).sort();
  const handlerNames = input.handlers.map((handler) => handler.name).sort();
  if (JSON.stringify(schemaNames) !== JSON.stringify(handlerNames)) throw new Error(input.domain + ': schema/handler inventory mismatch');
  return { domain: input.domain, sourcePath: input.sourcePath, definitions, schemas: input.schemas, handlers: input.handlers };
}
