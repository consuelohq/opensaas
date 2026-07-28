import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "filesystem",
  sourcePath: "packages/os/tools/filesystem/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
