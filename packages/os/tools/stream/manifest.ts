import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "stream",
  sourcePath: "packages/os/tools/stream/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
