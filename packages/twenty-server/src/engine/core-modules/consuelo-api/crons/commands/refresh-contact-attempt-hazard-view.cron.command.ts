import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  CONTACT_ATTEMPT_HAZARD_VIEW_REFRESH_CRON_PATTERN,
  RefreshContactAttemptHazardViewCronJob,
} from 'src/engine/core-modules/consuelo-api/crons/jobs/refresh-contact-attempt-hazard-view.cron.job';

@Command({
  name: 'cron:consuelo-api:refresh-contact-attempt-hazard-view',
  description: 'Starts a cron job to refresh the contact attempt hazard materialized view',
})
export class RefreshContactAttemptHazardViewCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: RefreshContactAttemptHazardViewCronJob.name,
      data: undefined,
      options: {
        repeat: { pattern: CONTACT_ATTEMPT_HAZARD_VIEW_REFRESH_CRON_PATTERN },
      },
    });
  }
}
