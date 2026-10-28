import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "review",
  sourcePath: "packages/os/tools/review/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
