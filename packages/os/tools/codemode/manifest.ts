import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "codemode",
  sourcePath: "packages/os/tools/codemode/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
