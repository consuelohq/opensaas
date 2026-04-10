import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeBase1773900000000 implements MigrationInterface {
  name = 'CreateKnowledgeBase1773900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.knowledge_collections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        chunk_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, name)
      )
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_knowledge_collections_workspace ON core.knowledge_collections(workspace_id)');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES core.knowledge_collections(id) ON DELETE CASCADE,
        file_id UUID NOT NULL REFERENCES core.file(id) ON DELETE CASCADE,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON core.knowledge_chunks USING hnsw (embedding vector_cosine_ops)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_chunks_collection ON core.knowledge_chunks(collection_id)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_chunks_file ON core.knowledge_chunks(file_id)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON core.knowledge_chunks USING gin (metadata jsonb_path_ops)');

    await queryRunner.query('ALTER TABLE core.file ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ');
    await queryRunner.query('ALTER TABLE core.file ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES core.knowledge_collections(id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE core.file DROP COLUMN IF EXISTS collection_id');
    await queryRunner.query('ALTER TABLE core.file DROP COLUMN IF EXISTS indexed_at');
    await queryRunner.query('DROP TABLE IF EXISTS core.knowledge_chunks');
    await queryRunner.query('DROP TABLE IF EXISTS core.knowledge_collections');
  }
}
