import { describe, expect, it } from 'vitest';

import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

describe('daily schedules tool package', () => {
  it('keeps artifact publication explicit and mutating', () => {
    expect(toolSchemas[0]?.definition).toMatchObject({
      name: 'dailySchedules.publish',
      inputSchema: 'DailySchedulesPublishInput',
      sessionRequired: false,
      capabilities: { readOnly: false, mutating: true },
    });
    expect(toolHandlers[0]?.command).toMatchObject({ script: 'daily-schedules', branchMode: 'none' });
  });
});
