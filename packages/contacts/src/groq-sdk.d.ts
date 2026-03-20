declare module 'groq-sdk' {
  export default class Groq {
    constructor(config: { apiKey: string });
    chat: {
      completions: {
        create(params: {
          model: string;
          messages: Array<{ role: string; content: string }>;
          response_format?: { type: string };
        }, options?: {
          signal?: AbortSignal;
        }): Promise<{
          choices: Array<{
            message?: {
              content?: string;
            };
          }>;
        }>;
      };
    };
  }
}
