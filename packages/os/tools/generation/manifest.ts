import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "generation",
  sourcePath: "packages/os/tools/generation/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
