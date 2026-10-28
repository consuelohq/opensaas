import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "decision-engine",
  sourcePath: "packages/os/tools/decision-engine/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
