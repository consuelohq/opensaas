import { HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { HealthController } from 'src/engine/core-modules/health/controllers/health.controller';

describe('HealthController', () => {
  let healthController: HealthController;
  const query = jest.fn();
  const ping = jest.fn();
  const check = jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
    return Promise.all(indicators.map((indicator) => indicator()));
  });

  beforeEach(async () => {
    check.mockClear();
    query.mockResolvedValue([{ '?column?': 1 }]);
    ping.mockResolvedValue('PONG');

    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check },
        },
        {
          provide: HealthIndicatorService,
          useValue: {
            check: (key: string) => ({
              up: (details?: Record<string, unknown>) => ({
                [key]: { status: 'up', ...details },
              }),
              down: (details?: Record<string, unknown>) => ({
                [key]: { status: 'down', ...details },
              }),
            }),
          },
        },
        {
          provide: RedisClientService,
          useValue: { getClient: () => ({ ping }) },
        },
        {
          provide: getDataSourceToken(),
          useValue: { query },
        },
      ],
    }).compile();

    healthController = testingModule.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(healthController).toBeDefined();
  });

  it('should check database and redis health', async () => {
    const result = await healthController.check();

    expect(check).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(ping).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        database: expect.objectContaining({ status: 'up' }),
      }),
      expect.objectContaining({
        redis: expect.objectContaining({ status: 'up' }),
      }),
    ]);
  });
});
