import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'railway',
  sourcePath: 'packages/os/tools/railway/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
