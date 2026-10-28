import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'release',
  sourcePath: 'packages/os/tools/release/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
