import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'posthog',
  sourcePath: 'packages/os/tools/posthog/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
