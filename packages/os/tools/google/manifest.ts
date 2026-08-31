import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'google',
  sourcePath: 'packages/os/tools/google/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
