import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "http",
  sourcePath: "packages/os/tools/http/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
