import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP = 50;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z])/;

export interface KnowledgeSearchResult {
  chunkId: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  collectionId: string;
  collectionName: string;
  fileId: string;
}

interface EmbeddingClient {
  embeddings: {
    create: (p: {
      model: string;
      input: string[];
      dimensions: number;
    }) => Promise<{ data: Array<{ embedding: number[] }> }>;
  };
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private openaiClient: EmbeddingClient | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createCollection(workspaceId: string, name: string, description?: string) {
    try {
      const result = await this.dataSource.query(
        'INSERT INTO knowledge_collections (workspace_id, name, description) VALUES ($1, $2, $3) RETURNING id, workspace_id, name, chunk_count',
        [workspaceId, name, description ?? null],
      );

      return { id: result[0].id as string, name: result[0].name as string, workspaceId: result[0].workspace_id as string, chunkCount: (result[0].chunk_count ?? 0) as number };
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
        throw new Error('Collection "' + name + '" already exists');
      }
      throw err;
    }
  }

  async listCollections(workspaceId: string) {
    const rows = await this.dataSource.query(
      'SELECT id, name, chunk_count FROM knowledge_collections WHERE workspace_id = $1 ORDER BY name',
      [workspaceId],
    );

    return (rows as Array<{ id: string; name: string; chunk_count: number }>).map(r => ({
      id: r.id, name: r.name, chunkCount: r.chunk_count ?? 0,
    }));
  }

  async deleteCollection(collectionId: string, workspaceId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query('UPDATE files SET collection_id = NULL, indexed_at = NULL WHERE collection_id = $1', [collectionId]);
      await qr.query('DELETE FROM knowledge_collections WHERE id = $1 AND workspace_id = $2', [collectionId, workspaceId]);
      await qr.commitTransaction();
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        // @ts-ignore — pdf-parse is a peerDependency
        const { default: pdfParse } = await import('pdf-parse');
        return (await pdfParse(buffer)).text;
      }
      if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // @ts-ignore — mammoth is a peerDependency
        const mammoth = await import('mammoth');
        return (await mammoth.extractRawText({ buffer })).value;
      }
      return buffer.toString('utf-8');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Text extraction failed';
      this.logger.error('extractText failed: ' + message);
      throw new Error(message);
    }
  }

  chunkText(text: string, maxTokens = DEFAULT_MAX_TOKENS, overlap = DEFAULT_OVERLAP) {
    const sentences = text.split(SENTENCE_SPLIT_RE).map(s => s.trim()).filter(s => s.length > 0);
    const chunks: Array<{ content: string; index: number }> = [];
    let current = '';
    let tokenCount = 0;
    for (const sentence of sentences) {
      const st = Math.ceil(sentence.split(/\s+/).length * 1.3);
      if (tokenCount + st > maxTokens && current.trim()) {
        chunks.push({ content: current.trim(), index: chunks.length });
        const words = current.split(/\s+/);
        current = words.slice(-Math.ceil(overlap / 1.3)).join(' ') + ' ';
        tokenCount = Math.ceil(current.split(/\s+/).length * 1.3);
      }
      current += sentence + ' ';
      tokenCount += st;
    }
    if (current.trim()) {
      chunks.push({ content: current.trim(), index: chunks.length });
    }
    return chunks;
  }

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

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const openai = await this.getOpenAI();
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += 2048) {
      const batch = texts.slice(i, i + 2048);
      try {
        const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch, dimensions: EMBEDDING_DIMENSIONS });
        for (const item of response.data) { embeddings.push(item.embedding); }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Embedding failed';
        throw new Error(message);
      }
    }
    return embeddings;
  }

  async indexFile(fileId: string, collectionId: string, content: string, sourceName?: string): Promise<{ chunkCount: number }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const chunks = this.chunkText(content);
      if (chunks.length === 0) { await qr.commitTransaction(); return { chunkCount: 0 }; }
      await qr.query('DELETE FROM knowledge_chunks WHERE file_id = $1 AND collection_id = $2', [fileId, collectionId]);
      const embeddings = await this.generateEmbeddings(chunks.map(c => c.content));
      for (let i = 0; i < chunks.length; i++) {
        const vecStr = '[' + embeddings[i].join(',') + ']';
        await qr.query(
          'INSERT INTO knowledge_chunks (collection_id, file_id, chunk_index, content, embedding, metadata) VALUES ($1, $2, $3, $4, $5::vector, $6)',
          [collectionId, fileId, i, chunks[i].content, vecStr, JSON.stringify({ source: sourceName ?? 'unknown', tokenCount: Math.ceil(chunks[i].content.split(/\s+/).length * 1.3) })],
        );
      }
      await qr.query('UPDATE knowledge_collections SET chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE collection_id = $1), updated_at = NOW() WHERE id = $1', [collectionId]);
      await qr.query('UPDATE files SET indexed_at = NOW(), collection_id = $1 WHERE id = $2', [collectionId, fileId]);
      await qr.commitTransaction();
      return { chunkCount: chunks.length };
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async search(query: string, workspaceId: string, options?: { collectionId?: string; limit?: number; minSimilarity?: number }): Promise<KnowledgeSearchResult[]> {
    try {
      const limit = options?.limit ?? 5;
      const minSim = options?.minSimilarity ?? 0.7;
      const [qEmb] = await this.generateEmbeddings([query]);
      const vecStr = '[' + qEmb.join(',') + ']';
      const conds = ['kc.workspace_id = $1'];
      const params: (string | number)[] = [workspaceId];
      let idx = 2;
      if (options?.collectionId) { conds.push('kch.collection_id = $' + String(idx)); params.push(options.collectionId); idx++; }
      const sql =
        'SELECT kch.id AS chunk_id, kch.content, 1 - (kch.embedding <=> $' + String(idx) + '::vector) AS similarity, ' +
        'kch.metadata, kch.collection_id, kc.name AS collection_name, kch.file_id ' +
        'FROM knowledge_chunks kch JOIN knowledge_collections kc ON kc.id = kch.collection_id ' +
        'WHERE ' + conds.join(' AND ') + ' AND 1 - (kch.embedding <=> $' + String(idx) + '::vector) >= $' + String(idx + 1) + ' ' +
        'ORDER BY kch.embedding <=> $' + String(idx) + '::vector LIMIT $' + String(idx + 2);
      const rows = await this.dataSource.query(sql, [...params, vecStr, minSim, limit]);
      return (rows as Array<Record<string, unknown>>).map(r => ({
        chunkId: r.chunk_id as string, content: r.content as string,
        similarity: parseFloat(r.similarity as string), metadata: r.metadata as Record<string, unknown>,
        collectionId: r.collection_id as string, collectionName: r.collection_name as string, fileId: r.file_id as string,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      this.logger.error('search failed: ' + message);
      throw new Error(message);
    }
  }
}
