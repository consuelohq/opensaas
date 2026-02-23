import { Logger, Scope } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { AutomationRunService } from 'src/engine/core-modules/agent/services/automation-run.service';
import { AutomationService } from 'src/engine/core-modules/agent/services/automation.service';

export type AgentAutomationExecuteJobData = {
  runId: string;
  automationId: string;
};

@Processor({ queueName: MessageQueue.workflowQueue, scope: Scope.REQUEST })
export class AgentAutomationExecuteJob {
  private readonly logger = new Logger(AgentAutomationExecuteJob.name);

  constructor(
    private readonly automationRunService: AutomationRunService,
    private readonly automationService: AutomationService,
  ) {}

  @Process(AgentAutomationExecuteJob.name)
  async handle(data: AgentAutomationExecuteJobData): Promise<void> {
    const { runId, automationId } = data;

    try {
      await this.automationRunService.start(runId);

      const automation = await this.automationService.findById(automationId);

      if (!automation) {
        await this.automationRunService.fail(
          runId,
          `Automation ${automationId} not found`,
        );
        await this.automationService.updateLastRun(automationId, 'failure');

        return;
      }

      if (!automation.enabled) {
        await this.automationRunService.fail(runId, 'Automation is disabled');
        await this.automationService.updateLastRun(automationId, 'skipped');

        return;
      }

      // skill execution integration — wire to skill-execution.service.ts
      this.logger.log(
        `Executing automation ${automationId} (skill: ${automation.skillId})`,
      );

      await this.automationRunService.complete(runId, {
        message: 'Placeholder execution succeeded',
      });
      await this.automationService.updateLastRun(automationId, 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown execution error';

      this.logger.error(`Automation run ${runId} failed: ${message}`);
      await this.automationRunService.fail(runId, message);
      await this.automationService.updateLastRun(automationId, 'failure');
    }
  }
}
