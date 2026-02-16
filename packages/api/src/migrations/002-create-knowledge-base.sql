-- DEV-748: Knowledge base — pgvector RAG for AI coaching context
-- Phase 6.5: Collections, chunks with embeddings, metadata filtering

-- pgvector for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- workspace-scoped collections (replaces Python's ChromaDB collections)
CREATE TABLE IF NOT EXISTS knowledge_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  chunk_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX idx_knowledge_collections_workspace ON knowledge_collections(workspace_id);

-- chunks with 1536-dim embeddings (text-embedding-3-small)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ivfflat for approximate nearest neighbor on embeddings
-- NOTE: ivfflat defaults to 100 lists, which is fine for <100k rows.
-- creating on an empty table means empty lists — run REINDEX after initial
-- data load, or consider switching to hnsw (no data-dependent build).
CREATE INDEX idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_collection ON knowledge_chunks(collection_id);
CREATE INDEX idx_chunks_file ON knowledge_chunks(file_id);
-- GIN for efficient metadata filtering (carrier, productType, sectionType, industry)
CREATE INDEX idx_chunks_metadata ON knowledge_chunks USING gin (metadata jsonb_path_ops);

-- link files to their indexed collection
ALTER TABLE files ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ;
ALTER TABLE files ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES knowledge_collections(id);
