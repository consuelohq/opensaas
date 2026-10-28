import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "github",
  sourcePath: "packages/os/tools/github/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
