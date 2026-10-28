import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: "task-lifecycle",
  sourcePath: "packages/os/tools/task-lifecycle/manifest.ts",
  schemas: toolSchemas,
  handlers: toolHandlers,
});
