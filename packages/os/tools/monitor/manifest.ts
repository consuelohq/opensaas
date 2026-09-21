import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'monitor',
  sourcePath: 'packages/os/tools/monitor/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
