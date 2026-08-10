import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "memory",
  sourcePath: "packages/os/tools/memory/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
