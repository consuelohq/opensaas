import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

export const CONTACT_ATTEMPT_HAZARD_VIEW_REFRESH_CRON_PATTERN = '0 3 * * *';

@Processor({
  queueName: MessageQueue.cronQueue,
})
export class RefreshContactAttemptHazardViewCronJob {
  constructor(@InjectDataSource() private readonly coreDataSource: DataSource) {}

  @Process(RefreshContactAttemptHazardViewCronJob.name)
  async handle(): Promise<void> {
    await this.coreDataSource.query(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY core.contact_attempt_hazard_hourly_mv',
    );
  }
}
