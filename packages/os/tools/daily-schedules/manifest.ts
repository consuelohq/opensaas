import { defineToolPackage } from '../package';
import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

export const toolPackage = defineToolPackage({
  domain: 'daily-schedules',
  sourcePath: 'packages/os/tools/daily-schedules/manifest.ts',
  schemas: toolSchemas,
  handlers: toolHandlers,
});
