import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "composed",
  sourcePath: "packages/os/tools/composed/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
