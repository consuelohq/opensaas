import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "subagent",
  sourcePath: "packages/os/tools/subagent/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
