import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "tool-discovery",
  sourcePath: "packages/os/tools/tool-discovery/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
