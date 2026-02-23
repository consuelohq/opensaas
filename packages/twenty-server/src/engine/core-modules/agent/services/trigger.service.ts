import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from '@nestjs/cache-manager';

import {
  buildDebounceKey,
  findMatchingAutomations,
  matchConditionalTrigger,
  matchEventTrigger,
} from '@consuelo/agent';

import type { Repository } from 'typeorm';
import type {
  Automation,
  CrmEvent,
  TriggerConfig,
  TriggerEvalResult,
} from '@consuelo/agent';

import { AgentAutomationEntity } from 'src/engine/core-modules/agent/entities/automation.entity';

const DEFAULT_DEBOUNCE_TTL_MS = 60_000;

@Injectable()
export class AgentTriggerService {
  constructor(
    @InjectRepository(AgentAutomationEntity, 'core')
    private readonly automationRepository: Repository<AgentAutomationEntity>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async handleEvent(event: CrmEvent): Promise<TriggerEvalResult> {
    try {
      const entities = await this.automationRepository.find({
        where: { workspaceId: event.workspaceId, enabled: true },
      });

      const automations = entities.map((e) => this.entityToAutomation(e));

      const matched = findMatchingAutomations(automations, event);

      // NOTE: filter out debounced automations
      const results: Array<{ automationId: string; automationName: string }> =
        [];

      for (const automation of matched) {
        const debounced = await this.isDebounced(automation.id, event.type);

        if (!debounced) {
          await this.setDebounce(automation.id, event.type);
          results.push({
            automationId: automation.id,
            automationName: automation.name,
          });
        }
      }

      return {
        shouldFire: results.length > 0,
        reason:
          results.length > 0
            ? `${results.length} automation(s) matched`
            : 'no matching automations',
        matchedAutomations: results,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      return {
        shouldFire: false,
        reason: `trigger evaluation failed: ${message}`,
        matchedAutomations: [],
      };
    }
  }

  async isDebounced(automationId: string, eventType: string): Promise<boolean> {
    try {
      const key = buildDebounceKey(automationId, eventType);
      const value = await this.cache.get(key);

      return value !== undefined && value !== null;
    } catch {
      // NOTE: if cache is down, allow the trigger to fire
      return false;
    }
  }

  async setDebounce(
    automationId: string,
    eventType: string,
    ttlMs?: number,
  ): Promise<void> {
    try {
      const key = buildDebounceKey(automationId, eventType);

      await this.cache.set(key, '1', ttlMs ?? DEFAULT_DEBOUNCE_TTL_MS);
    } catch {
      // NOTE: if cache is down, debounce is best-effort
    }
  }

  async dryRun(
    automationId: string,
    event: CrmEvent,
  ): Promise<TriggerEvalResult> {
    try {
      const entity = await this.automationRepository.findOne({
        where: { id: automationId },
      });

      if (!entity) {
        return {
          shouldFire: false,
          reason: `automation ${automationId} not found`,
          matchedAutomations: [],
        };
      }

      const automation = this.entityToAutomation(entity);
      const trigger = automation.trigger;
      const matched =
        matchEventTrigger(trigger, event) ||
        matchConditionalTrigger(trigger, event);

      return {
        shouldFire: matched,
        reason: matched
          ? 'trigger matched (dry run)'
          : 'trigger did not match (dry run)',
        matchedAutomations: matched
          ? [{ automationId: entity.id, automationName: entity.name }]
          : [],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      return {
        shouldFire: false,
        reason: `dry run failed: ${message}`,
        matchedAutomations: [],
      };
    }
  }

  private entityToAutomation(entity: AgentAutomationEntity): Automation {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? undefined,
      enabled: entity.enabled,
      skillId: entity.skillId,
      trigger: entity.triggerConfig as TriggerConfig,
      inputOverrides: entity.inputOverrides,
      notifyOn: (entity.notifyOn as Automation['notifyOn']) ?? 'failure',
      maxRunsPerDay: entity.maxRunsPerDay ?? undefined,
      lastRunAt: entity.lastRunAt ?? undefined,
      lastRunStatus:
        (entity.lastRunStatus as Automation['lastRunStatus']) ?? undefined,
      userId: entity.userId,
      workspaceId: entity.workspaceId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
