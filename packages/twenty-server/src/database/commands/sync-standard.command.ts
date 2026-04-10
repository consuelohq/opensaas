import { Command, CommandRunner } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { TwentyStandardApplicationService } from 'src/engine/workspace-manager/twenty-standard-application/services/twenty-standard-application.service';

@Command({
  name: 'workspace:sync-standard',
  description: 'Sync standard application metadata for all active workspaces',
})
export class SyncStandardCommand extends CommandRunner {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly twentyStandardApplicationService: TwentyStandardApplicationService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const workspaces = await this.workspaceRepository.find({
      where: { activationStatus: WorkspaceActivationStatus.ACTIVE },
    });

    console.log('Found ' + workspaces.length + ' active workspaces');

    for (const workspace of workspaces) {
      try {
        console.log('Syncing workspace: ' + workspace.id);
        await this.twentyStandardApplicationService.synchronizeTwentyStandardApplicationOrThrow({
          workspaceId: workspace.id,
        });
        console.log('Done: ' + workspace.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error('Failed workspace ' + workspace.id + ': ' + message);
      }
    }

    console.log('All workspaces synced');
  }
}
