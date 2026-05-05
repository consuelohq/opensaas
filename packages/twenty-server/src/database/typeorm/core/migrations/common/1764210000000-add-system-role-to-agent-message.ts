import { type MigrationInterface } from 'typeorm';

export class AddSystemRoleToAgentMessage1764210000000 implements MigrationInterface {
  name = 'AddSystemRoleToAgentMessage1764210000000';

  public async up(): Promise<void> {
    // NOTE: Compatibility no-op. The active agentMessage table stores role as a
    // varchar, not the legacy agentMessage_role_enum enum.
  }

  public async down(): Promise<void> {
    // NOTE: No-op for the compatibility migration above.
  }
}
