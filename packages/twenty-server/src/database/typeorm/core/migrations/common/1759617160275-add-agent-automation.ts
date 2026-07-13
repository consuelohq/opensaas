import { type MigrationInterface } from 'typeorm';

export class AddAgentAutomation1759617160275 implements MigrationInterface {
  name = 'AddAgentAutomation1759617160275';

  public async up(): Promise<void> {
    // NOTE: This migration is retained for compatibility with environments that
    // have recorded it, but the canonical agent automation table is created by
    // CreateAgentAutomations1771790000001 after agentSkill exists.
  }

  public async down(): Promise<void> {
    // NOTE: No-op for the compatibility migration above.
  }
}
