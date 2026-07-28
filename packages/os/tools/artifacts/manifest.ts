import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "artifacts",
  sourcePath: "packages/os/tools/artifacts/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
