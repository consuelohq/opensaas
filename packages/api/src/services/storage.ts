// S3-compatible storage service — works with AWS S3, Cloudflare R2, MinIO
// DEV-744: presigned upload/download URLs, object deletion

import type { S3Client } from '@aws-sdk/client-s3';

export interface StorageConfig {
  region?: string;
  endpoint?: string;
  bucket: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
  /** Presigned URL expiry in seconds (default: 3600) */
  urlExpiry?: number;
}

export class StorageService {
  private client: S3Client | null = null;
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      region: config?.region ?? process.env.S3_REGION ?? 'us-east-1',
      endpoint: config?.endpoint ?? process.env.S3_ENDPOINT,
      bucket: config?.bucket ?? process.env.S3_BUCKET ?? '',
      credentials: config?.credentials ?? {
        accessKeyId: process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      },
      urlExpiry: config?.urlExpiry ?? 3600,
    };
  }

  private async getClient(): Promise<S3Client> {
    try {
      if (!this.client) {
        const { S3Client } = await import('@aws-sdk/client-s3');
        this.client = new S3Client({
          region: this.config.region,
          endpoint: this.config.endpoint,
          credentials: this.config.credentials,
          forcePathStyle: !!this.config.endpoint, // needed for MinIO/R2
        });
      }
      return this.client;
    } catch (err: unknown) {
      this.client = null;
      throw err;
    }
  }

  async getUploadUrl(key: string, contentType: string): Promise<string> {
    try {
      const client = await this.getClient();
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(client, command, { expiresIn: this.config.urlExpiry });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate upload URL';
      throw new Error(message);
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    try {
      const client = await this.getClient();
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });
      return getSignedUrl(client, command, { expiresIn: this.config.urlExpiry });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate download URL';
      throw new Error(message);
    }
  }

  async getObject(key: string): Promise<Buffer> {
    try {
      const client = await this.getClient();
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const response = await client.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }));
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new Error('Empty response body');
      return Buffer.from(bytes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch object';
      throw new Error(message);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const client = await this.getClient();
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      await client.send(new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete object';
      throw new Error(message);
    }
  }
}
