import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'lifecycle',
  sourcePath: 'packages/os/tools/lifecycle/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
