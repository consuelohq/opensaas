// langfuse is a peer dep — types declared here for compile-time safety
declare module 'langfuse' {
  export class Langfuse {
    constructor(options: { publicKey: string; secretKey: string; baseUrl?: string });
    trace(options: Record<string, unknown>): { generation: (opts: Record<string, unknown>) => void };
    flushAsync(): Promise<void>;
  }
}
