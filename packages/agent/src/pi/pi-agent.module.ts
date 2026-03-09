import { Module, Global, type DynamicModule } from '@nestjs/common';

import { PiAgentService } from './pi-agent.service.js';
import type { PiAgentConfig, PiModuleOptions } from './pi-agent.types.js';

/**
 * Pi Agent Module
 *
 * NestJS module for integrating the Pi coding agent runtime.
 * Provides sandboxed code execution with streaming support.
 *
 * Usage:
 * ```ts
 * @Module({
 *   imports: [
 *     PiAgentModule.forRoot({
 *       apiKey: process.env.PI_API_KEY,
 *       model: 'claude-3-5-sonnet',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({
  providers: [PiAgentService],
  exports: [PiAgentService],
})
export class PiAgentModule {
  static forRoot(config: PiAgentConfig): DynamicModule {
    return {
      module: PiAgentModule,
      providers: [
        {
          provide: 'PI_AGENT_CONFIG',
          useValue: config,
        },
        PiAgentService,
      ],
      exports: [PiAgentService],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<PiAgentConfig> | PiAgentConfig;
    inject?: unknown[];
  }): DynamicModule {
    return {
      module: PiAgentModule,
      providers: [
        {
          provide: 'PI_AGENT_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        PiAgentService,
      ],
      exports: [PiAgentService],
      global: true,
    };
  }

  static forFeature(options?: PiModuleOptions): DynamicModule {
    return {
      module: PiAgentModule,
      providers: [PiAgentService],
      exports: [PiAgentService],
      global: options?.isGlobal ?? false,
    };
  }
}
