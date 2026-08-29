import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'security',
  sourcePath: 'packages/os/tools/security/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
