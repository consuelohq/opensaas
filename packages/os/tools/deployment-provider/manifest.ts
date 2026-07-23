import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'deployment-provider',
  sourcePath: 'packages/os/tools/deployment-provider/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
