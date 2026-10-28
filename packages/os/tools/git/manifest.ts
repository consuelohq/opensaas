import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "git",
  sourcePath: "packages/os/tools/git/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
