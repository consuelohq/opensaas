import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "mac",
  sourcePath: "packages/os/tools/mac/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
