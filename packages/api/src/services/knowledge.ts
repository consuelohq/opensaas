// DEV-748: Knowledge base service — pgvector RAG for AI coaching context
// Ported from Python ChromaDB patterns in consuelo_on_call_coaching/script.py
//
// All heavy deps (pg, openai, pdf-parse) are peerDependencies — lazy-imported
// to avoid crashing consumers that don't need knowledge base features.

import type { Pool } from 'pg';

// -- Types ------------------------------------------------------------------

export interface KnowledgeCollection {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  collectionId: string;
  fileId: string;
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
  createdAt: string;
}

export interface ChunkMetadata {
  source: string;
  page?: number;
  section?: string;
  tokenCount: number;
  isTable?: boolean;
  carrier?: string;
  productType?: string;
  sectionType?: string;
  industry?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ChunkingStrategy {
  maxTokens: number;
  overlap: number;
  splitOn: 'sentence' | 'paragraph' | 'page';
  preserveHeaders: boolean;
  preserveTables: boolean;
}

export interface DocumentChunk {
  content: string;
  tokenCount: number;
  section?: string;
  page?: number;
  isTable?: boolean;
}

export interface KnowledgeResult {
  chunkId: string;
  content: string;
  similarity: number;
  metadata: ChunkMetadata;
  collectionId: string;
  collectionName: string;
  fileId: string;
}

export interface SearchOptions {
  workspaceId: string;
  collectionId?: string;
  limit?: number;
  minSimilarity?: number;
  metadataFilter?: Record<string, string>;
}

export interface CollectionStats {
  collectionId: string;
  collectionName: string;
  chunkCount: number;
  fileCount: number;
}

export interface ExtractionResult {
  text: string;
  pages: Array<{ pageNumber: number; text: string }>;
  metadata: { title?: string; author?: string; pageCount: number };
}

interface DetectedSection {
  header: string | undefined;
  content: string;
  page?: number;
}

// minimal interface for OpenAI embedding client (avoids import() type annotation)
interface EmbeddingClient {
  embeddings: {
    create: (params: {
      model: string;
      input: string[];
      dimensions: number;
    }) => Promise<{ data: Array<{ embedding: number[] }> }>;
  };
}

// -- Constants ---------------------------------------------------------------

const DEFAULT_STRATEGY: ChunkingStrategy = {
  maxTokens: 500,
  overlap: 50,
  splitOn: 'sentence',
  preserveHeaders: true,
  preserveTables: true,
};

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// sentence boundary regex — handles Mr./Mrs./Dr. abbreviations
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z])/;

// table line: 2+ pipe-separated columns OR 3+ tab-separated columns
const TABLE_LINE_RE = /^[\s]*(?:\|.*\|.*\||[^\t]+\t[^\t]+\t)/;

// markdown/text header patterns
const HEADER_RE = /^(?:#{1,6}\s+.+|[A-Z][A-Z\s]{4,}[A-Z])\s*$/;

// -- SQL constants (regular strings, not template literals) ------------------

const SQL_CREATE_COLLECTION =
  'INSERT INTO knowledge_collections (workspace_id, name, description) ' +
  'VALUES ($1, $2, $3) ' +
  'RETURNING id, workspace_id, name, description, chunk_count, created_at, updated_at';

const SQL_LIST_COLLECTIONS =
  'SELECT id, workspace_id, name, description, chunk_count, created_at, updated_at ' +
  'FROM knowledge_collections WHERE workspace_id = $1 ORDER BY name';

const SQL_UPDATE_FILES_CLEAR_COLLECTION =
  'UPDATE files SET collection_id = NULL, indexed_at = NULL WHERE collection_id = $1';

const SQL_DELETE_COLLECTION = 'DELETE FROM knowledge_collections WHERE id = $1';

const SQL_DELETE_CHUNKS_BY_FILE = 'DELETE FROM knowledge_chunks WHERE file_id = $1';

const SQL_INSERT_CHUNK =
  'INSERT INTO knowledge_chunks (collection_id, file_id, chunk_index, content, embedding, metadata) ' +
  'VALUES ($1, $2, $3, $4, $5::vector, $6)';

const SQL_UPDATE_COLLECTION_CHUNK_COUNT =
  'UPDATE knowledge_collections ' +
  'SET chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE collection_id = $1), ' +
  'updated_at = NOW() WHERE id = $1';

const SQL_MARK_FILE_INDEXED =
  'UPDATE files SET indexed_at = NOW(), collection_id = $1 WHERE id = $2';

const SQL_AFFECTED_COLLECTIONS =
  'SELECT DISTINCT collection_id FROM knowledge_chunks WHERE file_id = $1';

const SQL_CLEAR_FILE_INDEX =
  'UPDATE files SET indexed_at = NULL, collection_id = NULL WHERE id = $1';

const SQL_STATS =
  'SELECT kc.id AS collection_id, kc.name AS collection_name, kc.chunk_count, ' +
  'COUNT(DISTINCT kch.file_id) AS file_count ' +
  'FROM knowledge_collections kc ' +
  'LEFT JOIN knowledge_chunks kch ON kch.collection_id = kc.id ' +
  'WHERE kc.workspace_id = $1 ' +
  'GROUP BY kc.id, kc.name, kc.chunk_count ORDER BY kc.name';

// -- Service -----------------------------------------------------------------

export class KnowledgeService {
  private pool: Pool | null = null;
  private openaiClient: EmbeddingClient | null = null;

  // lazy pg pool — peerDependency
  private async getPool(): Promise<Pool> {
    try {
      if (!this.pool) {
        const { default: pg } = await import('pg');
        this.pool = new pg.Pool({
          connectionString: process.env.KNOWLEDGE_DATABASE_URL ?? process.env.DATABASE_URL,
          max: 5,
        });
      }
      return this.pool;
    } catch (err: unknown) {
      this.pool = null;
      throw err;
    }
  }

  // lazy openai client — peerDependency
  private async getOpenAI(): Promise<EmbeddingClient> {
    try {
      if (!this.openaiClient) {
        const { default: OpenAI } = await import('openai');
        this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      }
      return this.openaiClient;
    } catch (err: unknown) {
      this.openaiClient = null;
      throw err;
    }
  }

  // -- Collections -----------------------------------------------------------

  async createCollection(
    workspaceId: string,
    name: string,
    description?: string,
  ): Promise<KnowledgeCollection> {
    const pool = await this.getPool();
    try {
      const result = await pool.query(SQL_CREATE_COLLECTION, [workspaceId, name, description ?? null]);
      return rowToCollection(result.rows[0]);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === '23505') {
        throw new KnowledgeError(
          'DUPLICATE_COLLECTION',
          'Collection "' + name + '" already exists in this workspace',
        );
      }
      throw err;
    }
  }

  async listCollections(workspaceId: string): Promise<KnowledgeCollection[]> {
    const pool = await this.getPool();
    const result = await pool.query(SQL_LIST_COLLECTIONS, [workspaceId]);
    return result.rows.map(rowToCollection);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(SQL_UPDATE_FILES_CLEAR_COLLECTION, [collectionId]);
      await client.query(SQL_DELETE_COLLECTION, [collectionId]);
      await client.query('COMMIT');
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // -- Text Extraction -------------------------------------------------------

  async extractText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    try {
      if (mimeType === 'application/pdf') {
        return await this.extractPDF(buffer);
      }

      const text = buffer.toString('utf-8');
      return {
        text,
        pages: [{ pageNumber: 1, text }],
        metadata: { pageCount: 1 },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Text extraction failed';
      throw new KnowledgeError('EXTRACTION_FAILED', message);
    }
  }

  private async extractPDF(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const { default: pdfParse } = await import('pdf-parse');

      const pages: Array<{ pageNumber: number; text: string }> = [];
      const data = await pdfParse(buffer, {
        pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) =>
          pageData.getTextContent().then((textContent) => {
            const pageText = textContent.items.map((item) => item.str).join(' ');
            pages.push({ pageNumber: pages.length + 1, text: pageText });
            return pageText;
          }),
      });

      return {
        text: data.text,
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: data.text }],
        metadata: {
          title: data.info?.Title as string | undefined,
          author: data.info?.Author as string | undefined,
          pageCount: data.numpages,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PDF extraction failed';
      throw new KnowledgeError('PDF_EXTRACTION_FAILED', message);
    }
  }

  // -- Chunking --------------------------------------------------------------

  chunkDocument(text: string, strategy: ChunkingStrategy = DEFAULT_STRATEGY): DocumentChunk[] {
    const sections = detectSections(text);
    const chunks: DocumentChunk[] = [];

    for (const section of sections) {
      let prose = section.content;

      if (strategy.preserveTables) {
        const separated = separateTablesFromProse(prose);
        for (const table of separated.tables) {
          const content = section.header ? '## ' + section.header + '\n' + table : table;
          chunks.push({
            content,
            tokenCount: estimateTokens(content),
            section: section.header,
            page: section.page,
            isTable: true,
          });
        }
        prose = separated.prose;
      }

      const sentences = splitSentences(prose);
      let currentChunk = section.header && strategy.preserveHeaders
        ? '## ' + section.header + '\n'
        : '';
      let tokenCount = estimateTokens(currentChunk);

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);

        if (tokenCount + sentenceTokens > strategy.maxTokens && currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            tokenCount,
            section: section.header,
            page: section.page,
          });

          const overlapText = getLastNTokens(currentChunk, strategy.overlap);
          currentChunk = section.header && strategy.preserveHeaders
            ? '## ' + section.header + '\n' + overlapText
            : overlapText;
          tokenCount = estimateTokens(currentChunk);
        }

        currentChunk += sentence + ' ';
        tokenCount += sentenceTokens;
      }

      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          tokenCount,
          section: section.header,
          page: section.page,
        });
      }
    }

    return chunks;
  }

  // -- Embeddings ------------------------------------------------------------

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const openai = await this.getOpenAI();
    const embeddings: number[][] = [];
    const batchSize = 2048;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        });
        for (const item of response.data) {
          embeddings.push(item.embedding);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Embedding generation failed';
        throw new KnowledgeError('EMBEDDING_FAILED', message);
      }
    }

    return embeddings;
  }

  // -- Indexing ---------------------------------------------------------------

  async indexFile(
    fileId: string,
    collectionId: string,
    content: string,
    options?: {
      strategy?: Partial<ChunkingStrategy>;
      metadata?: Record<string, string>;
      sourceName?: string;
    },
  ): Promise<{ chunkCount: number }> {
    const pool = await this.getPool();
    const strategy = { ...DEFAULT_STRATEGY, ...options?.strategy };
    const chunks = this.chunkDocument(content, strategy);

    if (chunks.length === 0) {
      return { chunkCount: 0 };
    }

    const embeddings = await this.generateEmbeddings(chunks.map((c) => c.content));
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(SQL_DELETE_CHUNKS_BY_FILE, [fileId]);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const metadata: ChunkMetadata = {
          source: options?.sourceName ?? 'unknown',
          page: chunk.page,
          section: chunk.section,
          tokenCount: chunk.tokenCount,
          isTable: chunk.isTable,
          ...options?.metadata,
        };

        await client.query(SQL_INSERT_CHUNK, [
          collectionId, fileId, i, chunk.content, vectorToString(embedding), metadata,
        ]);
      }

      await client.query(SQL_UPDATE_COLLECTION_CHUNK_COUNT, [collectionId]);
      await client.query(SQL_MARK_FILE_INDEXED, [collectionId, fileId]);
      await client.query('COMMIT');
      return { chunkCount: chunks.length };
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deindexFile(fileId: string): Promise<void> {
    const pool = await this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const affected = await client.query(SQL_AFFECTED_COLLECTIONS, [fileId]);
      await client.query(SQL_DELETE_CHUNKS_BY_FILE, [fileId]);

      for (const row of affected.rows) {
        await client.query(SQL_UPDATE_COLLECTION_CHUNK_COUNT, [row.collection_id]);
      }

      await client.query(SQL_CLEAR_FILE_INDEX, [fileId]);
      await client.query('COMMIT');
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // -- Search ----------------------------------------------------------------

  async search(query: string, options: SearchOptions): Promise<KnowledgeResult[]> {
    try {
      const pool = await this.getPool();
      const limit = options.limit ?? 5;
      const minSimilarity = options.minSimilarity ?? 0.7;

      const [queryEmbedding] = await this.generateEmbeddings([query]);

      // build dynamic WHERE + params
      const conditions: string[] = ['kc.workspace_id = $1'];
      const params: (string | number)[] = [options.workspaceId];
      let idx = 2;

      if (options.collectionId) {
        conditions.push('kch.collection_id = $' + String(idx));
        params.push(options.collectionId);
        idx++;
      }

      if (options.metadataFilter && Object.keys(options.metadataFilter).length > 0) {
        conditions.push('kch.metadata @> $' + String(idx) + '::jsonb');
        params.push(JSON.stringify(options.metadataFilter));
        idx++;
      }

      const vecParam = '$' + String(idx);
      const simParam = '$' + String(idx + 1);
      const limParam = '$' + String(idx + 2);

      const sql =
        'SELECT kch.id AS chunk_id, kch.content, ' +
        '1 - (kch.embedding <=> ' + vecParam + '::vector) AS similarity, ' +
        'kch.metadata, kch.collection_id, kc.name AS collection_name, kch.file_id ' +
        'FROM knowledge_chunks kch ' +
        'JOIN knowledge_collections kc ON kc.id = kch.collection_id ' +
        'WHERE ' + conditions.join(' AND ') + ' ' +
        'AND 1 - (kch.embedding <=> ' + vecParam + '::vector) >= ' + simParam + ' ' +
        'ORDER BY kch.embedding <=> ' + vecParam + '::vector ' +
        'LIMIT ' + limParam;

      const result = await pool.query(sql, [...params, vectorToString(queryEmbedding), minSimilarity, limit]);

      return result.rows.map((row) => ({
        chunkId: row.chunk_id as string,
        content: row.content as string,
        similarity: parseFloat(row.similarity as string),
        metadata: row.metadata as ChunkMetadata,
        collectionId: row.collection_id as string,
        collectionName: row.collection_name as string,
        fileId: row.file_id as string,
      }));
    } catch (err: unknown) {
      if (err instanceof KnowledgeError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Vector search failed';
      throw new KnowledgeError('SEARCH_FAILED', message);
    }
  }

  // convenience method for Phase 3 coaching integration
  async getCoachingContext(query: string, workspaceId: string): Promise<string> {
    try {
      const results = await this.search(query, {
        workspaceId,
        limit: 5,
        minSimilarity: 0.7,
      });

      if (results.length === 0) {
        return '';
      }

      const contextParts = results.map((r, i) => {
        const source = r.metadata.source ?? 'unknown';
        const section = r.metadata.section ? ' > ' + r.metadata.section : '';
        return '[' + String(i + 1) + '] (' + source + section + ', similarity: ' + r.similarity.toFixed(2) + ')\n' + r.content;
      });

      return '--- Knowledge Base Context ---\n' + contextParts.join('\n\n');
    } catch (err: unknown) {
      // coaching context is best-effort — return empty on failure
      return '';
    }
  }

  // -- Stats -----------------------------------------------------------------

  async getStats(workspaceId: string): Promise<CollectionStats[]> {
    try {
      const pool = await this.getPool();
      const result = await pool.query(SQL_STATS, [workspaceId]);

      return result.rows.map((row) => ({
        collectionId: row.collection_id as string,
        collectionName: row.collection_name as string,
        chunkCount: parseInt(row.chunk_count as string, 10),
        fileCount: parseInt(row.file_count as string, 10),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stats';
      throw new KnowledgeError('STATS_FAILED', message);
    }
  }

  // -- Cleanup ---------------------------------------------------------------

  async destroy(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      this.openaiClient = null;
    } catch (err: unknown) {
      this.pool = null;
      this.openaiClient = null;
    }
  }
}

// -- Error class -------------------------------------------------------------

export class KnowledgeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'KnowledgeError';
  }
}

// -- Helpers (module-level, not exported) ------------------------------------

const rowToCollection = (row: Record<string, unknown>): KnowledgeCollection => ({
  id: row.id as string,
  workspaceId: row.workspace_id as string,
  name: row.name as string,
  description: (row.description as string) ?? null,
  chunkCount: parseInt(row.chunk_count as string, 10),
  createdAt: (row.created_at as Date).toISOString(),
  updatedAt: (row.updated_at as Date).toISOString(),
});

const vectorToString = (embedding: number[]): string =>
  '[' + embedding.join(',') + ']';

const estimateTokens = (text: string): number =>
  // rough estimate: ~1.3 tokens per word (GPT tokenizer average)
  Math.ceil(text.split(/\s+/).length * 1.3);

const splitSentences = (text: string): string[] =>
  text
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const getLastNTokens = (text: string, tokenCount: number): string => {
  const words = text.split(/\s+/);
  const wordCount = Math.ceil(tokenCount / 1.3);
  return words.slice(-wordCount).join(' ');
};

const detectSections = (text: string): DetectedSection[] => {
  const lines = text.split('\n');
  const sections: DetectedSection[] = [];
  let currentHeader: string | undefined;
  let currentContent = '';

  for (const line of lines) {
    if (HEADER_RE.test(line.trim())) {
      if (currentContent.trim()) {
        sections.push({ header: currentHeader, content: currentContent.trim() });
      }
      currentHeader = line.trim().replace(/^#+\s+/, '');
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentContent.trim()) {
    sections.push({ header: currentHeader, content: currentContent.trim() });
  }

  if (sections.length === 0) {
    sections.push({ header: undefined, content: text });
  }

  return sections;
};

const separateTablesFromProse = (text: string): { tables: string[]; prose: string } => {
  const lines = text.split('\n');
  const tables: string[] = [];
  let prose = '';
  let currentTable = '';
  let inTable = false;

  for (const line of lines) {
    const isTableLine = TABLE_LINE_RE.test(line) || (inTable && line.trim().startsWith('|'));
    const isSeparator = /^\s*\|[-:|\s]+\|\s*$/.test(line);

    if (isTableLine || (inTable && isSeparator)) {
      if (!inTable) {
        inTable = true;
      }
      currentTable += line + '\n';
    } else {
      if (inTable) {
        tables.push(currentTable.trim());
        currentTable = '';
        inTable = false;
      }
      prose += line + '\n';
    }
  }

  if (inTable && currentTable.trim()) {
    tables.push(currentTable.trim());
  }

  return { tables, prose: prose.trim() };
};
